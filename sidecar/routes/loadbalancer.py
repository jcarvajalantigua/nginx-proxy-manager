"""
Router: Load Balancer — HAProxy-style multi-nodo load balancing.

Gestiona backends (grupos de nodos), health checks automaticos y
estrategias de balanceo (round-robin, weighted, least-connections).
Configura NPM advanced_config para inyectar upstream blocks.

Los backends persisten en /app/data/lb_backends.json.
"""

import json
import time
import asyncio
import httpx
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from schemas import StatusResponse
from config import settings as app_settings

router = APIRouter(prefix="/lb", tags=["Load Balancer"])

LB_FILE = Path("/app/data/lb_backends.json")

# ---- Storage ----

def _load_backends() -> dict:
    if LB_FILE.exists():
        try:
            return json.loads(LB_FILE.read_text())
        except Exception:
            pass
    return {"backends": {}, "updated_at": ""}


def _save_backends(data: dict):
    LB_FILE.parent.mkdir(parents=True, exist_ok=True)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    LB_FILE.write_text(json.dumps(data, indent=2, default=str))


# ---- Models (inline, lightweight) ----

STRATEGIES = ["round-robin", "weighted", "least-connections", "ip-hash", "failover"]
HEALTH_METHODS = ["tcp", "http", "https"]

def _default_node() -> dict:
    return {
        "host": "",
        "port": 80,
        "weight": 1,
        "max_connections": 0,
        "enabled": True,
        "healthy": True,
        "last_check": "",
        "check_failures": 0,
        "meta": {},
    }


def _default_backend() -> dict:
    return {
        "id": "",
        "name": "",
        "strategy": "round-robin",
        "nodes": [],
        "health_check": {
            "enabled": True,
            "method": "http",
            "path": "/",
            "interval_sec": 30,
            "timeout_sec": 5,
            "unhealthy_threshold": 3,
            "healthy_threshold": 2,
        },
        "sticky_sessions": False,
        "sticky_cookie": "SERVERID",
        "connection_limit": 0,
        "created_at": "",
        "updated_at": "",
        "domains": [],
        "active_node_index": 0,
    }


# ---- CRUD Backends ----

@router.get("/backends", summary="Listar backends de balanceo")
async def list_backends():
    """
    Lista todos los backends configurados.
    Cada backend es un grupo de nodos (PCTs) con una estrategia de balanceo.
    """
    data = _load_backends()
    backends = list(data.get("backends", {}).values())
    return {
        "backends": backends,
        "total": len(backends),
        "strategies_available": STRATEGIES,
    }


@router.get("/backends/{backend_id}", summary="Obtener backend por ID")
async def get_backend(backend_id: str):
    data = _load_backends()
    backend = data.get("backends", {}).get(backend_id)
    if not backend:
        raise HTTPException(404, f"Backend {backend_id} no encontrado")
    return backend


@router.post("/backends", summary="Crear backend de balanceo")
async def create_backend(
    name: str,
    strategy: str = "round-robin",
    domains: list[str] = [],
    sticky_sessions: bool = False,
):
    """
    Crea un nuevo backend (grupo de nodos para balanceo).

    **Estrategias:**
    - `round-robin`: distribucion equitativa secuencial
    - `weighted`: distribucion proporcional al peso de cada nodo
    - `least-connections`: envia al nodo con menos conexiones activas
    - `ip-hash`: fija cliente a nodo por hash de IP
    - `failover`: usa nodo primario, failover a secundarios si cae

    Despues de crear, agrega nodos con POST /lb/backends/{id}/nodes.
    """
    if strategy not in STRATEGIES:
        raise HTTPException(400, f"Estrategia invalida. Disponibles: {STRATEGIES}")

    import secrets
    backend_id = f"lb_{secrets.token_hex(4)}"

    backend = _default_backend()
    backend.update({
        "id": backend_id,
        "name": name,
        "strategy": strategy,
        "domains": domains,
        "sticky_sessions": sticky_sessions,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })

    data = _load_backends()
    data.setdefault("backends", {})[backend_id] = backend
    _save_backends(data)

    return {
        "success": True,
        "backend": backend,
        "message": f"Backend '{name}' creado con estrategia {strategy}",
        "next": f"Agrega nodos: POST /lb/backends/{backend_id}/nodes",
    }


