"""
Providers Router - Multi-Cloudflare Provider Management

Permite que cada tenant (ej: TecHeels) traiga sus propias credenciales
de Cloudflare y gestione tunnels/DNS desde esta API central.

Almacena providers en JSON files bajo /data/providers/.
"""

import json
import uuid
import httpx
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from config import settings
from schemas import (
    ProviderCreate,
    ProviderUpdate,
    ProviderResponse,
    ProviderTunnelCreate,
    ProviderDNSCreate,
    ProviderTunnelIngress,
    StatusResponse,
    TunnelIngressRule,
)

router = APIRouter(prefix="/providers", tags=["Providers (Multi-CF)"])

# ---- Storage ----

PROVIDERS_DIR = Path(settings.providers_file)


def _ensure_dir():
    PROVIDERS_DIR.mkdir(parents=True, exist_ok=True)


def _provider_path(provider_id: str) -> Path:
    return PROVIDERS_DIR / f"{provider_id}.json"


def _load_provider(provider_id: str) -> dict:
    path = _provider_path(provider_id)
    if not path.exists():
        raise HTTPException(404, f"Provider {provider_id} no encontrado")
    return json.loads(path.read_text())


def _save_provider(provider_id: str, data: dict):
    _ensure_dir()
    _provider_path(provider_id).write_text(json.dumps(data, indent=2, default=str))


def _mask_token(token: str) -> str:
    """Muestra solo los ultimos 8 chars."""
    if len(token) <= 8:
        return "****"
    return f"...{token[-8:]}"


def _to_response(data: dict) -> ProviderResponse:
    return ProviderResponse(
        id=data["id"],
        name=data["name"],
        cf_account_id=data["cf_account_id"],
        cf_api_token_hint=_mask_token(data.get("cf_api_token", "")),
        zones=data.get("zones", {}),
        tunnels=data.get("tunnels", {}),
        domains=data.get("domains", []),
        notes=data.get("notes", ""),
        created_at=data.get("created_at", ""),
        updated_at=data.get("updated_at", ""),
    )


# ---- CF API helpers ----

CF_API = "https://api.cloudflare.com/client/v4"


def _cf_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


