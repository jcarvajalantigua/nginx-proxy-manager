# 🔀 NPM Custom — Arquitectura

[![Versión](https://img.shields.io/badge/versión-2.14.0-blue)]()
[![Estado](https://img.shields.io/badge/estado-en%20uso-green)]()
[![Categoría](https://img.shields.io/badge/categoría-infraestructura%2Freverse--proxy-blue)]()
[![Autor](https://img.shields.io/badge/autor-Jeturing%20Inc%20(fork%20de%20Nginx%20Proxy%20Manager)-informational)]()

Despliegue personalizado de Nginx Proxy Manager (`jc21/nginx-proxy-manager`) con un sidecar de proxy inyectado y exposición dual: tráfico directo y vía túnel Cloudflare (`cloudflared`).

---

## 📋 Descripción

Es un fork del proyecto open-source Nginx Proxy Manager (README original preservado). `docker-compose.yml` define los contenedores `npm`, `npm-sidecar` y `npm-tunnel` (imagen `cloudflare/cloudflared`). `inject-sidecar-proxy.sh` inyecta post-arranque un bloque `location /sidecar-api/` en `production.conf` de Nginx que hace proxy hacia `npm-sidecar:8888`.

---

## 🏗️ Arquitectura / Diagrama

Diagrama generado con `archify`: [`architecture-diagram.html`](./architecture-diagram.html)

| Componente | Rol |
|---|---|
| `npm` | Nginx Proxy Manager: reverse proxy + terminación SSL + UI de administración |
| `npm-sidecar` | Servicio adicional expuesto vía `location /sidecar-api/` inyectado en la config de Nginx |
| `npm-tunnel` (cloudflared) | Ruta alterna de entrada de tráfico sin exponer IP pública directa |
| Admin UI (`frontend/`) | Panel de administración de proxy hosts, certificados y accesos |
| Backend API (`backend/app.js`) | Node.js + Knex; gestiona configuración, usuarios y certificados |
| Let's Encrypt (certbot) | Emisión/renovación de certificados SSL |

Decisiones de diseño relevantes:

- El sidecar se inyecta en tiempo de post-arranque (`inject-sidecar-proxy.sh`), no está compilado en la imagen base — debe ejecutarse tras cada `docker compose up/restart`, lo cual es un paso operativo explícito a no olvidar.
- Doble ruta de entrada (tráfico directo + túnel Cloudflare) permite continuidad si una de las dos rutas falla — UNKNOWN si ambas están activas simultáneamente en producción o si una es solo de respaldo.
- Mantiene el modelo de datos y migraciones (`backend/migrations`, `knexfile.js`) del proyecto upstream sin bifurcación de esquema documentada.

---

## 👥 Créditos

| Campo | Detalle |
|---|---|
| **Autor** | Jeturing Inc — fork operativo de Nginx Proxy Manager (jc21) |
