"""
Router: Health & Service Discovery
Monitorea la salud de todos los servicios en la infraestructura.
"""

import asyncio
import time
import httpx
from fastapi import APIRouter
from schemas import ServiceHealth, HealthResponse, ServiceInfo, ServiceStatus
from config import settings

router = APIRouter(prefix="/health", tags=["Health & Services"])

# ──── Mapa de servicios conocidos ────
SERVICES = [
    {"pct": 200, "name": "PostgreSQL Primary",  "ip": settings.pct_200_pg_host,     "port": settings.pct_200_pg_port,     "role": "database",     "check": "tcp", "domains": []},
    {"pct": 201, "name": "Odoo 17 Multi-tenant","ip": settings.pct_201_odoo17_host,  "port": settings.pct_201_odoo17_port, "role": "erp-odoo17",   "check": "http", "domains": ["*.sajet.us", "agroliferd.com", "boletly.com", "techeels.io"]},
    {"pct": 202, "name": "SAJET ERP Core",      "ip": settings.pct_202_sajet_host,   "port": settings.pct_202_sajet_port,  "role": "erp-core",     "check": "http", "domains": ["sajet.us"]},
    {"pct": 203, "name": "Redis Cache",          "ip": settings.pct_203_redis_host,   "port": settings.pct_203_redis_port,  "role": "cache",        "check": "tcp", "domains": []},
    {"pct": 204, "name": "Odoo 19 Jeturing",    "ip": settings.pct_204_odoo19_host,  "port": settings.pct_204_odoo19_port, "role": "erp-odoo19",   "check": "http", "domains": ["jeturing.com"]},
    {"pct": 205, "name": "NPM + Sidecar",       "ip": settings.pct_205_npm_host,     "port": 81,                           "role": "proxy-manager","check": "http", "domains": ["proxy.sajet.us"]},
    {"pct": 206, "name": "Postal Mail",          "ip": settings.pct_206_postal_host,  "port": settings.pct_206_postal_http_port, "role": "mail",    "check": "tcp", "domains": ["mail.sajet.us"]},
]


async def _check_tcp(ip: str, port: int, timeout: float = 3.0) -> tuple[ServiceStatus, float, str]:
    """Verifica conectividad TCP básica."""
    start = time.monotonic()
    try:
        _, writer = await asyncio.wait_for(
            asyncio.open_connection(ip, port), timeout=timeout
        )
        elapsed = (time.monotonic() - start) * 1000
        writer.close()
        await writer.wait_closed()
        return ServiceStatus.healthy, elapsed, "TCP OK"
    except asyncio.TimeoutError:
        return ServiceStatus.unreachable, 0, "Connection timeout"
    except Exception as e:
        return ServiceStatus.unhealthy, 0, str(e)


async def _check_http(ip: str, port: int, timeout: float = 5.0) -> tuple[ServiceStatus, float, str]:
    """Verifica servicio HTTP/HTTPS."""
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=timeout, verify=False) as client:
            url = f"http://{ip}:{port}/"
            resp = await client.get(url, follow_redirects=True)
            elapsed = (time.monotonic() - start) * 1000
            if resp.status_code < 500:
                return ServiceStatus.healthy, elapsed, f"HTTP {resp.status_code}"
            return ServiceStatus.unhealthy, elapsed, f"HTTP {resp.status_code}"
    except Exception as e:
        elapsed = (time.monotonic() - start) * 1000
        return ServiceStatus.unreachable, elapsed, str(e)


async def _check_service(svc: dict) -> ServiceHealth:
    """Ejecuta health check para un servicio."""
    check_fn = _check_http if svc["check"] == "http" else _check_tcp
    status, ms, detail = await check_fn(svc["ip"], svc["port"])
    return ServiceHealth(
        pct=svc["pct"],
        name=svc["name"],
        ip=svc["ip"],
        port=svc["port"],
        status=status,
        response_ms=round(ms, 2),
        detail=detail,
    )


@router.get("/", response_model=HealthResponse, summary="Health check de todos los servicios")
async def health_check_all():
    """
    Ejecuta health check en paralelo contra todos los servicios registrados.
    Retorna el estado de cada PCT, tiempos de respuesta y resumen.
    """
    results = await asyncio.gather(*[_check_service(s) for s in SERVICES])
    healthy_count = sum(1 for r in results if r.status == ServiceStatus.healthy)
    return HealthResponse(
        status="ok" if healthy_count == len(results) else "degraded",
        services=results,
        total=len(results),
        healthy=healthy_count,
        unhealthy=len(results) - healthy_count,
    )


@router.get("/{pct_id}", response_model=ServiceHealth, summary="Health check de un PCT específico")
async def health_check_single(pct_id: int):
    """Health check de un servicio específico por número de PCT."""
    svc = next((s for s in SERVICES if s["pct"] == pct_id), None)
    if not svc:
        from fastapi import HTTPException
        raise HTTPException(404, f"PCT {pct_id} no encontrado en el inventario")
    return await _check_service(svc)


@router.get("/services/inventory", response_model=list[ServiceInfo], summary="Inventario de servicios")
async def service_inventory():
    """
    Retorna el inventario completo de servicios registrados con sus IPs,
    puertos, roles y dominios asociados.
    """
    return [
        ServiceInfo(
            pct=s["pct"],
            name=s["name"],
            ip=s["ip"],
            ports=[s["port"]],
            role=s["role"],
            domains=s["domains"],
        )
        for s in SERVICES
    ]
