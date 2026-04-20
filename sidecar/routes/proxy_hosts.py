"""
Router: Proxy Hosts — Wrapper sobre NPM API con lógica de negocio.
Permite CRUD de proxy hosts + seed masivo de la infraestructura.
"""

from fastapi import APIRouter, HTTPException
from schemas import (
    ProxyHostCreate, ProxyHostResponse, ProxyHostSeed,
    StatusResponse,
)
from npm_client import npm_client
from config import settings

router = APIRouter(prefix="/proxy-hosts", tags=["Proxy Hosts"])


# ──── Seed: configuración de proxy hosts por defecto ────
DEFAULT_HOSTS = [
    {
        "domain_names": ["sajet.us", "www.sajet.us"],
        "forward_scheme": "http",
        "forward_host": settings.pct_202_sajet_host,
        "forward_port": settings.pct_202_sajet_port,
        "block_exploits": True,
        "allow_websocket_upgrade": True,
        "meta": {"pct": 202, "role": "erp-core"},
    },
    {
        "domain_names": ["proxy.sajet.us"],
        "forward_scheme": "http",
        "forward_host": settings.pct_205_npm_host,
        "forward_port": 81,
        "block_exploits": True,
        "meta": {"pct": 205, "role": "proxy-manager"},
    },
    {
        "domain_names": ["agroliferd.com", "www.agroliferd.com"],
        "forward_scheme": "http",
        "forward_host": settings.pct_201_odoo17_host,
        "forward_port": settings.pct_201_odoo17_port,
        "block_exploits": True,
        "allow_websocket_upgrade": True,
        "meta": {"pct": 201, "role": "odoo17-tenant", "tenant": "agroliferd"},
    },
    {
        "domain_names": ["boletly.com", "www.boletly.com"],
        "forward_scheme": "http",
        "forward_host": settings.pct_201_odoo17_host,
        "forward_port": settings.pct_201_odoo17_port,
        "block_exploits": True,
        "allow_websocket_upgrade": True,
        "meta": {"pct": 201, "role": "odoo17-tenant", "tenant": "boletly"},
    },
    {
        "domain_names": ["techeels.io", "www.techeels.io"],
        "forward_scheme": "http",
        "forward_host": settings.pct_201_odoo17_host,
        "forward_port": settings.pct_201_odoo17_port,
        "block_exploits": True,
        "allow_websocket_upgrade": True,
        "meta": {"pct": 201, "role": "odoo17-tenant", "tenant": "techeels"},
    },
    {
        "domain_names": ["femrd.net", "www.femrd.net"],
        "forward_scheme": "http",
        "forward_host": settings.pct_201_odoo17_host,
        "forward_port": settings.pct_201_odoo17_port,
        "block_exploits": True,
        "allow_websocket_upgrade": True,
        "meta": {"pct": 201, "role": "odoo17-tenant", "tenant": "techeels"},
    },
    {
        "domain_names": ["evolucionamujer.com", "www.evolucionamujer.com"],
        "forward_scheme": "http",
        "forward_host": settings.pct_201_odoo17_host,
        "forward_port": settings.pct_201_odoo17_port,
        "block_exploits": True,
        "allow_websocket_upgrade": True,
        "meta": {"pct": 201, "role": "odoo17-tenant", "tenant": "techeels"},
    },
    {
        "domain_names": ["impulse-max.com", "www.impulse-max.com"],
        "forward_scheme": "http",
        "forward_host": settings.pct_201_odoo17_host,
        "forward_port": settings.pct_201_odoo17_port,
        "block_exploits": True,
        "allow_websocket_upgrade": True,
        "meta": {"pct": 201, "role": "odoo17-tenant", "tenant": "techeels"},
    },
    {
        "domain_names": ["jeturing.com", "www.jeturing.com"],
        "forward_scheme": "http",
        "forward_host": settings.pct_204_odoo19_host,
        "forward_port": settings.pct_204_odoo19_port,
        "block_exploits": True,
        "allow_websocket_upgrade": True,
        "meta": {"pct": 204, "role": "odoo19"},
    },
    {
        "domain_names": ["mail.sajet.us"],
        "forward_scheme": "https",
        "forward_host": settings.pct_206_postal_host,
        "forward_port": settings.pct_206_postal_http_port,
        "block_exploits": True,
        "meta": {"pct": 206, "role": "postal-mail"},
    },
]


@router.get("/", summary="Listar todos los proxy hosts")
async def list_proxy_hosts():
    """Lista todos los proxy hosts configurados en NPM."""
    return await npm_client.list_proxy_hosts()


@router.post("/", response_model=dict, summary="Crear un proxy host")
async def create_proxy_host(host: ProxyHostCreate):
    """
    Crea un nuevo proxy host en NPM.
    Wrapper sobre la API nativa con validación adicional.
    """
    payload = {
        "domain_names": host.domain_names,
        "forward_scheme": host.forward_scheme.value,
        "forward_host": host.forward_host,
        "forward_port": host.forward_port,
        "ssl_forced": host.ssl_forced,
        "block_exploits": host.block_exploits,
        "allow_websocket_upgrade": host.allow_websocket_upgrade,
        "caching_enabled": host.cache_assets,
        "access_list_id": host.access_list_id,
        "advanced_config": host.advanced_config,
        "meta": host.meta,
    }
    return await npm_client.create_proxy_host(payload)


@router.delete("/{host_id}", summary="Eliminar un proxy host")
async def delete_proxy_host(host_id: int):
    """Elimina un proxy host por ID."""
    await npm_client.delete_proxy_host(host_id)
    return StatusResponse(message=f"Proxy host {host_id} eliminado")


@router.post("/{host_id}/enable", summary="Habilitar proxy host")
async def enable_proxy_host(host_id: int):
    return await npm_client.enable_proxy_host(host_id)


@router.post("/{host_id}/disable", summary="Deshabilitar proxy host")
async def disable_proxy_host(host_id: int):
    return await npm_client.disable_proxy_host(host_id)


@router.post("/seed", response_model=StatusResponse, summary="Seed masivo de proxy hosts")
async def seed_proxy_hosts(req: ProxyHostSeed):
    """
    Crea todos los proxy hosts por defecto para la infraestructura Jeturing.
    Incluye: sajet.us, *.sajet.us tenants, jeturing.com, mail.sajet.us, proxy.sajet.us.

    ⚠️ Con purge_existing=True elimina todos los existentes primero.
    """
    if not req.confirm:
        raise HTTPException(400, "Debes confirmar con confirm=true")

    results = {"created": [], "errors": [], "deleted": []}

    # Purge si se solicita
    if req.purge_existing:
        existing = await npm_client.list_proxy_hosts()
        for h in existing:
            try:
                await npm_client.delete_proxy_host(h["id"])
                results["deleted"].append(h["id"])
            except Exception as e:
                results["errors"].append({"id": h["id"], "error": str(e)})

    # Crear hosts por defecto
    for host_def in DEFAULT_HOSTS:
        try:
            created = await npm_client.create_proxy_host(host_def)
            results["created"].append({
                "id": created.get("id"),
                "domains": host_def["domain_names"],
            })
        except Exception as e:
            results["errors"].append({
                "domains": host_def["domain_names"],
                "error": str(e),
            })

    return StatusResponse(
        success=len(results["errors"]) == 0,
        message=f"Seed completado: {len(results['created'])} creados, {len(results['errors'])} errores",
        data=results,
    )
