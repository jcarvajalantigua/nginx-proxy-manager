#!/bin/bash
# ================================================================
# NPM Post-Start: Inyecta proxy sidecar en nginx config
# ================================================================
# Ejecutar después de docker compose up/restart
# O con: docker exec npm bash /opt/inject-sidecar-proxy.sh
# ================================================================

CONF="/etc/nginx/conf.d/production.conf"

if ! grep -q "sidecar-api" "$CONF" 2>/dev/null; then
    echo "[inject] Adding sidecar proxy block..."
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
' "$CONF"
    nginx -t && nginx -s reload
    echo "[inject] Sidecar proxy injected and nginx reloaded"
else
    echo "[inject] Sidecar proxy already present"
fi
