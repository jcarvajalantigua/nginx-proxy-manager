"""
Router: Cloudflare Tunnels — Gestión programática de tunnels e ingress rules.
Usa la API de Cloudflare directamente (no CLI).
"""

import httpx
from fastapi import APIRouter, HTTPException
from schemas import (
    TunnelCreate, TunnelConfigUpdate, TunnelInfo, TunnelIngressRule,
    StatusResponse,
)
from config import settings

router = APIRouter(prefix="/tunnels", tags=["Cloudflare Tunnels"])

CF_API = "https://api.cloudflare.com/client/v4"


def _cf_headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.cf_api_token}",
        "Content-Type": "application/json",
    }


@router.get("/", summary="Listar tunnels de la cuenta")
async def list_tunnels():
    """Lista todos los Cloudflare Tunnels de la cuenta."""
    if not settings.cf_api_token or not settings.cf_account_id:
        raise HTTPException(500, "CF_API_TOKEN y CF_ACCOUNT_ID son requeridos")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{CF_API}/accounts/{settings.cf_account_id}/cfd_tunnel",
            headers=_cf_headers(),
        )
        resp.raise_for_status()
        data = resp.json()
        tunnels = data.get("result", [])
        return [
            TunnelInfo(
                id=t["id"],
                name=t["name"],
                status=t.get("status", "unknown"),
                connections=len(t.get("connections", [])),
            )
            for t in tunnels
            if not t.get("deleted_at")
        ]


@router.get("/{tunnel_id}", summary="Detalle de un tunnel")
async def get_tunnel(tunnel_id: str):
    """Obtiene detalles de un tunnel específico incluyendo ingress rules."""
    if not settings.cf_api_token or not settings.cf_account_id:
        raise HTTPException(500, "CF_API_TOKEN y CF_ACCOUNT_ID son requeridos")

    async with httpx.AsyncClient(timeout=30) as client:
        # Info del tunnel
        resp = await client.get(
            f"{CF_API}/accounts/{settings.cf_account_id}/cfd_tunnel/{tunnel_id}",
            headers=_cf_headers(),
        )
        resp.raise_for_status()
        tunnel = resp.json().get("result", {})

        # Config (ingress rules)
        resp_cfg = await client.get(
            f"{CF_API}/accounts/{settings.cf_account_id}/cfd_tunnel/{tunnel_id}/configurations",
            headers=_cf_headers(),
        )
        config = {}
        if resp_cfg.status_code == 200:
            config = resp_cfg.json().get("result", {}).get("config", {})

        ingress = [
            TunnelIngressRule(
                hostname=rule.get("hostname", ""),
                service=rule.get("service", ""),
                path=rule.get("path"),
            )
            for rule in config.get("ingress", [])
        ]

        return TunnelInfo(
            id=tunnel["id"],
            name=tunnel["name"],
            status=tunnel.get("status", "unknown"),
            connections=len(tunnel.get("connections", [])),
            ingress_rules=ingress,
        )


@router.put("/{tunnel_id}/ingress", response_model=StatusResponse, summary="Actualizar ingress rules")
async def update_tunnel_ingress(tunnel_id: str, config: TunnelConfigUpdate):
    """
    Actualiza las ingress rules de un tunnel.
    Esto redirige todo el tráfico a través de NPM como gateway central.

    Ejemplo de uso para apuntar todo a NPM:
    ```json
    {
      "tunnel_id": "xxx",
      "ingress": [
        {"hostname": "sajet.us", "service": "http://10.10.20.205:80"},
        {"hostname": "*.sajet.us", "service": "http://10.10.20.205:80"},
        {"hostname": "jeturing.com", "service": "http://10.10.20.205:80"},
        {"hostname": "", "service": "http_status:404"}
      ]
    }
    ```
    """
    if not settings.cf_api_token or not settings.cf_account_id:
        raise HTTPException(500, "CF_API_TOKEN y CF_ACCOUNT_ID son requeridos")

    ingress_rules = []
    for rule in config.ingress:
        entry = {"service": rule.service}
        if rule.hostname:
            entry["hostname"] = rule.hostname
        if rule.path:
            entry["path"] = rule.path
        ingress_rules.append(entry)

    # Asegurar catch-all al final
    if not ingress_rules or ingress_rules[-1].get("hostname"):
        ingress_rules.append({"service": "http_status:404"})

    payload = {"config": {"ingress": ingress_rules}}

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.put(
            f"{CF_API}/accounts/{settings.cf_account_id}/cfd_tunnel/{tunnel_id}/configurations",
            headers=_cf_headers(),
            json=payload,
        )
        if resp.status_code >= 400:
            detail = resp.json().get("errors", [resp.text])
            raise HTTPException(resp.status_code, f"Cloudflare error: {detail}")

        return StatusResponse(
            success=True,
            message=f"Ingress rules actualizadas ({len(ingress_rules)} reglas)",
            data={"tunnel_id": tunnel_id, "rules_count": len(ingress_rules)},
        )