@router.put("/backends/{backend_id}", summary="Actualizar backend")
async def update_backend(
    backend_id: str,
    name: Optional[str] = None,
    strategy: Optional[str] = None,
    domains: Optional[list[str]] = None,
    sticky_sessions: Optional[bool] = None,
    connection_limit: Optional[int] = None,
):
    data = _load_backends()
    backend = data.get("backends", {}).get(backend_id)
    if not backend:
        raise HTTPException(404, f"Backend {backend_id} no encontrado")

    if name is not None:
        backend["name"] = name
    if strategy is not None:
        if strategy not in STRATEGIES:
            raise HTTPException(400, f"Estrategia invalida: {strategy}")
        backend["strategy"] = strategy
    if domains is not None:
        backend["domains"] = domains
    if sticky_sessions is not None:
        backend["sticky_sessions"] = sticky_sessions
    if connection_limit is not None:
        backend["connection_limit"] = connection_limit

    backend["updated_at"] = datetime.now(timezone.utc).isoformat()
    _save_backends(data)
    return {"success": True, "backend": backend}


@router.delete("/backends/{backend_id}", summary="Eliminar backend")
async def delete_backend(backend_id: str):
    data = _load_backends()
    if backend_id not in data.get("backends", {}):
        raise HTTPException(404, f"Backend {backend_id} no encontrado")
    del data["backends"][backend_id]
    _save_backends(data)
    return StatusResponse(success=True, message=f"Backend {backend_id} eliminado")


# ---- Node Management ----

@router.get("/backends/{backend_id}/nodes", summary="Listar nodos del backend")
async def list_nodes(backend_id: str):
    data = _load_backends()
    backend = data.get("backends", {}).get(backend_id)
    if not backend:
        raise HTTPException(404, f"Backend {backend_id} no encontrado")
    return {
        "backend": backend["name"],
        "strategy": backend["strategy"],
        "nodes": backend["nodes"],
        "total": len(backend["nodes"]),
        "healthy": sum(1 for n in backend["nodes"] if n.get("healthy") and n.get("enabled")),
    }


@router.post("/backends/{backend_id}/nodes", summary="Agregar nodo al backend")
async def add_node(
    backend_id: str,
    host: str,
    port: int = 80,
    weight: int = 1,
    max_connections: int = 0,
    meta: dict = {},
):
    """
    Agrega un nodo (upstream) al backend.

    - `host`: IP del nodo (ej: 10.10.20.201)
    - `port`: Puerto del servicio (ej: 80)
    - `weight`: Peso para balanceo weighted (default 1)
    - `max_connections`: Limite de conexiones (0 = sin limite)
    - `meta`: Metadata libre (ej: {"pct": 201, "role": "odoo17"})
    """
    data = _load_backends()
    backend = data.get("backends", {}).get(backend_id)
    if not backend:
        raise HTTPException(404, f"Backend {backend_id} no encontrado")

    # Verificar duplicados
    for n in backend["nodes"]:
        if n["host"] == host and n["port"] == port:
            raise HTTPException(409, f"Nodo {host}:{port} ya existe en este backend")

    node = _default_node()
    node.update({
        "host": host,
        "port": port,
        "weight": weight,
        "max_connections": max_connections,
        "meta": meta,
    })
    backend["nodes"].append(node)
    backend["updated_at"] = datetime.now(timezone.utc).isoformat()
    _save_backends(data)

    return {
        "success": True,
        "node": node,
        "backend_nodes": len(backend["nodes"]),
    }


