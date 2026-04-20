"""
Router: Settings API — Configuracion dinamica del Sidecar.

Gestiona visibilidad de /docs, /redoc, /openapi.json y rotacion de API keys.
Los settings persisten en /app/data/settings.json (volumen Docker).
Se consultan desde el middleware para decidir si mostrar docs o no.
"""

import json
import secrets
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from schemas import StatusResponse

router = APIRouter(prefix="/settings", tags=["Settings & Security"])

SETTINGS_FILE = Path("/app/data/settings.json")

# ---- Defaults ----
DEFAULT_SETTINGS = {
    "docs_enabled": True,
    "docs_require_internal": True,
    "docs_allowed_networks": [
        "10.10.20.0/24",
        "10.10.10.0/24",
        "100.0.0.0/8",
        "172.16.0.0/12",
        "127.0.0.0/8",
        "192.168.0.0/16",
    ],
    "docs_api_key_enabled": False,
    "docs_api_key_hash": "",
    "docs_api_key_hint": "",
    "docs_api_key_created_at": "",
    "api_keys": [],
    "rate_limit_rpm": 300,
    "cors_origins": [
        "http://10.10.20.205:81",
        "http://10.10.20.205:8888",
        "https://sajet.us",
    ],
    "maintenance_mode": False,
    "updated_at": "",
}


def _load_settings() -> dict:
    """Carga settings desde disco o devuelve defaults."""
    if SETTINGS_FILE.exists():
        try:
            data = json.loads(SETTINGS_FILE.read_text())
            # Merge con defaults para campos nuevos
            merged = {**DEFAULT_SETTINGS, **data}
            return merged
        except Exception:
            pass
    return DEFAULT_SETTINGS.copy()


def _save_settings(data: dict):
    """Persiste settings a disco."""
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    SETTINGS_FILE.write_text(json.dumps(data, indent=2, default=str))


def get_current_settings() -> dict:
    """Acceso publico para que el middleware consulte settings."""
    return _load_settings()


# ---- Docs Visibility ----

@router.get("/docs", summary="Obtener config de visibilidad de docs")
async def get_docs_settings():
    """
    Retorna la configuracion actual de visibilidad de /docs, /redoc, /openapi.json.

    Campos:
    - `docs_enabled`: si la documentacion esta habilitada globalmente
    - `docs_require_internal`: si se requiere red interna/VPN
    - `docs_allowed_networks`: lista de CIDRs permitidos
    - `docs_api_key_enabled`: si se acepta API key como alternativa a IP
    - `docs_api_key_hint`: ultimos 8 chars de la API key activa
    """
    s = _load_settings()
    return {
        "docs_enabled": s["docs_enabled"],
        "docs_require_internal": s["docs_require_internal"],
        "docs_allowed_networks": s["docs_allowed_networks"],
        "docs_api_key_enabled": s["docs_api_key_enabled"],
        "docs_api_key_hint": s["docs_api_key_hint"],
        "docs_api_key_created_at": s["docs_api_key_created_at"],
        "updated_at": s.get("updated_at", ""),
    }


@router.put("/docs", summary="Actualizar visibilidad de docs")
async def update_docs_settings(
    docs_enabled: Optional[bool] = None,
    docs_require_internal: Optional[bool] = None,
    docs_allowed_networks: Optional[list[str]] = None,
):
    """
    Actualiza la configuracion de visibilidad de la documentacion.

    - `docs_enabled=false` → desactiva /docs, /redoc, /openapi.json completamente
    - `docs_require_internal=false` → permite acceso publico (PELIGROSO)
    - `docs_allowed_networks` → lista de CIDRs que pueden ver docs

    Los cambios se aplican en la proxima request (sin reiniciar).
    """
    s = _load_settings()
    if docs_enabled is not None:
        s["docs_enabled"] = docs_enabled
    if docs_require_internal is not None:
        s["docs_require_internal"] = docs_require_internal
    if docs_allowed_networks is not None:
        s["docs_allowed_networks"] = docs_allowed_networks
    _save_settings(s)
    return StatusResponse(
        success=True,
        message="Configuracion de docs actualizada",
        data={
            "docs_enabled": s["docs_enabled"],
            "docs_require_internal": s["docs_require_internal"],
            "networks": len(s["docs_allowed_networks"]),
        },
    )


# ---- API Key Management ----

@router.post("/docs/rotate-key", summary="Generar/rotar API key para acceso a docs")
async def rotate_docs_api_key():
    """
    Genera una nueva API key para acceso a /docs desde fuera de la red interna.

    La key se muestra UNA SOLA VEZ en la respuesta.
    Despues solo se muestra el hint (ultimos 8 chars).
    Para usar: `?api_key=<key>` o header `X-API-Key: <key>`.
    """
    s = _load_settings()
    new_key = f"jt_docs_{secrets.token_urlsafe(32)}"
    key_hash = hashlib.sha256(new_key.encode()).hexdigest()

    s["docs_api_key_enabled"] = True
    s["docs_api_key_hash"] = key_hash
    s["docs_api_key_hint"] = f"...{new_key[-8:]}"
    s["docs_api_key_created_at"] = datetime.now(timezone.utc).isoformat()
    _save_settings(s)

    return {
        "success": True,
        "api_key": new_key,
        "hint": s["docs_api_key_hint"],
        "message": "GUARDA ESTA KEY — no se mostrara de nuevo. Usa ?api_key=<key> o header X-API-Key",
        "usage_header": "X-API-Key: <key>",
        "usage_query": "/docs?api_key=<key>",
    }


