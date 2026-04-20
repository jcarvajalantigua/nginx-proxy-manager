import { sidecarGet, sidecarPut, sidecarPost, sidecarDelete, sidecarPutQuery, sidecarPostQuery } from "./base";
import type { DocsSettings, CorsSettings, MaintenanceSettings, ApiKeyEntry, StatusResponse } from "./types";

// ---- Docs ---- (PUT uses query params: docs_enabled, docs_require_internal)
export function getDocsSettings(): Promise<DocsSettings> {
	return sidecarGet<DocsSettings>("/settings/docs");
}
export function updateDocsSettings(params: { docs_enabled?: boolean; docs_require_internal?: boolean }): Promise<StatusResponse> {
	return sidecarPutQuery<StatusResponse>("/settings/docs", params);
}
export function rotateDocsApiKey(): Promise<StatusResponse> {
	return sidecarPost<StatusResponse>("/settings/docs/rotate-key");
}
export function revokeDocsApiKey(): Promise<StatusResponse> {
	return sidecarDelete<StatusResponse>("/settings/docs/revoke-key");
}

// ---- CORS ---- (PUT body = array of origins)
export function getCorsSettings(): Promise<CorsSettings> {
	return sidecarGet<CorsSettings>("/settings/cors");
}
export function updateCorsSettings(origins: string[]): Promise<StatusResponse> {
	return sidecarPut<StatusResponse>("/settings/cors", origins);
}

// ---- Maintenance ---- (PUT uses query param: enabled)
export function getMaintenanceSettings(): Promise<MaintenanceSettings> {
	return sidecarGet<MaintenanceSettings>("/settings/maintenance");
}
export function updateMaintenanceSettings(enabled: boolean): Promise<StatusResponse> {
	return sidecarPutQuery<StatusResponse>("/settings/maintenance", { enabled });
}

// ---- API Keys ---- (POST uses query param: name)
export async function getApiKeys(): Promise<ApiKeyEntry[]> {
	const res = await sidecarGet<{ keys: ApiKeyEntry[]; total: number }>("/settings/api-keys");
	return (res as any).keys || [];
}

export interface CreateApiKeyResponse {
	success: boolean;
	id: string;
	api_key: string;
	hint: string;
	scopes: string[];
	message: string;
}

export function createApiKey(name?: string): Promise<CreateApiKeyResponse> {
	return sidecarPostQuery<CreateApiKeyResponse>("/settings/api-keys", { name: name || "gui-key" });
}
export function deleteApiKey(keyId: string): Promise<StatusResponse> {
	return sidecarDelete<StatusResponse>(`/settings/api-keys/${keyId}`);
}