async def _cf_get(token: str, path: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{CF_API}{path}", headers=_cf_headers(token))
        r.raise_for_status()
        return r.json()


async def _cf_post(token: str, path: str, payload: dict) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{CF_API}{path}", headers=_cf_headers(token), json=payload)
        r.raise_for_status()
        return r.json()


async def _cf_put(token: str, path: str, payload: dict) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.put(f"{CF_API}{path}", headers=_cf_headers(token), json=payload)
        r.raise_for_status()
        return r.json()


# ---- CRUD Endpoints ----

@router.get("", response_model=list[ProviderResponse], summary="Listar todos los providers")
async def list_providers():
    """Lista todos los providers CF registrados."""
    _ensure_dir()
    providers = []
    for f in sorted(PROVIDERS_DIR.glob("*.json")):
        try:
            data = json.loads(f.read_text())
            providers.append(_to_response(data))
        except Exception:
            continue
    return providers


@router.get("/{provider_id}", response_model=ProviderResponse, summary="Obtener provider por ID")
async def get_provider(provider_id: str):
    """Obtiene los datos de un provider (token enmascarado)."""
    data = _load_provider(provider_id)
    return _to_response(data)


@router.post("", response_model=ProviderResponse, status_code=201, summary="Crear provider")
async def create_provider(body: ProviderCreate):
    """
    Registra un nuevo proveedor de Cloudflare.
    El token se almacena encriptado (futuro) y se muestra enmascarado.
    """
    _ensure_dir()
    provider_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()
    data = {
        "id": provider_id,
        "name": body.name,
        "cf_api_token": body.cf_api_token,
        "cf_account_id": body.cf_account_id,
        "zones": body.zones,
        "tunnels": body.tunnels,
        "tunnel_token": body.tunnel_token,
        "domains": body.domains,
        "notes": body.notes,
        "created_at": now,
        "updated_at": now,
    }
    _save_provider(provider_id, data)
    return _to_response(data)


@router.put("/{provider_id}", response_model=ProviderResponse, summary="Actualizar provider")
async def update_provider(provider_id: str, body: ProviderUpdate):
    """Actualiza parcialmente un provider."""
    data = _load_provider(provider_id)
    update_fields = body.model_dump(exclude_unset=True)
    for k, v in update_fields.items():
        data[k] = v
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    _save_provider(provider_id, data)
    return _to_response(data)


@router.delete("/{provider_id}", response_model=StatusResponse, summary="Eliminar provider")
async def delete_provider(provider_id: str):
    """Elimina un provider. No elimina recursos en CF."""
    path = _provider_path(provider_id)
    if not path.exists():
        raise HTTPException(404, f"Provider {provider_id} no encontrado")
    path.unlink()
    return StatusResponse(success=True, message=f"Provider {provider_id} eliminado")


# ---- Tunnel Operations (con credenciales del provider) ----

@router.get("/{provider_id}/tunnels", summary="Listar tunnels del provider")
async def list_provider_tunnels(provider_id: str):
    """Lista los tunnels del account del provider via CF API."""
    data = _load_provider(provider_id)
    token = data["cf_api_token"]
    account_id = data["cf_account_id"]
    try:
        result = await _cf_get(token, f"/accounts/{account_id}/cfd_tunnel")
        tunnels = result.get("result", [])
        return {
            "provider": data["name"],
            "account_id": account_id,
            "tunnels": [
                {
                    "id": t["id"],
                    "name": t["name"],
                    "status": t.get("status", "unknown"),
                    "created_at": t.get("created_at", ""),
                }
                for t in tunnels
                if not t.get("deleted_at")
            ],
        }
    except httpx.HTTPStatusError as e:
        raise HTTPException(e.response.status_code, f"CF API error: {e.response.text}")


@router.post("/{provider_id}/tunnels", summary="Crear tunnel para el provider")
async def create_provider_tunnel(provider_id: str, body: ProviderTunnelCreate):
    """Crea un tunnel nuevo en la cuenta del provider."""
    data = _load_provider(provider_id)
    token = data["cf_api_token"]
    account_id = data["cf_account_id"]
    try:
        result = await _cf_post(
            token,
            f"/accounts/{account_id}/cfd_tunnel",
            {"name": body.tunnel_name, "tunnel_secret": uuid.uuid4().hex},
        )
        tunnel = result.get("result", {})
        # Guardar tunnel_id en el provider
        data.setdefault("tunnels", {})[body.tunnel_name] = tunnel["id"]
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        _save_provider(provider_id, data)
        return {
            "success": True,
            "tunnel_id": tunnel["id"],
            "tunnel_name": body.tunnel_name,
            "tunnel_token": tunnel.get("token", ""),
            "message": f"Tunnel '{body.tunnel_name}' creado en cuenta {data['name']}",
        }
    except httpx.HTTPStatusError as e:
        raise HTTPException(e.response.status_code, f"CF API error: {e.response.text}")


@router.put("/{provider_id}/tunnels/ingress", summary="Configurar ingress del tunnel")
async def update_provider_tunnel_ingress(provider_id: str, body: ProviderTunnelIngress):
    """Actualiza las reglas de ingress de un tunnel del provider."""
    data = _load_provider(provider_id)
    token = data["cf_api_token"]
    account_id = data["cf_account_id"]
    tunnel_id = data.get("tunnels", {}).get(body.tunnel_name)
    if not tunnel_id:
        raise HTTPException(404, f"Tunnel '{body.tunnel_name}' no registrado en provider")

    ingress_list = []
    for rule in body.ingress:
        entry = {"hostname": rule.hostname, "service": rule.service}
        if rule.path:
            entry["path"] = rule.path
        ingress_list.append(entry)
    # Catch-all obligatorio
    ingress_list.append({"service": "http_status:404"})

    try:
        result = await _cf_put(
            token,
            f"/accounts/{account_id}/cfd_tunnel/{tunnel_id}/configurations",
            {"config": {"ingress": ingress_list}},
        )
        return {
            "success": result.get("success", False),
            "tunnel_id": tunnel_id,
            "tunnel_name": body.tunnel_name,
            "rules_count": len(ingress_list),
        }
    except httpx.HTTPStatusError as e:
        raise HTTPException(e.response.status_code, f"CF API error: {e.response.text}")


# ---- DNS Operations ----

@router.post("/{provider_id}/dns", summary="Crear registro DNS con creds del provider")
async def create_provider_dns(provider_id: str, body: ProviderDNSCreate):
    """Crea un registro DNS usando la API key y zone del provider."""
    data = _load_provider(provider_id)
    token = data["cf_api_token"]
    zones = data.get("zones", {})
    zone_id = zones.get(body.zone_domain)
    if not zone_id:
        raise HTTPException(
            404,
            f"Zona '{body.zone_domain}' no registrada en provider. Zonas disponibles: {list(zones.keys())}",
        )

    record_full = f"{body.record_name}.{body.zone_domain}" if body.record_name != "@" else body.zone_domain
    try:
        result = await _cf_post(
            token,
            f"/zones/{zone_id}/dns_records",
            {
                "type": body.record_type,
                "name": record_full,
                "content": body.content,
                "proxied": body.proxied,
                "ttl": 1,  # Auto
            },
        )
        record = result.get("result", {})
        return {
            "success": True,
            "record_id": record.get("id"),
            "name": record.get("name"),
            "type": body.record_type,
            "content": body.content,
            "proxied": body.proxied,
        }
    except httpx.HTTPStatusError as e:
        raise HTTPException(e.response.status_code, f"CF API error: {e.response.text}")


@router.get("/{provider_id}/dns/{zone_domain}", summary="Listar DNS records de una zona")
async def list_provider_dns(provider_id: str, zone_domain: str, record_type: Optional[str] = None):
    """Lista registros DNS de una zona del provider."""
    data = _load_provider(provider_id)
    token = data["cf_api_token"]
    zones = data.get("zones", {})
    zone_id = zones.get(zone_domain)
    if not zone_id:
        raise HTTPException(404, f"Zona '{zone_domain}' no registrada en provider")

    params = "?per_page=100"
    if record_type:
        params += f"&type={record_type}"
    try:
        result = await _cf_get(token, f"/zones/{zone_id}/dns_records{params}")
        records = result.get("result", [])
        return {
            "provider": data["name"],
            "zone": zone_domain,
            "zone_id": zone_id,
            "records": [
                {
                    "id": r["id"],
                    "type": r["type"],
                    "name": r["name"],
                    "content": r["content"],
                    "proxied": r.get("proxied", False),
                    "ttl": r.get("ttl"),
                }
                for r in records
            ],
            "total": len(records),
        }
    except httpx.HTTPStatusError as e:
        raise HTTPException(e.response.status_code, f"CF API error: {e.response.text}")


# ---- Seed / Verify ----

@router.post("/seed/techeels", response_model=StatusResponse, summary="Seed provider TecHeels")
async def seed_techeels():
    """
    Crea el provider pre-configurado para TecHeels
    con sus zonas y tunnel existentes.
    """
    _ensure_dir()

    # Verificar si ya existe
    for f in PROVIDERS_DIR.glob("*.json"):
        try:
            d = json.loads(f.read_text())
            if d.get("name") == "TecHeels":
                return StatusResponse(
                    success=True,
                    message=f"TecHeels ya existe como provider {d['id']}",
                    data={"id": d["id"]},
                )
        except Exception:
            continue

    provider_id = "techeels"
    now = datetime.now(timezone.utc).isoformat()
    data = {
        "id": provider_id,
        "name": "TecHeels",
        "cf_api_token": os.environ.get("CF_API_TOKEN_TECHEELS", ""),
        "cf_account_id": os.environ.get("CF_ACCOUNT_ID_TECHEELS", ""),
        "zones": {
            "techeels.io": os.environ.get("CF_ZONE_TECHEELS_IO", ""),
            "femrd.net": os.environ.get("CF_ZONE_FEMRD_NET", ""),
        },
        "tunnels": {
            "techeels-tunnel": os.environ.get("CF_TUNNEL_TECHEELS", ""),
        },
        "tunnel_token": os.environ.get("CF_API_TOKEN_TECHEELS", ""),
        "domains": [
            "techeels.io",
            "www.techeels.io",
            "app.techeels.io",
            "femrd.net",
            "www.femrd.net",
        ],
        "notes": "TecHeels - Cuenta CF independiente. Tunnel y zonas propias.",
        "created_at": now,
        "updated_at": now,
    }
    _save_provider(provider_id, data)
    return StatusResponse(
        success=True,
        message="Provider TecHeels creado con 2 zonas y 1 tunnel",
        data={"id": provider_id, "zones": list(data["zones"].keys())},
    )


@router.get("/{provider_id}/verify", summary="Verificar conectividad CF del provider")
async def verify_provider(provider_id: str):
    """Verifica que el token CF del provider es valido consultando /user/tokens/verify."""
    data = _load_provider(provider_id)
    token = data["cf_api_token"]
    try:
        result = await _cf_get(token, "/user/tokens/verify")
        status = result.get("result", {}).get("status", "unknown")
        return {
            "provider": data["name"],
            "token_valid": status == "active",
            "status": status,
            "cf_account_id": data["cf_account_id"],
            "zones_count": len(data.get("zones", {})),
            "tunnels_count": len(data.get("tunnels", {})),
        }
    except httpx.HTTPStatusError as e:
        return {
            "provider": data["name"],
            "token_valid": False,
            "status": "error",
            "error": str(e),
        }