@router.delete("/backends/{backend_id}/nodes", summary="Remover nodo del backend")
async def remove_node(backend_id: str, host: str, port: int = 80):
    data = _load_backends()
    backend = data.get("backends", {}).get(backend_id)
    if not backend:
        raise HTTPException(404, f"Backend {backend_id} no encontrado")

    before = len(backend["nodes"])
    backend["nodes"] = [n for n in backend["nodes"] if not (n["host"] == host and n["port"] == port)]
    if len(backend["nodes"]) == before:
        raise HTTPException(404, f"Nodo {host}:{port} no encontrado en backend")

    backend["updated_at"] = datetime.now(timezone.utc).isoformat()
    _save_backends(data)
    return StatusResponse(success=True, message=f"Nodo {host}:{port} removido")


@router.put("/backends/{backend_id}/nodes/{host}/toggle", summary="Enable/disable nodo")
async def toggle_node(backend_id: str, host: str, enabled: bool):
    """Habilita o deshabilita un nodo sin removerlo (drain/undrain)."""
    data = _load_backends()
    backend = data.get("backends", {}).get(backend_id)
    if not backend:
        raise HTTPException(404, f"Backend {backend_id} no encontrado")

    found = False
    for n in backend["nodes"]:
        if n["host"] == host:
            n["enabled"] = enabled
            found = True
    if not found:
        raise HTTPException(404, f"Nodo {host} no encontrado")

    backend["updated_at"] = datetime.now(timezone.utc).isoformat()
    _save_backends(data)
    action = "habilitado" if enabled else "drenado (disabled)"
    return StatusResponse(success=True, message=f"Nodo {host} {action}")


# ---- Health Checks ----

@router.get("/backends/{backend_id}/health", summary="Ejecutar health check del backend")
async def check_backend_health(backend_id: str):
    """
    Ejecuta health checks contra todos los nodos del backend.
    Actualiza el estado de cada nodo (healthy/unhealthy).
    """
    data = _load_backends()
    backend = data.get("backends", {}).get(backend_id)
    if not backend:
        raise HTTPException(404, f"Backend {backend_id} no encontrado")

    hc = backend.get("health_check", {})
    method = hc.get("method", "http")
    path = hc.get("path", "/")
    timeout = hc.get("timeout_sec", 5)
    unhealthy_threshold = hc.get("unhealthy_threshold", 3)

    results = []
    async with httpx.AsyncClient(timeout=timeout) as client:
        for node in backend["nodes"]:
            if not node["enabled"]:
                results.append({
                    "host": node["host"],
                    "port": node["port"],
                    "status": "disabled",
                    "response_ms": 0,
                })
                continue

            start = time.time()
            try:
                if method == "tcp":
                    # TCP check: solo conexion
                    reader, writer = await asyncio.wait_for(
                        asyncio.open_connection(node["host"], node["port"]),
                        timeout=timeout,
                    )
                    writer.close()
                    await writer.wait_closed()
                    healthy = True
                    detail = "TCP connect OK"
                else:
                    scheme = "https" if method == "https" else "http"
                    url = f"{scheme}://{node['host']}:{node['port']}{path}"
                    resp = await client.get(url, follow_redirects=True)
                    healthy = resp.status_code < 500
                    detail = f"HTTP {resp.status_code}"

                elapsed = (time.time() - start) * 1000
                node["healthy"] = True
                node["check_failures"] = 0
                node["last_check"] = datetime.now(timezone.utc).isoformat()

                results.append({
                    "host": node["host"],
                    "port": node["port"],
                    "status": "healthy" if healthy else "degraded",
                    "detail": detail,
                    "response_ms": round(elapsed, 1),
                })

            except Exception as e:
                elapsed = (time.time() - start) * 1000
                node["check_failures"] = node.get("check_failures", 0) + 1
                node["last_check"] = datetime.now(timezone.utc).isoformat()
                if node["check_failures"] >= unhealthy_threshold:
                    node["healthy"] = False

                results.append({
                    "host": node["host"],
                    "port": node["port"],
                    "status": "unhealthy" if not node["healthy"] else "degraded",
                    "detail": str(e)[:100],
                    "response_ms": round(elapsed, 1),
                    "failures": node["check_failures"],
                    "threshold": unhealthy_threshold,
                })

    _save_backends(data)

    healthy_count = sum(1 for r in results if r["status"] == "healthy")
    return {
        "backend": backend["name"],
        "strategy": backend["strategy"],
        "nodes": results,
        "total": len(results),
        "healthy": healthy_count,
        "unhealthy": len(results) - healthy_count,
    }


