"""
Configuración centralizada del Sidecar de Orquestación.
Variables de entorno con defaults sensatos.
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional


class Settings(BaseSettings):
    # --- NPM API ---
    npm_api_url: str = Field(default="http://npm:81/api", description="URL interna de la API de NPM")
    npm_admin_email: str = Field(default="soc@jeturing.com")
    npm_admin_password: str = Field(default="321Abcd.")

    # --- Cloudflare ---
    cf_api_token: str = Field(default="")
    cf_zone_id: str = Field(default="4a83b88793ac3688486ace69b6ae80f9", description="Zone ID sajet.us")
    cf_tunnel_id: str = Field(default="", description="Tunnel ID para NPM gateway")
    cf_account_id: str = Field(default="")

    # --- Red / Infraestructura ---
    network_subnet: str = Field(default="10.10.20.0/24")
    legacy_subnet: str = Field(default="10.10.10.0/24")

    # --- Servicios conocidos (PCT map) ---
    # Formato: nombre:ip:puerto:protocolo
    pct_200_pg_host: str = Field(default="10.10.20.200")
    pct_200_pg_port: int = Field(default=5432)
    pct_201_odoo17_host: str = Field(default="10.10.20.201")
    pct_201_odoo17_port: int = Field(default=80)
    pct_202_sajet_host: str = Field(default="10.10.20.202")
    pct_202_sajet_port: int = Field(default=4443)
    pct_203_redis_host: str = Field(default="10.10.20.203")
    pct_203_redis_port: int = Field(default=6379)
    pct_204_odoo19_host: str = Field(default="10.10.20.204")
    pct_204_odoo19_port: int = Field(default=80)
    pct_205_npm_host: str = Field(default="10.10.20.205")
    pct_206_postal_host: str = Field(default="10.10.20.206")
    pct_206_postal_http_port: int = Field(default=443)

    # --- SSH para deploy ---
    ssh_user: str = Field(default="root")
    ssh_key_path: str = Field(default="/app/ssh/id_rsa")

    # --- Sidecar ---
    sidecar_host: str = Field(default="0.0.0.0")
    sidecar_port: int = Field(default=8888)
    debug: bool = Field(default=False)

    # --- Seguridad ---
    api_key: str = Field(default="", description="API key para acceso externo (futuro)")
    providers_file: str = Field(default="/app/data/providers.json", description="Archivo JSON de providers")

    model_config = {"env_prefix": "SIDECAR_", "env_file": ".env", "extra": "ignore"}


settings = Settings()
