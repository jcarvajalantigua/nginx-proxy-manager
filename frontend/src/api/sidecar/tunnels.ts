import { sidecarGet, sidecarPost, sidecarPut } from "./base";
import type { TunnelInfo, TunnelIngressRule, StatusResponse } from "./types";

/** GET /tunnels/ — returns TunnelInfo[] (all tunnels across all providers) */
export function getAllTunnels(): Promise<TunnelInfo[]> {
	return sidecarGet<TunnelInfo[]>("/tunnels/");
}

/** GET /tunnels/{tunnel_id} — returns single TunnelInfo with ingress_rules */
export function getTunnelById(tunnelId: string): Promise<TunnelInfo> {
	return sidecarGet<TunnelInfo>(`/tunnels/${tunnelId}`);
}

/** PUT /tunnels/{tunnel_id}/ingress — update ingress rules */
export function updateTunnelIngress(tunnelId: string, rules: TunnelIngressRule[]): Promise<StatusResponse> {
	return sidecarPut<StatusResponse>(`/tunnels/${tunnelId}/ingress`, { ingress: rules });
}

/** POST /tunnels/dns/{domain} — create DNS for tunnel */
export function createTunnelDNS(domain: string): Promise<StatusResponse> {
	return sidecarPost<StatusResponse>(`/tunnels/dns/${encodeURIComponent(domain)}`);
}