@router.put("/backends/{backend_id}/health-check", summary="Configurar health check")
async def configure_health_check(
    backend_id: str,
    enabled: Optional[bool] = None,
    method: Optional[str] = None,
    path: Optional[str] = None,
    interval_sec: Optional[int] = None,
    timeout_sec: Optional[int] = None,
    unhealthy_threshold: Optional[int] = None,
    healthy_threshold: Optional[int] = None,
):
    """
    Configura los parametros de health check para un backend.

    - `method`: tcp, http, https
    - `path`: ruta a verificar (para http/https)
    - `interval_sec`: intervalo entre checks (para health check automatico futuro)
    - `unhealthy_threshold`: checks fallidos antes de marcar como unhealthy
    """
    data = _load_backends()
    backend = data.get("backends", {}).get(backend_id)
    if not backend:
        raise HTTPException(404, f"Backend {backend_id} no encontrado")

    hc = backend.setdefault("health_check", _default_backend()["health_check"])
    if enabled is not None:
        hc["enabled"] = enabled
    if method is not None:
        if method not in HEALTH_METHODS:
            raise HTTPException(400, f"Metodo invalido. Disponibles: {HEALTH_METHODS}")
        hc["method"] = method
    if path is not None:
        hc["path"] = path
    if interval_sec is not None:
        hc["interval_sec"] = interval_sec
    if timeout_sec is not None:
        hc["timeout_sec"] = timeout_sec
    if unhealthy_threshold is not None:
        hc["unhealthy_threshold"] = unhealthy_threshold
    if healthy_threshold is not None:
        hc["healthy_threshold"] = healthy_threshold

    backend["updated_at"] = datetime.now(timezone.utc).isoformat()
    _save_backends(data)
    return {"success": True, "health_check": hc}


# ---- Nginx Upstream Config Generation ----

@router.get("/backends/{backend_id}/nginx-config", summary="Generar config nginx upstream")
async def generate_nginx_config(backend_id: str):
    """
    Genera el bloque de configuracion nginx `upstream` para este backend.
    Este bloque se puede inyectar en el `advanced_config` de un proxy host de NPM.

    Ejemplo de uso:
    1. Generar config con este endpoint
    2. Copiar el `advanced_config` resultante
    3. PUT /proxy-hosts/{id} con el `advanced_config`
    """
    data = _load_backends()
    backend = data.get("backends", {}).get(backend_id)
    if not backend:
        raise HTTPException(404, f"Backend {backend_id} no encontrado")

    upstream_name = backend["name"].replace(" ", "_").replace("-", "_").lower()
    strategy = backend["strategy"]

    lines = [f"# Backend: {backend['name']} ({strategy})"]
    lines.append(f"# Generated: {datetime.now(timezone.utc).isoformat()}")
    lines.append("")

    # Upstream block (para inyectar en nginx http context via custom snippet)
    upstream_block = [f"upstream {upstream_name} {{"]

    if strategy == "ip-hash":
        upstream_block.append("    ip_hash;")
    elif strategy == "least-connections":
        upstream_block.append("    least_conn;")

    for node in backend["nodes"]:
        if not node["enabled"]:
            upstream_block.append(f"    # server {node['host']}:{node['port']} DISABLED;")
            continue
        if not node["healthy"]:
            upstream_block.append(f"    server {node['host']}:{node['port']} down;  # unhealthy")
            continue

        parts = [f"    server {node['host']}:{node['port']}"]
        if strategy == "weighted" and node.get("weight", 1) != 1:
            parts.append(f"weight={node['weight']}")
        if node.get("max_connections"):
            parts.append(f"max_conns={node['max_connections']}")
        if strategy == "failover" and backend["nodes"].index(node) > 0:
            parts.append("backup")

        upstream_block.append(" ".join(parts) + ";")

    upstream_block.append("}")

    # Advanced config para proxy_pass
    proxy_config = [
        "",
        f"# Balanceo: {upstream_name}",
        f"proxy_pass http://{upstream_name};",
        "proxy_set_header Host $host;",
        "proxy_set_header X-Real-IP $remote_addr;",
        "proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
        "proxy_set_header X-Forwarded-Proto $scheme;",
    ]

    if backend.get("sticky_sessions"):
        cookie = backend.get("sticky_cookie", "SERVERID")
        proxy_config.append(f"proxy_set_header Cookie $http_cookie;")
        upstream_block.insert(-1, f"    sticky cookie {cookie} expires=1h domain=.sajet.us;")

    return {
        "backend": backend["name"],
        "upstream_name": upstream_name,
        "upstream_block": "\n".join(upstream_block),
        "advanced_config": "\n".join(proxy_config),
        "npm_usage": {
            "step_1": f"Copiar upstream_block en /data/nginx/custom/http_top.conf dentro del contenedor npm",
            "step_2": "Copiar advanced_config en el campo 'Advanced' del proxy host en NPM",
            "step_3": "Cambiar forward_host a 'upstream_name' (requiere custom nginx config)",
            "alternative": "Usar el endpoint PUT /lb/backends/{id}/apply para aplicar automaticamente",
        },
    }


