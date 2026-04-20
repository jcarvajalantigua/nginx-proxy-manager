"""
Router: Deploy & Service Management
Permite reiniciar, actualizar y monitorear servicios en los PCTs remotamente.
Usa SSH para ejecutar comandos en los contenedores.
"""

import asyncio
import time
from fastapi import APIRouter, HTTPException
from schemas import DeployRequest, DeployResponse, DeployTarget, StatusResponse
from config import settings

router = APIRouter(prefix="/deploy", tags=["Deploy & Management"])


# ──── Mapeo de acciones por target ────
DEPLOY_COMMANDS = {
    DeployTarget.sajet: {
        "pct": 202,
        "ip": settings.pct_202_sajet_host,
        "commands": {
            "status": "systemctl is-active sajet-api || echo 'inactive'",
            "restart": "systemctl restart sajet-api",
            "pull": "cd /opt/Erp_core && git pull origin main",
            "update": "cd /opt/Erp_core && git pull origin main && source .venv/bin/activate && pip install -r requirements.txt && systemctl restart sajet-api",
            "logs": "journalctl -u sajet-api --no-pager -n 50",
        },
    },
    DeployTarget.odoo17: {
        "pct": 201,
        "ip": settings.pct_201_odoo17_host,
        "commands": {
            "status": "systemctl list-units 'odoo-tenant@*' --state=running --no-pager",
            "restart": "systemctl restart 'odoo-tenant@*'",
            "logs": "journalctl -u 'odoo-tenant@*' --no-pager -n 50",
        },
    },
    DeployTarget.odoo19: {
        "pct": 204,
        "ip": settings.pct_204_odoo19_host,
        "commands": {
            "status": "systemctl is-active odoo || echo 'inactive'",
            "restart": "systemctl restart odoo",
            "logs": "journalctl -u odoo --no-pager -n 50",
        },
    },
    DeployTarget.postal: {
        "pct": 206,
        "ip": settings.pct_206_postal_host,
        "commands": {
            "status": "docker ps --format 'table {{.Names}}\\t{{.Status}}'",
            "restart": "cd /opt/postal && docker compose restart",
            "logs": "cd /opt/postal && docker compose logs --tail=50",
        },
    },
}


async def _ssh_exec(host: str, command: str, timeout: float = 60.0) -> tuple[bool, str]:
    """
    Ejecuta un comando SSH en un host remoto.
    Usa asyncio.subprocess para no bloquear.
    """
    try:
        proc = await asyncio.create_subprocess_exec(
            "ssh",
            "-o", "StrictHostKeyChecking=no",
            "-o", "ConnectTimeout=10",
            "-i", settings.ssh_key_path,
            f"{settings.ssh_user}@{host}",
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        output = stdout.decode() + stderr.decode()
        return proc.returncode == 0, output.strip()
    except asyncio.TimeoutError:
        return False, "Command timed out"
    except Exception as e:
        return False, f"SSH error: {str(e)}"


@router.post("/{target}", response_model=DeployResponse, summary="Ejecutar acción en un servicio")
async def deploy_action(target: DeployTarget, req: DeployRequest):
    """
    Ejecuta una acción (restart, pull, update, status, logs) en un PCT específico.

    Targets disponibles:
    - **sajet**: PCT 202 — FastAPI ERP Core
    - **odoo17**: PCT 201 — Odoo 17 multi-tenant
    - **odoo19**: PCT 204 — Odoo 19 jeturing.com
    - **postal**: PCT 206 — Postal mail server
    """
    config = DEPLOY_COMMANDS.get(target)
    if not config:
        raise HTTPException(404, f"Target {target} no configurado")

    action = req.action
    if action not in config["commands"]:
        available = list(config["commands"].keys())
        raise HTTPException(400, f"Acción '{action}' no válida. Disponibles: {available}")

    command = config["commands"][action]
    start = time.monotonic()
    success, output = await _ssh_exec(config["ip"], command)
    elapsed = (time.monotonic() - start) * 1000

    return DeployResponse(
        target=target.value,
        action=action,
        success=success,
        output=output,
        duration_ms=round(elapsed, 2),
    )


@router.get("/status/all", summary="Estado de todos los servicios")
async def status_all():
    """Obtiene el estado de todos los servicios en paralelo."""
    tasks = []
    for target, config in DEPLOY_COMMANDS.items():
        cmd = config["commands"].get("status", "echo 'no status command'")
        tasks.append(_ssh_exec(config["ip"], cmd))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    statuses = {}
    for (target, config), result in zip(DEPLOY_COMMANDS.items(), results):
        if isinstance(result, Exception):
            statuses[target.value] = {"pct": config["pct"], "status": "error", "detail": str(result)}
        else:
            success, output = result
            statuses[target.value] = {
                "pct": config["pct"],
                "status": "running" if success else "stopped",
                "detail": output[:500],
            }

    return StatusResponse(success=True, data=statuses)
