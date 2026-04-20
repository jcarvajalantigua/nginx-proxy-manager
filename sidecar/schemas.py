"""
Schemas Pydantic para request/response de la API de Orquestacion.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


# ──── Enums ────

class ServiceStatus(str, Enum):
    healthy = "healthy"
    unhealthy = "unhealthy"
    unreachable = "unreachable"
    unknown = "unknown"


class ProxyScheme(str, Enum):
    http = "http"
    https = "https"


# ──── Health / Services ────

class ServiceHealth(BaseModel):
    pct: int = Field(..., description="Número de PCT")
    name: str = Field(..., description="Nombre del servicio")
    ip: str
    port: int
    status: ServiceStatus
    response_ms: Optional[float] = None
    detail: Optional[str] = None


class HealthResponse(BaseModel):
    status: str = "ok"
    services: list[ServiceHealth] = []
    total: int = 0
    healthy: int = 0
    unhealthy: int = 0


class ServiceInfo(BaseModel):
    pct: int
    name: str
    ip: str
    ports: list[int]
    role: str
    domains: list[str] = []
    status: ServiceStatus = ServiceStatus.unknown


# ──── Proxy Hosts ────

class ProxyHostCreate(BaseModel):
    domain_names: list[str] = Field(..., description="Lista de dominios")
    forward_scheme: ProxyScheme = ProxyScheme.http
    forward_host: str = Field(..., description="IP o hostname del upstream")
    forward_port: int = Field(..., description="Puerto del upstream")
    ssl_forced: bool = False
    block_exploits: bool = True
    allow_websocket_upgrade: bool = True
    cache_assets: bool = False
    access_list_id: int = 0
    advanced_config: str = ""
    meta: dict = {}


class ProxyHostResponse(BaseModel):
    id: int
    domain_names: list[str]
    forward_scheme: str
    forward_host: str
    forward_port: int
    ssl_forced: bool
    enabled: bool
    certificate_id: Optional[int] = None


class ProxyHostSeed(BaseModel):
    """Para el seed masivo de proxy hosts."""
    confirm: bool = Field(default=False, description="Confirmar seed (destruye existentes si purge=True)")
    purge_existing: bool = Field(default=False, description="Eliminar proxy hosts existentes antes del seed")


# ──── Cloudflare Tunnels ────

class TunnelCreate(BaseModel):
    name: str = Field(..., description="Nombre del tunnel")
    domain: str = Field(..., description="Dominio raíz, ej: sajet.us")


class TunnelIngressRule(BaseModel):
    hostname: str
    service: str
    path: Optional[str] = None


class TunnelConfigUpdate(BaseModel):
    tunnel_id: str
    ingress: list[TunnelIngressRule]


class TunnelInfo(BaseModel):
    id: str
    name: str
    status: str
    connections: int = 0
    ingress_rules: list[TunnelIngressRule] = []


# ──── Deploy ────

class DeployTarget(str, Enum):
    sajet = "sajet"      # PCT 202
    odoo17 = "odoo17"    # PCT 201
    odoo19 = "odoo19"    # PCT 204
    postal = "postal"    # PCT 206


class DeployRequest(BaseModel):
    target: DeployTarget
    action: str = Field(default="restart", description="restart | pull | update | status")
    branch: Optional[str] = None
    force: bool = False


class DeployResponse(BaseModel):
    target: str
    action: str
    success: bool
    output: str = ""
    duration_ms: float = 0


# ──── Generic ────

class StatusResponse(BaseModel):
    success: bool = True
    message: str = ""
    data: Optional[dict] = None


# ---- Providers (Multi-Cloudflare) ----

class ProviderCreate(BaseModel):
    """Crear un proveedor CF (cada tenant trae su propia API key)."""
    name: str = Field(..., description="Nombre del proveedor, ej: TecHeels")
    cf_api_token: str = Field(..., description="CF API Token del proveedor")
    cf_account_id: str = Field(..., description="CF Account ID del proveedor")
    zones: dict[str, str] = Field(
        default_factory=dict,
        description="Mapa dominio -> zone_id, ej: {'techeels.io': 'abc123'}"
    )
    tunnels: dict[str, str] = Field(
        default_factory=dict,
        description="Mapa nombre -> tunnel_id, ej: {'main': 'fe306...'}"
    )
    tunnel_token: Optional[str] = Field(None, description="Token del tunnel principal")
    domains: list[str] = Field(default_factory=list, description="Dominios gestionados")
    notes: str = ""


class ProviderUpdate(BaseModel):
    """Actualizar parcialmente un proveedor."""
    name: Optional[str] = None
    cf_api_token: Optional[str] = None
    cf_account_id: Optional[str] = None
    zones: Optional[dict[str, str]] = None
    tunnels: Optional[dict[str, str]] = None
    tunnel_token: Optional[str] = None
    domains: Optional[list[str]] = None
    notes: Optional[str] = None


class ProviderResponse(BaseModel):
    """Respuesta de proveedor (token parcialmente enmascarado)."""
    id: str
    name: str
    cf_account_id: str
    cf_api_token_hint: str = Field(..., description="Ultimos 8 chars del token")
    zones: dict[str, str] = {}
    tunnels: dict[str, str] = {}
    domains: list[str] = []
    notes: str = ""
    created_at: str = ""
    updated_at: str = ""


class ProviderTunnelCreate(BaseModel):
    """Crear un tunnel usando las credenciales del proveedor."""
    tunnel_name: str = Field(..., description="Nombre del nuevo tunnel")


class ProviderDNSCreate(BaseModel):
    """Crear registro DNS en zona del proveedor."""
    zone_domain: str = Field(..., description="Dominio de la zona, ej: techeels.io")
    record_name: str = Field(..., description="Subdominio, ej: app")
    record_type: str = Field(default="CNAME", description="Tipo: CNAME, A, AAAA")
    content: str = Field(..., description="Valor del registro")
    proxied: bool = True


class ProviderTunnelIngress(BaseModel):
    """Actualizar ingress rules del tunnel de un proveedor."""
    tunnel_name: str = Field(..., description="Nombre del tunnel a configurar")
    ingress: list[TunnelIngressRule] = Field(..., description="Reglas de ingress")
