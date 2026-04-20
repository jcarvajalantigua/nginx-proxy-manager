import { sidecarGet } from "./base";
import type { HealthResponse, ServiceHealth, ServiceInfo } from "./types";

export function getInfraHealth(): Promise<HealthResponse> {
	return sidecarGet<HealthResponse>("/health/");
}

export function getServiceHealth(pctId: number): Promise<ServiceHealth> {
	return sidecarGet<ServiceHealth>(`/health/${pctId}`);
}

export function getServiceInventory(): Promise<ServiceInfo[]> {
	return sidecarGet<ServiceInfo[]>("/health/services/inventory");
}