@router.post("/redirect-all-to-npm", response_model=StatusResponse, summary="Redirigir todo tráfico a NPM")
async def redirect_all_to_npm():
    """
    Configura el tunnel principal para que TODO el tráfico pase por NPM (PCT 205).
    NPM se encarga del routing interno a cada upstream.

    Esto es la operación clave: Internet → CF → Tunnel → NPM → PCTs
    """
    if not settings.cf_tunnel_id:
        raise HTTPException(400, "SIDECAR_CF_TUNNEL_ID no configurado")

    npm_service = f"http://{settings.pct_205_npm_host}:80"

    # Todos los dominios conocidos → NPM
    ingress = TunnelConfigUpdate(
        tunnel_id=settings.cf_tunnel_id,
        ingress=[
            TunnelIngressRule(hostname="sajet.us", service=npm_service),
            TunnelIngressRule(hostname="www.sajet.us", service=npm_service),
            TunnelIngressRule(hostname="*.sajet.us", service=npm_service),
            TunnelIngressRule(hostname="jeturing.com", service=npm_service),
            TunnelIngressRule(hostname="www.jeturing.com", service=npm_service),
            TunnelIngressRule(hostname="agroliferd.com", service=npm_service),
            TunnelIngressRule(hostname="www.agroliferd.com", service=npm_service),
            TunnelIngressRule(hostname="boletly.com", service=npm_service),
            TunnelIngressRule(hostname="www.boletly.com", service=npm_service),
            TunnelIngressRule(hostname="techeels.io", service=npm_service),
            TunnelIngressRule(hostname="www.techeels.io", service=npm_service),
            TunnelIngressRule(hostname="femrd.net", service=npm_service),
            TunnelIngressRule(hostname="www.femrd.net", service=npm_service),
            TunnelIngressRule(hostname="evolucionamujer.com", service=npm_service),
            TunnelIngressRule(hostname="www.evolucionamujer.com", service=npm_service),
            TunnelIngressRule(hostname="impulse-max.com", service=npm_service),
            TunnelIngressRule(hostname="www.impulse-max.com", service=npm_service),
            TunnelIngressRule(hostname="mail.sajet.us", service=npm_service),
            # proxy.sajet.us y api-gateway.sajet.us NO se exponen via tunnel
            # Solo accesibles via red interna (10.10.20.x) o VPN (Tailscale)
            # Catch-all
            TunnelIngressRule(hostname="", service="http_status:404"),
        ],
    )

    return await update_tunnel_ingress(settings.cf_tunnel_id, ingress)


@router.post("/dns/{domain}", response_model=StatusResponse, summary="Crear CNAME para tunnel")
async def create_tunnel_dns(domain: str, zone_id: str = ""):
    """
    Crea un registro CNAME apuntando un dominio al tunnel.
    Equivalente a: cloudflared tunnel route dns <tunnel_id> <domain>
    """
    if not settings.cf_api_token:
        raise HTTPException(500, "CF_API_TOKEN requerido")

    _zone_id = zone_id or settings.cf_zone_id
    tunnel_id = settings.cf_tunnel_id

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{CF_API}/zones/{_zone_id}/dns_records",
            headers=_cf_headers(),
            json={
                "type": "CNAME",
                "name": domain,
                "content": f"{tunnel_id}.cfargotunnel.com",
                "proxied": True,
                "ttl": 1,  # Auto
            },
        )
        if resp.status_code >= 400:
            errors = resp.json().get("errors", [])
            # Si ya existe, no es error
            if any("already exists" in str(e) for e in errors):
                return StatusResponse(message=f"DNS CNAME para {domain} ya existe")
            raise HTTPException(resp.status_code, f"CF DNS error: {errors}")

        return StatusResponse(
            success=True,
            message=f"CNAME {domain} → {tunnel_id}.cfargotunnel.com creado",
            data=resp.json().get("result", {}),
        )
