FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema (ssh client para deploy remoto)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssh-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Código del sidecar
COPY . .

# Puerto del sidecar
EXPOSE 8888

# Health check
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s \
    CMD curl -f http://localhost:8888/ || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8888", "--workers", "2"]