@router.delete("/docs/revoke-key", summary="Revocar API key de docs")
async def revoke_docs_api_key():
    """Revoca la API key activa. Solo queda acceso por red interna."""
    s = _load_settings()
    s["docs_api_key_enabled"] = False
    s["docs_api_key_hash"] = ""
    s["docs_api_key_hint"] = ""
    s["docs_api_key_created_at"] = ""
    _save_settings(s)
    return StatusResponse(success=True, message="API key revocada. Solo acceso por red interna.")


def verify_api_key(key: str) -> bool:
    """Verifica una API key contra el hash almacenado."""
    s = _load_settings()
    if not s.get("docs_api_key_enabled") or not s.get("docs_api_key_hash"):
        return False
    key_hash = hashlib.sha256(key.encode()).hexdigest()
    return secrets.compare_digest(key_hash, s["docs_api_key_hash"])


# ---- General API Keys (para acceso programatico) ----

@router.get("/api-keys", summary="Listar API keys activas")
async def list_api_keys():
    """Lista las API keys registradas (solo hints, no las keys completas)."""
    s = _load_settings()
    return {
        "keys": [
            {
                "id": k.get("id", ""),
                "name": k.get("name", ""),
                "hint": k.get("hint", ""),
                "created_at": k.get("created_at", ""),
                "last_used": k.get("last_used", ""),
                "scopes": k.get("scopes", ["*"]),
            }
            for k in s.get("api_keys", [])
        ],
        "total": len(s.get("api_keys", [])),
    }


@router.post("/api-keys", summary="Crear API key de acceso")
async def create_api_key(name: str, scopes: list[str] = ["*"]):
    """
    Genera una nueva API key para acceso programatico al sidecar.

    Scopes disponibles: `*` (todo), `read`, `write`, `deploy`, `providers`, `lb`.
    La key se muestra UNA SOLA VEZ.
    """
    s = _load_settings()
    new_key = f"jt_api_{secrets.token_urlsafe(32)}"
    key_hash = hashlib.sha256(new_key.encode()).hexdigest()
    key_id = secrets.token_hex(4)

    key_entry = {
        "id": key_id,
        "name": name,
        "hash": key_hash,
        "hint": f"...{new_key[-8:]}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_used": "",
        "scopes": scopes,
    }
    s.setdefault("api_keys", []).append(key_entry)
    _save_settings(s)

    return {
        "success": True,
        "id": key_id,
        "api_key": new_key,
        "hint": key_entry["hint"],
        "scopes": scopes,
        "message": "GUARDA ESTA KEY — no se mostrara de nuevo.",
    }


@router.delete("/api-keys/{key_id}", summary="Revocar API key")
async def delete_api_key(key_id: str):
    """Revoca una API key por su ID."""
    s = _load_settings()
    keys = s.get("api_keys", [])
    before = len(keys)
    s["api_keys"] = [k for k in keys if k.get("id") != key_id]
    if len(s["api_keys"]) == before:
        raise HTTPException(404, f"API key {key_id} no encontrada")
    _save_settings(s)
    return StatusResponse(success=True, message=f"API key {key_id} revocada")


# ---- Maintenance Mode ----

@router.get("/maintenance", summary="Estado de modo mantenimiento")
async def get_maintenance():
    s = _load_settings()
    return {"maintenance_mode": s.get("maintenance_mode", False)}


@router.put("/maintenance", summary="Toggle modo mantenimiento")
async def set_maintenance(enabled: bool):
    """
    Activa/desactiva modo mantenimiento.
    En modo mantenimiento, la API retorna 503 en todos los endpoints excepto /health.
    """
    s = _load_settings()
    s["maintenance_mode"] = enabled
    _save_settings(s)
    return StatusResponse(
        success=True,
        message=f"Modo mantenimiento {'activado' if enabled else 'desactivado'}",
    )


# ---- CORS ----

@router.get("/cors", summary="Obtener origenes CORS permitidos")
async def get_cors():
    s = _load_settings()
    return {"origins": s.get("cors_origins", [])}


@router.put("/cors", summary="Actualizar origenes CORS")
async def update_cors(origins: list[str]):
    """Actualiza la lista de origenes CORS permitidos. Requiere reinicio del sidecar."""
    s = _load_settings()
    s["cors_origins"] = origins
    _save_settings(s)
    return StatusResponse(
        success=True,
        message=f"CORS actualizado: {len(origins)} origenes. Reiniciar sidecar para aplicar.",
        data={"origins": origins},
    )
