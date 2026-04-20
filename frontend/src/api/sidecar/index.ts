/**
 * API Sidecar — módulos agrupados por tag de la FastAPI
 */

// ──── Health & Services ────
export { getInfraHealth, getServiceHealth, getServiceInventory } from "./health";

// ──── Providers (Multi-Cloudflare) ────
export {
	getProviders,
	getProvider,
	createProvider,
	updateProvider,
	deleteProvider,
	getProviderZones,
	createProviderDNS,
	getProviderTunnels,
	updateProviderTunnelIngress,
} from "./providers";

// ──── Cloudflare Tunnels ────
export { getAllTunnels, getTunnelById, updateTunnelIngress, createTunnelDNS } from "./tunnels";

// ──── Deploy ────
export { getDeployStatusAll, executeDeploy } from "./deploy";

// ──── Load Balancer ────
export {
	getBackends,
	getBackend,
	createBackend,
	updateBackend,
	deleteBackend,
	addNode,
	removeNode,
	toggleNode,
	configureHealthCheck,
	applyBackend,
	runBackendHealthCheck,
	getBackendNginxConfig,
	getBackendNodes,
	seedBackends,
} from "./loadbalancer";

// ──── Settings ────
export {
	getDocsSettings,
	updateDocsSettings,
	rotateDocsApiKey,
	revokeDocsApiKey,
	getCorsSettings,
	updateCorsSettings,
	getMaintenanceSettings,
	updateMaintenanceSettings,
	getApiKeys,
	createApiKey,
	deleteApiKey,
} from "./settings";

// ──── Types (re-export) ────
export type * from "./types";
