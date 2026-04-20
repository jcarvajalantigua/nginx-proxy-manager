#!/bin/bash
# ================================================================
# NPM Custom Frontend + Sidecar Proxy Init Script
# ================================================================
# Este script se ejecuta al iniciar el contenedor NPM.
# 1. Copia el frontend custom (con páginas de infraestructura)
# 2. Inyecta la configuración de proxy para el sidecar API
# ================================================================

echo "[init] Starting NPM custom init..."

# 1. Override frontend dist con nuestro build custom
if [ -d /custom-frontend/assets ]; then
    echo "[init] Copying custom frontend..."
    cp -rf /custom-frontend/* /app/frontend/dist/
    echo "[init] Frontend updated with custom build"
else
    echo "[init] No custom frontend found, using default"
fi

# 2. Inyectar proxy del sidecar si no existe
if ! grep -q "sidecar-api" /etc/nginx/conf.d/production.conf 2>/dev/null; then
    echo "[init] Injecting sidecar proxy config..."
    sed -i '/location \/ {/i\
        location /sidecar-api/ {\
                add_header            X-Served-By $host;\
                proxy_set_header Host $host;\
                proxy_set_header      X-Forwarded-Scheme $scheme;\
                proxy_set_header      X-Forwarded-Proto  $scheme;\
                proxy_set_header      X-Forwarded-For    $remote_addr;\
                proxy_pass            http://npm-sidecar:8888/;\
                proxy_read_timeout 60s;\
                proxy_send_timeout 60s;\
        }\
' /etc/nginx/conf.d/production.conf
    echo "[init] Sidecar proxy injected"
else
    echo "[init] Sidecar proxy already present"
fi

echo "[init] Custom init complete"
