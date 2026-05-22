"""
Sidecar de Orquestacion - Jeturing Infrastructure API

API FastAPI que corre junto a Nginx Proxy Manager como sidecar.
Seguridad: Swagger/ReDoc/OpenAPI SOLO accesibles desde red interna o VPN.
Middleware de IP whitelisting: 10.10.20.0/24, 100.0.0.0/8 (Tailscale), 172.x (Docker)
"""

import ipaddress
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.httpx import HttpxIntegration
from npm_client import npm_client
from config import settings

from routes import health, proxy_hosts, tunnels, deploy, npm_admin, providers
from routes import settings_api, loadbalancer


def _sentry_should_drop_transaction(name: str, path: str) -> bool:
    text = f"{name} {path}".lower()
    ignored_prefixes = (
        "/docs",
        "/redoc",
        "/openapi.json",
        "/favicon",
        "/robots.txt",
    )
    return any(path.startswith(prefix) for prefix in ignored_prefixes) or "lifespan" in text


def _sentry_traces_sampler(sampling_context):
    transaction_context = sampling_context.get("transaction_context") or {}
    name = transaction_context.get("name", "")
    asgi_scope = sampling_context.get("asgi_scope") or {}
    path = asgi_scope.get("path", "") or ""
    if _sentry_should_drop_transaction(name, path):
        return 0.0
    return float(settings.sentry_trace_sample_rate)


def _sentry_before_send_transaction(event, hint):
    request = event.get("request") or {}
    url = request.get("url", "") or ""
    path = "/"
    if url:
        try:
            from urllib.parse import urlparse
            path = urlparse(url).path or "/"
        except Exception:
            path = "/"
    if _sentry_should_drop_transaction(event.get("transaction", "") or "", path):
        return None
    return event


if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.sentry_environment,
        server_name=settings.sentry_server_name,
        traces_sampler=_sentry_traces_sampler,
        integrations=[FastApiIntegration(), HttpxIntegration()],
        before_send_transaction=_sentry_before_send_transaction,
        auto_session_tracking=False,
    )


# ---- IP Whitelist ----
ALLOWED_NETWORKS = [
    ipaddress.ip_network("10.10.20.0/24"),     # Red interna PCTs
    ipaddress.ip_network("10.10.10.0/24"),     # Red legacy
    ipaddress.ip_network("100.0.0.0/8"),       # Tailscale VPN
    ipaddress.ip_network("172.16.0.0/12"),     # Docker internals
    ipaddress.ip_network("127.0.0.0/8"),       # Loopback
    ipaddress.ip_network("192.168.0.0/16"),    # LAN estandar
]

# Rutas protegidas: docs, redoc, openapi
PROTECTED_PATHS = {"/docs", "/redoc", "/openapi.json"}


def _get_client_ip(request: Request) -> str:
    """Extrae IP real del cliente (considera X-Forwarded-For de CF/NPM)."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    cf_ip = request.headers.get("cf-connecting-ip", "")
    if cf_ip:
        return cf_ip
    return request.client.host if request.client else "0.0.0.0"


def _is_internal(ip_str: str) -> bool:
    """Verifica si una IP esta en redes permitidas."""
    try:
        ip = ipaddress.ip_address(ip_str)
        return any(ip in net for net in ALLOWED_NETWORKS)
    except ValueError:
        return False


class NetworkGuardMiddleware(BaseHTTPMiddleware):
    """Bloquea acceso a rutas sensibles segun config dinamica."""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        client_ip = _get_client_ip(request)
        is_internal = _is_internal(client_ip)

        # Rutas de documentacion: decision segun settings
        if path in PROTECTED_PATHS:
            from routes.settings_api import get_current_settings, verify_api_key
            s = get_current_settings()

            # Docs deshabilitados globalmente
            if not s.get("docs_enabled", True):
                return JSONResponse(
                    status_code=404,
                    content={"detail": "Documentacion deshabilitada"},
                )

            # Verificar acceso: red interna O api_key valida
            if s.get("docs_require_internal", True) and not is_internal:
                # Intentar API key como alternativa
                api_key = (
                    request.query_params.get("api_key", "")
                    or request.headers.get("x-api-key", "")
                )
                if not (s.get("docs_api_key_enabled") and api_key and verify_api_key(api_key)):
                    return JSONResponse(
                        status_code=403,
                        content={"detail": "Documentacion solo accesible desde red interna, VPN o con API key valida"},
                    )

        # Inyectar info de red en el request state
        request.state.client_ip = client_ip
        request.state.is_internal = is_internal

        response = await call_next(request)
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / Shutdown."""
    print("Sidecar de Orquestacion iniciando...")
    print(f"   NPM API: {settings.npm_api_url}")
    print(f"   Red: {settings.network_subnet}")
    print(f"   Docs: SOLO red interna/VPN")
    yield
    await npm_client.close()
    print("Sidecar cerrado")


app = FastAPI(
    title="Jeturing Infrastructure Orchestration API",
    description="""
## API de Orquestacion de Infraestructura - Jeturing

Sidecar junto a **Nginx Proxy Manager** (NPM) para gestionar
la infraestructura de produccion.

### Acceso Restringido

**Swagger/ReDoc solo accesible desde red interna (10.10.20.x) o VPN (Tailscale).**
Intentos desde internet publico retornan 403.

### Modulos

| Tag | Funcion |
|-----|---------|
| **Health & Services** | Monitoreo de todos los PCTs e inventario |
| **Proxy Hosts** | CRUD de proxy hosts en NPM + seed masivo |
| **Cloudflare Tunnels** | Gestion de tunnels e ingress rules |
| **Providers** | Multi-proveedor: cada tenant trae su CF API key |
| **Deploy & Management** | Reinicio/actualizacion de servicios remotos |
| **NPM Admin** | Certificados, usuarios, audit log, settings |
| **Settings** | Config dinamica: visibilidad docs, API keys, CORS |
| **Load Balancer** | HAProxy-style LB multi-nodo con health checks |
    """,
    version="1.2.0",
    docs_url="/docs",
    redoc_url="/redoc",
    contact={"name": "SOC Jeturing", "email": "soc@jeturing.com"},
    license_info={"name": "Privado", "url": "https://jeturing.com"},
    lifespan=lifespan,
)

# Middleware de seguridad - PRIMERO
app.add_middleware(NetworkGuardMiddleware)

# CORS - solo redes internas
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://10.10.20.205:81",
        "http://10.10.20.205:8888",
        "https://sajet.us",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Routers ----
app.include_router(health.router)
app.include_router(proxy_hosts.router)
app.include_router(tunnels.router)
app.include_router(providers.router)
app.include_router(deploy.router)
app.include_router(npm_admin.router)
app.include_router(settings_api.router)
app.include_router(loadbalancer.router)


@app.get("/", tags=["Root"])
async def root(request: Request):
    client_ip = getattr(request.state, "client_ip", "unknown")
    is_internal = getattr(request.state, "is_internal", False)
    return {
        "service": "Jeturing Infrastructure Orchestration Sidecar",
        "version": "1.2.0",
        "docs": "/docs" if is_internal else "Solo VPN/red interna",
        "redoc": "/redoc" if is_internal else "Solo VPN/red interna",
        "npm_api": settings.npm_api_url,
        "client_ip": client_ip,
        "internal": is_internal,
    }
