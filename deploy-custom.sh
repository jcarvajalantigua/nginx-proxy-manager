#!/bin/bash
# ================================================================
# NPM Deploy: Custom Frontend + Sidecar Proxy
# ================================================================
# Ejecutar DESPUÉS de docker compose up -d
# Uso: bash /opt/npm-gateway/deploy-custom.sh
# ================================================================
set -e

echo "[deploy] 1/4 — Cleaning old assets from NPM container..."
docker exec npm sh -c "rm -rf /app/frontend/assets/*" 2>/dev/null || true
echo "[deploy]   ✓ Old assets removed"

echo "[deploy] 2/4 — Copying custom frontend to NPM container..."
docker cp /opt/npm/custom-frontend/. npm:/app/frontend/
echo "[deploy]   ✓ Frontend files copied"

echo "[deploy] 3/4 — Injecting sidecar proxy + cache headers..."
CONF="/etc/nginx/conf.d/production.conf"
if ! docker exec npm grep -q "sidecar-api" "$CONF" 2>/dev/null; then
    docker exec npm sed -i '/location \/ {/i\
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
    echo "[deploy]   ✓ Sidecar proxy injected"
else
    echo "[deploy]   ✓ Sidecar proxy already present"
fi

# Inject cache-busting headers for index.html
if ! docker exec npm grep -q "no-cache.*no-store" "$CONF" 2>/dev/null; then
    docker exec npm sed -i '/location \/ {/i\
        location = /index.html {\
                add_header Cache-Control "no-cache, no-store, must-revalidate";\
                add_header Pragma "no-cache";\
                add_header Expires "0";\
                try_files $uri =404;\
        }\
' "$CONF"
    echo "[deploy]   ✓ Cache headers injected for index.html"
else
    echo "[deploy]   ✓ Cache headers already present"
fi

echo "[deploy] 4/4 — Reloading nginx..."
docker exec npm nginx -t
docker exec npm nginx -s reload
echo "[deploy]   ✓ Nginx reloaded"

echo ""
echo "[deploy] ✅ Deploy complete!"
echo "[deploy]   Frontend: http://10.10.20.205:81/"
echo "[deploy]   Infra:    http://10.10.20.205:81/infra"
echo "[deploy]   API:      http://10.10.20.205:81/sidecar-api/health/"
