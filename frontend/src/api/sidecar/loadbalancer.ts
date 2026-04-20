import { sidecarGet, sidecarPost, sidecarDelete, sidecarPostQuery, sidecarPutQuery, sidecarDeleteQuery } from "./base";
import type {
	LBBackend,
	LBBackendsResponse,
	LBNode,
	StatusResponse,
} from "./types";

/** GET /lb/backends — returns {backends: [...], total, strategies_available} */
export async function getBackends(): Promise<LBBackend[]> {
	const resp = await sidecarGet<LBBackendsResponse>("/lb/backends");
	return resp.backends || [];
}

export function getBackend(backendId: string): Promise<LBBackend> {
	return sidecarGet<LBBackend>(`/lb/backends/${backendId}`);
}

/** POST /lb/backends — query: name, strategy, sticky_sessions; body: nodes array */
export function createBackend(params: { name: string; strategy: string; sticky_sessions?: boolean }, nodes?: any[]): Promise<LBBackend> {
	return sidecarPostQuery<LBBackend>("/lb/backends", params, nodes || []);
}

/** PUT /lb/backends/{id} — query: name, strategy, sticky_sessions, connection_limit; body: optional */
export function updateBackend(backendId: string, params: { name?: string; strategy?: string; sticky_sessions?: boolean; connection_limit?: number }): Promise<LBBackend> {
	return sidecarPutQuery<LBBackend>(`/lb/backends/${backendId}`, params);
}

export function deleteBackend(backendId: string): Promise<StatusResponse> {
	return sidecarDelete<StatusResponse>(`/lb/backends/${backendId}`);
}

/** POST /lb/backends/{id}/nodes — query: host, port, weight, max_connections */
export function addNode(backendId: string, params: { host: string; port: number; weight?: number; max_connections?: number }): Promise<StatusResponse> {
	return sidecarPostQuery<StatusResponse>(`/lb/backends/${backendId}/nodes`, params);
}

/** DELETE /lb/backends/{id}/nodes — query: host, port */
export function removeNode(backendId: string, host: string, port: number): Promise<StatusResponse> {
	return sidecarDeleteQuery<StatusResponse>(`/lb/backends/${backendId}/nodes`, { host, port });
}

/** PUT /lb/backends/{id}/nodes/{host}/toggle — query: enabled */
export function toggleNode(backendId: string, host: string, enabled: boolean): Promise<StatusResponse> {
	return sidecarPutQuery<StatusResponse>(`/lb/backends/${backendId}/nodes/${host}/toggle`, { enabled });
}

/** PUT /lb/backends/{id}/health-check — all query params */
export function configureHealthCheck(backendId: string, params: {
	enabled?: boolean; method?: string; path?: string;
	interval_sec?: number; timeout_sec?: number;
	unhealthy_threshold?: number; healthy_threshold?: number;
}): Promise<StatusResponse> {
	return sidecarPutQuery<StatusResponse>(`/lb/backends/${backendId}/health-check`, params);
}

/** POST /lb/backends/{id}/apply — apply LB to NPM proxy hosts */
export function applyBackend(backendId: string): Promise<StatusResponse> {
	return sidecarPost<StatusResponse>(`/lb/backends/${backendId}/apply`);
}

/** GET /lb/backends/{id}/health — per-backend health check */
export function runBackendHealthCheck(backendId: string): Promise<any> {
	return sidecarGet<any>(`/lb/backends/${backendId}/health`);
}

/** GET /lb/backends/{id}/nginx-config — per-backend nginx upstream */
export function getBackendNginxConfig(backendId: string): Promise<string> {
	return sidecarGet<string>(`/lb/backends/${backendId}/nginx-config`);
}

/** GET /lb/backends/{id}/nodes — list nodes */
export function getBackendNodes(backendId: string): Promise<LBNode[]> {
	return sidecarGet<LBNode[]>(`/lb/backends/${backendId}/nodes`);
}

/** POST /lb/seed — create pre-configured backends */
export function seedBackends(): Promise<StatusResponse> {
	return sidecarPost<StatusResponse>("/lb/seed");
}
