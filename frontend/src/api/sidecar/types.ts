/**
 * TypeScript interfaces para la API Sidecar (FastAPI :8888)
 * Generado a partir de /opt/npm-custom/sidecar/schemas.py
 */

// ──── Enums ────

export type ServiceStatusType = "healthy" | "unhealthy" | "unreachable" | "unknown";
export type ProxyScheme = "http" | "https";
export type DeployTargetType = "sajet" | "odoo17" | "odoo19" | "postal";
export type LBStrategy = "round-robin" | "weighted" | "least-connections" | "ip-hash" | "failover";

// ──── Health & Services ────

export interface ServiceHealth {
	pct: number;
	name: string;
	ip: string;
	port: number;
	status: ServiceStatusType;
	responseMs: number | null;
	detail: string | null;
}

export interface HealthResponse {
	status: string;
	services: ServiceHealth[];
	total: number;
	healthy: number;
	unhealthy: number;
}

export interface ServiceInfo {
	pct: number;
	name: string;
	ip: string;
	ports: number[];
	role: string;
	domains: string[];
	status: ServiceStatusType;
}

// ──── Proxy Hosts ────

export interface ProxyHostCreate {
	domain_names: string[];
	forward_scheme: ProxyScheme;
	forward_host: string;
	forward_port: number;
	ssl_forced: boolean;
	block_exploits: boolean;
	allow_websocket_upgrade: boolean;
	cache_assets: boolean;
	access_list_id: number;
	advanced_config: string;
	meta: Record<string, any>;
}

export interface ProxyHostResponse {
	id: number;
	domain_names: string[];
	forward_scheme: string;
	forward_host: string;
	forward_port: number;
	ssl_forced: boolean;
	enabled: boolean;
	certificate_id: number | null;
}

// ──── Cloudflare Tunnels ────

export interface TunnelIngressRule {
	hostname: string;
	service: string;
	path?: string;
}

export interface TunnelInfo {
	id: string;
	name: string;
	status: string;
	connections: number;
	ingress_rules: TunnelIngressRule[];
}

// ──── Deploy ────

export interface DeployRequest {
	target: DeployTargetType;
	action: string;
	branch?: string;
	force: boolean;
}

export interface DeployResponse {
	target: string;
	action: string;
	success: boolean;
	output: string;
	duration_ms: number;
}

// ──── Providers (Multi-Cloudflare) ────

export interface ProviderCreate {
	name: string;
	cf_api_token: string;
	cf_account_id: string;
	zones: Record<string, string>;
	tunnels: Record<string, string>;
	tunnel_token?: string;
	domains: string[];
	notes: string;
}

export interface ProviderUpdate {
	name?: string;
	cf_api_token?: string;
	cf_account_id?: string;
	zones?: Record<string, string>;
	tunnels?: Record<string, string>;
	tunnel_token?: string;
	domains?: string[];
	notes?: string;
}

export interface ProviderResponse {
	id: string;
	name: string;
	cf_account_id: string;
	cf_api_token_hint: string;
	zones: Record<string, string>;
	tunnels: Record<string, string>;
	domains: string[];
	notes: string;
	created_at: string;
	updated_at: string;
}

export interface ProviderDNSCreate {
	zone_domain: string;
	record_name: string;
	record_type: string;
	content: string;
	proxied: boolean;
}

export interface ProviderTunnelIngress {
	tunnel_name: string;
	ingress: TunnelIngressRule[];
}

// ──── Load Balancer ────

export interface LBNode {
	host: string;
	port: number;
	weight: number;
	enabled: boolean;
	healthy: boolean;
	max_connections: number;
	check_failures: number;
	last_check: string;
	meta: Record<string, any>;
}

export interface LBBackend {
	id: string;
	name: string;
	strategy: LBStrategy;
	health_check: {
		enabled: boolean;
		method: string;
		path: string;
		interval_sec: number;
		timeout_sec: number;
		unhealthy_threshold: number;
		healthy_threshold: number;
	};
	nodes: LBNode[];
	sticky_sessions: boolean;
	sticky_cookie: string;
	connection_limit: number;
	domains: string[];
	created_at: string;
	updated_at: string;
}

export interface LBBackendCreate {
	name: string;
	strategy: LBStrategy;
	health_check_path: string;
	health_check_interval: number;
}

export interface LBNodeCreate {
	address: string;
	port: number;
	weight?: number;
	max_fails?: number;
	fail_timeout?: string;
	is_backup?: boolean;
}

export interface LBHealthResult {
	backend_id: string;
	backend_name: string;
	results: Record<string, { status: string; response_ms: number; detail: string }>;
}

export interface LBBackendsResponse {
	backends: LBBackend[];
	total: number;
	strategies_available: string[];
}

// ──── Settings (per-section) ────

export interface DocsSettings {
	docs_enabled: boolean;
	docs_require_internal: boolean;
	docs_allowed_networks: string[];
	docs_api_key_enabled: boolean;
	docs_api_key_hint: string;
	docs_api_key_created_at: string;
	updated_at: string;
}

export interface CorsSettings {
	allowed_origins: string[];
	allowed_methods: string[];
	allowed_headers: string[];
	updated_at: string;
}

export interface MaintenanceSettings {
	enabled: boolean;
	message: string;
	allowed_ips: string[];
	updated_at: string;
}

export interface ApiKeyEntry {
	id: string;
	name: string;
	hint: string;
	created_at: string;
	last_used: string | null;
	scopes: string[];
}

// ──── Deploy ────

export interface DeployTargetStatus {
	pct: number;
	status: string;
	detail: string;
}

export interface DeployStatusAll {
	success: boolean;
	message: string;
	data: Record<string, DeployTargetStatus>;
}

// ──── Generic ────

export interface StatusResponse {
	success: boolean;
	message: string;
	data?: Record<string, any>;
}
