"""
Cliente para la API REST nativa de Nginx Proxy Manager.
Maneja autenticación JWT y todas las operaciones CRUD.
"""

import httpx
import asyncio
from typing import Optional
from config import settings


class NPMClient:
    """Cliente async para NPM API."""

    def __init__(self):
        self.base_url = settings.npm_api_url
        self._token: Optional[str] = None
        self._client = httpx.AsyncClient(timeout=30.0)

    async def _ensure_auth(self):
        """Obtener o refrescar JWT token de NPM."""
        if self._token:
            return
        resp = await self._client.post(
            f"{self.base_url}/tokens",
            json={
                "identity": settings.npm_admin_email,
                "secret": settings.npm_admin_password,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        self._token = data.get("token")

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self._token}"}

    async def _request(self, method: str, path: str, **kwargs) -> dict:
        """Request autenticado a NPM API."""
        await self._ensure_auth()
        resp = await self._client.request(
            method, f"{self.base_url}{path}", headers=self._headers(), **kwargs
        )
        if resp.status_code == 401:
            # Token expirado, re-auth
            self._token = None
            await self._ensure_auth()
            resp = await self._client.request(
                method, f"{self.base_url}{path}", headers=self._headers(), **kwargs
            )
        resp.raise_for_status()
        return resp.json() if resp.content else {}

    # ──── Health ────

    async def health(self) -> dict:
        """GET /api/ — health check de NPM."""
        resp = await self._client.get(f"{self.base_url}/")
        return resp.json()

    # ──── Proxy Hosts ────

    async def list_proxy_hosts(self) -> list[dict]:
        return await self._request("GET", "/nginx/proxy-hosts")

    async def get_proxy_host(self, host_id: int) -> dict:
        return await self._request("GET", f"/nginx/proxy-hosts/{host_id}")

    async def create_proxy_host(self, data: dict) -> dict:
        return await self._request("POST", "/nginx/proxy-hosts", json=data)

    async def update_proxy_host(self, host_id: int, data: dict) -> dict:
        return await self._request("PUT", f"/nginx/proxy-hosts/{host_id}", json=data)

    async def delete_proxy_host(self, host_id: int) -> dict:
        return await self._request("DELETE", f"/nginx/proxy-hosts/{host_id}")

    async def enable_proxy_host(self, host_id: int) -> dict:
        return await self._request("POST", f"/nginx/proxy-hosts/{host_id}/enable")

    async def disable_proxy_host(self, host_id: int) -> dict:
        return await self._request("POST", f"/nginx/proxy-hosts/{host_id}/disable")

    # ──── Certificates ────

    async def list_certificates(self) -> list[dict]:
        return await self._request("GET", "/nginx/certificates")

    async def create_certificate(self, data: dict) -> dict:
        return await self._request("POST", "/nginx/certificates", json=data)

    async def renew_certificate(self, cert_id: int) -> dict:
        return await self._request("POST", f"/nginx/certificates/{cert_id}/renew")

    # ──── Streams (TCP/UDP) ────

    async def list_streams(self) -> list[dict]:
        return await self._request("GET", "/nginx/streams")

    async def create_stream(self, data: dict) -> dict:
        return await self._request("POST", "/nginx/streams", json=data)

    async def delete_stream(self, stream_id: int) -> dict:
        return await self._request("DELETE", f"/nginx/streams/{stream_id}")

    # ──── Redirection Hosts ────

    async def list_redirection_hosts(self) -> list[dict]:
        return await self._request("GET", "/nginx/redirection-hosts")

    async def create_redirection_host(self, data: dict) -> dict:
        return await self._request("POST", "/nginx/redirection-hosts", json=data)

    # ──── Access Lists ────

    async def list_access_lists(self) -> list[dict]:
        return await self._request("GET", "/nginx/access-lists")

    async def create_access_list(self, data: dict) -> dict:
        return await self._request("POST", "/nginx/access-lists", json=data)

    # ──── Users ────

    async def list_users(self) -> list[dict]:
        return await self._request("GET", "/users")

    async def create_user(self, data: dict) -> dict:
        return await self._request("POST", "/users", json=data)

    # ──── Settings ────

    async def get_settings(self) -> list[dict]:
        return await self._request("GET", "/settings")

    # ──── Reports ────

    async def get_reports(self) -> dict:
        return await self._request("GET", "/reports/hosts")

    # ──── Audit Log ────

    async def get_audit_log(self) -> list[dict]:
        return await self._request("GET", "/audit-log")

    async def close(self):
        await self._client.aclose()


# Singleton
npm_client = NPMClient()
