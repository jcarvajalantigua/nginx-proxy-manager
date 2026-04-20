/**
 * Cliente HTTP base para la API Sidecar (FastAPI :8888)
 * Dev: usa el proxy de Vite /sidecar-api/ → http://10.10.20.205:8888
 * Prod: usa la URL directa configurada en VITE_SIDECAR_URL o /sidecar-api/
 */

const SIDECAR_BASE = import.meta.env.VITE_SIDECAR_URL || "/sidecar-api";

function buildUrl(path: string): string {
	// Strip leading slash but KEEP trailing slash — FastAPI 307 redirects break CORS
	const endpoint = path.replace(/^\//, "");
	return `${SIDECAR_BASE}/${endpoint}`;
}

function buildHeaders(): Record<string, string> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	// Incluir API key si existe en localStorage
	const apiKey = localStorage.getItem("sidecar_api_key");
	if (apiKey) {
		headers["X-API-Key"] = apiKey;
	}
	return headers;
}

async function processResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const body = await response.json().catch(() => ({ detail: response.statusText }));
		throw new Error(body.detail || body.message || `HTTP ${response.status}`);
	}
	return response.json() as Promise<T>;
}

export async function sidecarGet<T>(path: string): Promise<T> {
	const url = buildUrl(path);
	const headers = buildHeaders();
	const response = await fetch(url, { method: "GET", headers });
	return processResponse<T>(response);
}

export async function sidecarPost<T>(path: string, data?: any): Promise<T> {
	const url = buildUrl(path);
	const headers = buildHeaders();
	const response = await fetch(url, {
		method: "POST",
		headers,
		body: data ? JSON.stringify(data) : undefined,
	});
	return processResponse<T>(response);
}

export async function sidecarPut<T>(path: string, data?: any): Promise<T> {
	const url = buildUrl(path);
	const headers = buildHeaders();
	const response = await fetch(url, {
		method: "PUT",
		headers,
		body: data ? JSON.stringify(data) : undefined,
	});
	return processResponse<T>(response);
}

export async function sidecarDelete<T>(path: string): Promise<T> {
	const url = buildUrl(path);
	const headers = buildHeaders();
	const response = await fetch(url, { method: "DELETE", headers });
	return processResponse<T>(response);
}

/** Build a URL with query params appended */
function buildUrlWithParams(path: string, params: Record<string, any>): string {
	const base = buildUrl(path);
	const qs = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) {
		if (v !== undefined && v !== null) qs.append(k, String(v));
	}
	const qsStr = qs.toString();
	return qsStr ? `${base}?${qsStr}` : base;
}

/** POST with query params (some FastAPI endpoints use query params + optional JSON body) */
export async function sidecarPostQuery<T>(path: string, params: Record<string, any>, body?: any): Promise<T> {
	const url = buildUrlWithParams(path, params);
	const headers = buildHeaders();
	const response = await fetch(url, {
		method: "POST",
		headers,
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});
	return processResponse<T>(response);
}

/** PUT with query params */
export async function sidecarPutQuery<T>(path: string, params: Record<string, any>, body?: any): Promise<T> {
	const url = buildUrlWithParams(path, params);
	const headers = buildHeaders();
	const response = await fetch(url, {
		method: "PUT",
		headers,
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});
	return processResponse<T>(response);
}

/** DELETE with query params */
export async function sidecarDeleteQuery<T>(path: string, params: Record<string, any>): Promise<T> {
	const url = buildUrlWithParams(path, params);
	const headers = buildHeaders();
	const response = await fetch(url, { method: "DELETE", headers });
	return processResponse<T>(response);
}
