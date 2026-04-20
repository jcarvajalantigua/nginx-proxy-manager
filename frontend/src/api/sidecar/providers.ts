import { sidecarGet, sidecarPost, sidecarPut, sidecarDelete } from "./base";
import type {
	ProviderResponse,
	ProviderCreate,
	ProviderUpdate,
	ProviderDNSCreate,
	ProviderTunnelIngress,
	StatusResponse,
} from "./types";

export function getProviders(): Promise<ProviderResponse[]> {
	return sidecarGet<ProviderResponse[]>("/providers");
}

export function getProvider(providerId: string): Promise<ProviderResponse> {
	return sidecarGet<ProviderResponse>(`/providers/${providerId}`);
}

export function createProvider(data: ProviderCreate): Promise<ProviderResponse> {
	return sidecarPost<ProviderResponse>("/providers", data);
}

export function updateProvider(providerId: string, data: ProviderUpdate): Promise<ProviderResponse> {
	return sidecarPut<ProviderResponse>(`/providers/${providerId}`, data);
}

export function deleteProvider(providerId: string): Promise<StatusResponse> {
	return sidecarDelete<StatusResponse>(`/providers/${providerId}`);
}

export function getProviderZones(providerId: string): Promise<any[]> {
	return sidecarGet<any[]>(`/providers/${providerId}/zones`);
}

export function createProviderDNS(providerId: string, data: ProviderDNSCreate): Promise<StatusResponse> {
	return sidecarPost<StatusResponse>(`/providers/${providerId}/dns`, data);
}

export function getProviderTunnels(providerId: string): Promise<any[]> {
	return sidecarGet<any[]>(`/providers/${providerId}/tunnels`);
}

export function updateProviderTunnelIngress(
	providerId: string,
	data: ProviderTunnelIngress,
): Promise<StatusResponse> {
	return sidecarPost<StatusResponse>(`/providers/${providerId}/tunnels/ingress`, data);
}
