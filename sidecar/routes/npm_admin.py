"""
Router: NPM Admin — Operaciones administrativas sobre NPM.
Usuarios, certificados, settings, audit log, reports.
"""

from fastapi import APIRouter
from npm_client import npm_client
from schemas import StatusResponse

router = APIRouter(prefix="/npm", tags=["NPM Admin"])


@router.get("/reports", summary="Dashboard de NPM")
async def npm_reports():
    """Obtiene estadísticas de hosts (proxy, redirection, dead, streams)."""
    return await npm_client.get_reports()


@router.get("/certificates", summary="Listar certificados SSL")
async def list_certificates():
    """Lista todos los certificados SSL gestionados por NPM."""
    return await npm_client.list_certificates()


@router.post("/certificates/{cert_id}/renew", summary="Renovar certificado Let's Encrypt")
async def renew_certificate(cert_id: int):
    """Renueva un certificado Let's Encrypt por ID."""
    return await npm_client.renew_certificate(cert_id)


@router.get("/users", summary="Listar usuarios de NPM")
async def list_users():
    """Lista todos los usuarios del panel de NPM."""
    return await npm_client.list_users()


@router.get("/access-lists", summary="Listar Access Lists")
async def list_access_lists():
    """Lista todas las access lists (IP/Basic Auth)."""
    return await npm_client.list_access_lists()


@router.get("/streams", summary="Listar TCP/UDP streams")
async def list_streams():
    """Lista todos los streams TCP/UDP configurados."""
    return await npm_client.list_streams()


@router.get("/redirection-hosts", summary="Listar redirection hosts")
async def list_redirection_hosts():
    """Lista todos los hosts de redirección."""
    return await npm_client.list_redirection_hosts()


@router.get("/settings", summary="Obtener configuración de NPM")
async def get_settings():
    """Obtiene la configuración global de NPM."""
    return await npm_client.get_settings()


@router.get("/audit-log", summary="Log de auditoría")
async def get_audit_log():
    """Obtiene el log de auditoría de NPM (últimas acciones)."""
    return await npm_client.get_audit_log()


@router.get("/health", summary="Health check de NPM")
async def npm_health():
    """Verifica que la API interna de NPM esté respondiendo."""
    try:
        result = await npm_client.health()
        return StatusResponse(success=True, message="NPM API healthy", data=result)
    except Exception as e:
        return StatusResponse(success=False, message=f"NPM API error: {str(e)}")