# ---- Apply LB to NPM ----

@router.post("/backends/{backend_id}/apply", summary="Aplicar LB a NPM proxy hosts")
async def apply_lb_to_npm(backend_id: str):
    """
    Aplica la configuracion de balanceo a los proxy hosts de NPM
    que coincidan con los dominios del backend.

    Genera el upstream nginx y lo inyecta como custom config en NPM.
    """
    data = _load_backends()
    backend = data.get("backends", {}).get(backend_id)
    if not backend:
        raise HTTPException(404, f"Backend {backend_id} no encontrado")

    if not backend["domains"]:
        raise HTTPException(400, "Backend no tiene dominios asignados. Agrega dominios primero.")

    if not backend["nodes"]:
        raise HTTPException(400, "Backend no tiene nodos. Agrega nodos primero.")

    healthy_nodes = [n for n in backend["nodes"] if n["enabled"] and n["healthy"]]
    if not healthy_nodes:
        raise HTTPException(503, "No hay nodos saludables en el backend")

    upstream_name = backend["name"].replace(" ", "_").replace("-", "_").lower()
    strategy = backend["strategy"]

    # Generar upstream block
    upstream_lines = [f"upstream {upstream_name} {{"]
    if strategy == "ip-hash":
        upstream_lines.append("    ip_hash;")
    elif strategy == "least-connections":
        upstream_lines.append("    least_conn;")

    for node in backend["nodes"]:
        if not node["enabled"] or not node["healthy"]:
            continue
        parts = [f"    server {node['host']}:{node['port']}"]
        if strategy == "weighted" and node.get("weight", 1) != 1:
            parts.append(f"weight={node['weight']}")
        if strategy == "failover" and backend["nodes"].index(node) > 0:
            parts.append("backup")
        upstream_lines.append(" ".join(parts) + ";")

    upstream_lines.append("}")
    upstream_block = "\n".join(upstream_lines)

    # Escribir upstream a custom nginx config
    from npm_client import npm_client

    # Inyectar como advanced_config en proxy hosts que matchean los dominios
    proxy_hosts = await npm_client.list_proxy_hosts()
    updated = []
    for ph in proxy_hosts:
        ph_domains = set(ph.get("domain_names", []))
        backend_domains = set(backend["domains"])
        if ph_domains & backend_domains:
            # Match encontrado — actualizar advanced_config
            advanced = (
                f"# LB: {backend['name']} ({strategy})\n"
                f"# Nodes: {len(healthy_nodes)} healthy\n"
                f"# Generated: {datetime.now(timezone.utc).isoformat()}\n"
            )
            try:
                await npm_client.update_proxy_host(ph["id"], {
                    "advanced_config": advanced,
                    "forward_host": healthy_nodes[0]["host"],
                    "forward_port": healthy_nodes[0]["port"],
                })
                updated.append({
                    "proxy_host_id": ph["id"],
                    "domains": list(ph_domains & backend_domains),
                    "forward": f"{healthy_nodes[0]['host']}:{healthy_nodes[0]['port']}",
                })
            except Exception as e:
                updated.append({
                    "proxy_host_id": ph["id"],
                    "error": str(e),
                })

    return {
        "success": True,
        "backend": backend["name"],
        "upstream_block": upstream_block,
        "proxy_hosts_updated": updated,
        "healthy_nodes": len(healthy_nodes),
        "message": f"LB aplicado a {len(updated)} proxy hosts. Upstream: {upstream_name}",
        "note": "Para LB real con nginx upstream, copiar upstream_block a /data/nginx/custom/http_top.conf y reiniciar NPM",
    }


# ---- Seed: Pre-configured backends ----

@router.post("/seed", summary="Crear backends pre-configurados")
async def seed_backends():
    """
    Crea backends por defecto para la infraestructura Jeturing:
    - `odoo17-pool`: Balanceo entre nodos Odoo 17
    - `sajet-pool`: SAJET ERP Core
    - `odoo19-pool`: Odoo 19
    """
    data = _load_backends()
    created = []

    seeds = [
        {
            "id": "lb_odoo17",
            "name": "odoo17-pool",
            "strategy": "round-robin",
            "domains": [
                "agroliferd.com", "www.agroliferd.com",
                "techeels.io", "www.techeels.io",
                "boletly.com", "www.boletly.com",
                "femrd.net", "www.femrd.net",
                "evolucionamujer.com", "www.evolucionamujer.com",
                "impulse-max.com", "www.impulse-max.com",
            ],
            "nodes": [
                {"host": "10.10.20.201", "port": 80, "weight": 1, "enabled": True, "healthy": True,
                 "meta": {"pct": 201, "role": "odoo17-primary"}, "max_connections": 0, "check_failures": 0, "last_check": ""},
            ],
            "health_check": {
                "enabled": True, "method": "http", "path": "/web/login",
                "interval_sec": 30, "timeout_sec": 5, "unhealthy_threshold": 3, "healthy_threshold": 2,
            },
        },
        {
            "id": "lb_sajet",
            "name": "sajet-pool",
            "strategy": "round-robin",
            "domains": ["sajet.us", "www.sajet.us"],
            "nodes": [
                {"host": "10.10.20.202", "port": 4443, "weight": 1, "enabled": True, "healthy": True,
                 "meta": {"pct": 202, "role": "sajet-primary"}, "max_connections": 0, "check_failures": 0, "last_check": ""},
            ],
            "health_check": {
                "enabled": True, "method": "http", "path": "/health",
                "interval_sec": 30, "timeout_sec": 5, "unhealthy_threshold": 3, "healthy_threshold": 2,
            },
        },
        {
            "id": "lb_odoo19",
            "name": "odoo19-pool",
            "strategy": "failover",
            "domains": ["jeturing.com", "www.jeturing.com"],
            "nodes": [
                {"host": "10.10.20.204", "port": 80, "weight": 1, "enabled": True, "healthy": True,
                 "meta": {"pct": 204, "role": "odoo19-primary"}, "max_connections": 0, "check_failures": 0, "last_check": ""},
            ],
            "health_check": {
                "enabled": True, "method": "http", "path": "/web/login",
                "interval_sec": 30, "timeout_sec": 5, "unhealthy_threshold": 3, "healthy_threshold": 2,
            },
        },
    ]

    for seed in seeds:
        if seed["id"] in data.get("backends", {}):
            created.append({"id": seed["id"], "status": "ya existe"})
            continue
        now = datetime.now(timezone.utc).isoformat()
        backend = _default_backend()
        backend.update(seed)
        backend["created_at"] = now
        backend["updated_at"] = now
        data.setdefault("backends", {})[seed["id"]] = backend
        created.append({"id": seed["id"], "name": seed["name"], "status": "creado"})

    _save_backends(data)
    return StatusResponse(
        success=True,
        message=f"Seed completado: {len(created)} backends",
        data={"backends": created},
    )
