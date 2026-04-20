import { useState } from "react";
import {
	IconSettings,
	IconRefresh,
	IconKey,
	IconShieldLock,
	IconPlus,
} from "@tabler/icons-react";
import {
	useDocsSettings,
	useUpdateDocsSettings,
	useRotateDocsApiKey,
	useCorsSettings,
	useUpdateCorsSettings,
	useMaintenanceSettings,
	useUpdateMaintenanceSettings,
	useApiKeys,
	useCreateApiKey,
	useDeleteApiKey,
} from "src/hooks";

const SidecarSettingsPage = () => {
	const { data: docs, isLoading: docsLoading, refetch: refetchDocs } = useDocsSettings();
	const updateDocs = useUpdateDocsSettings();
	const rotateDocsKey = useRotateDocsApiKey();
	const { data: cors, refetch: refetchCors } = useCorsSettings();
	const updateCors = useUpdateCorsSettings();
	const { data: maintenance, refetch: refetchMaint } = useMaintenanceSettings();
	const updateMaintenance = useUpdateMaintenanceSettings();
	const { data: apiKeys, refetch: refetchKeys } = useApiKeys();
	const createKeyMutation = useCreateApiKey();
	const deleteKey = useDeleteApiKey();
	const [corsInput, setCorsInput] = useState("");
	const [keyName, setKeyName] = useState("");
	const [createdKey, setCreatedKey] = useState<string | null>(null);
	const [keyError, setKeyError] = useState<string | null>(null);

	const createKey = {
		isPending: createKeyMutation.isPending,
		mutate: (name?: string) => {
			setKeyError(null);
			createKeyMutation.mutate(name, {
				onSuccess: (data: any) => {
					if (data?.api_key) {
						setCreatedKey(data.api_key);
					}
					refetchKeys();
				},
				onError: (err: any) => {
					setKeyError(err?.message || "Unknown error");
				},
			});
		},
	};

	const refetchAll = () => { refetchDocs(); refetchCors(); refetchMaint(); refetchKeys(); };

	const handleRotateDocsKey = async () => {
		if (window.confirm("Rotate docs API key? The current key will be invalidated.")) {
			await rotateDocsKey.mutateAsync();
		}
	};

	const handleAddCorsOrigin = () => {
		const newOrigins = corsInput.split(",").map(s => s.trim()).filter(Boolean);
		if (newOrigins.length === 0) return;
		const current = cors?.allowed_origins || [];
		const merged = [...new Set([...current, ...newOrigins])];
		updateCors.mutate(merged);
		setCorsInput("");
	};

	const handleRemoveCorsOrigin = (origin: string) => {
		const current = cors?.allowed_origins || [];
		updateCors.mutate(current.filter(o => o !== origin));
	};

	return (
		<div>
			<div className="page-header d-print-none">
				<div className="row align-items-center">
					<div className="col-auto">
						<h2 className="page-title">
							<IconSettings className="me-2" size={24} />
							Sidecar Settings
						</h2>
					</div>
					<div className="col-auto ms-auto">
						<button type="button" className="btn btn-outline-primary" onClick={refetchAll}>
							<IconRefresh size={16} className="me-1" /> Refresh
						</button>
					</div>
				</div>
			</div>

			{docsLoading && (
				<div className="text-center py-4"><div className="spinner-border text-primary" /></div>
			)}

			<div className="row row-cards">
				{/* Docs Settings */}
				{docs && (
					<div className="col-md-6">
						<div className="card">
							<div className="card-header"><h3 className="card-title">API Documentation</h3></div>
							<div className="card-body">
								<div className="mb-3">
									<label className="row">
										<span className="col">Docs Enabled</span>
										<span className="col-auto">
											<label className="form-check form-check-single form-switch">
												<input className="form-check-input" type="checkbox" checked={docs.docs_enabled}
													onChange={(e) => updateDocs.mutate({ docs_enabled: e.target.checked })} />
											</label>
										</span>
									</label>
								</div>
								<div className="mb-3">
									<label className="row">
										<span className="col">Require Internal Network</span>
										<span className="col-auto">
											<label className="form-check form-check-single form-switch">
												<input className="form-check-input" type="checkbox" checked={docs.docs_require_internal}
													onChange={(e) => updateDocs.mutate({ docs_require_internal: e.target.checked })} />
											</label>
										</span>
									</label>
								</div>
								{docs.docs_api_key_hint && (
									<div className="mb-3"><span className="text-muted">Key hint: </span><code>{docs.docs_api_key_hint}</code></div>
								)}
								{docs.docs_allowed_networks?.length > 0 && (
									<div className="mb-2">
										<span className="text-muted">Allowed Networks:</span>
										<div className="mt-1">
											{docs.docs_allowed_networks.map((net) => (
												<span key={net} className="badge bg-blue-lt me-1 mb-1">{net}</span>
											))}
										</div>
									</div>
								)}
								<button type="button" className="btn btn-warning btn-sm mt-2" onClick={handleRotateDocsKey} disabled={rotateDocsKey.isPending}>
									<IconKey size={14} className="me-1" />
									{rotateDocsKey.isPending ? "Rotating..." : "Rotate Docs Key"}
								</button>
							</div>
							<div className="card-footer text-muted"><small>Updated: {docs.updated_at}</small></div>
						</div>
					</div>
				)}

				{/* Maintenance */}
				{maintenance && (
					<div className="col-md-6">
						<div className="card">
							<div className="card-header"><h3 className="card-title">Maintenance Mode</h3></div>
							<div className="card-body">
								<div className="mb-3">
									<label className="row">
										<span className="col">Maintenance Enabled</span>
										<span className="col-auto">
											<label className="form-check form-check-single form-switch">
												<input className="form-check-input" type="checkbox" checked={maintenance.enabled}
													onChange={(e) => updateMaintenance.mutate(e.target.checked)} />
											</label>
										</span>
									</label>
								</div>
								{maintenance.allowed_ips?.length > 0 && (
									<div className="mb-2">
										<span className="text-muted">Allowed IPs:</span>
										<div className="mt-1">
											{maintenance.allowed_ips.map((ip) => (
												<span key={ip} className="badge bg-green-lt me-1 mb-1">{ip}</span>
											))}
										</div>
									</div>
								)}
							</div>
							<div className="card-footer text-muted"><small>Updated: {maintenance.updated_at}</small></div>
						</div>
					</div>
				)}

				{/* CORS Origins */}
				<div className="col-md-6">
					<div className="card">
						<div className="card-header"><h3 className="card-title">CORS Origins</h3></div>
						<div className="card-body">
							<div className="mb-2">
								{cors?.allowed_origins?.map((origin) => (
									<span key={origin} className="badge bg-blue-lt me-1 mb-1" style={{ cursor: "pointer" }}
										onClick={() => { if (window.confirm(`Remove CORS origin "${origin}"?`)) handleRemoveCorsOrigin(origin); }}
										title="Click to remove">
										{origin} ×
									</span>
								))}
								{(!cors?.allowed_origins || cors.allowed_origins.length === 0) && (
									<span className="text-muted">No CORS origins configured</span>
								)}
							</div>
							<div className="input-group">
								<input type="text" className="form-control" placeholder="https://sajet.us, https://app.techeels.io"
									value={corsInput} onChange={(e) => setCorsInput(e.target.value)}
									onKeyDown={(e) => { if (e.key === "Enter") handleAddCorsOrigin(); }} />
								<button type="button" className="btn btn-primary" onClick={handleAddCorsOrigin} disabled={!corsInput || updateCors.isPending}>
									<IconPlus size={14} className="me-1" />Add
								</button>
							</div>
						</div>
						{cors?.updated_at && <div className="card-footer text-muted"><small>Updated: {cors.updated_at}</small></div>}
					</div>
				</div>

				{/* API Keys */}
				<div className="col-md-6">
					<div className="card">
						<div className="card-header">
							<h3 className="card-title"><IconShieldLock size={18} className="me-2" />API Keys</h3>
							<div className="card-actions">
								<div className="input-group input-group-sm" style={{ width: "auto" }}>
									<input type="text" className="form-control" placeholder="Key name" value={keyName}
										onChange={(e) => setKeyName(e.target.value)} style={{ width: "120px" }}
										onKeyDown={(e) => { if (e.key === "Enter" && keyName) { createKey.mutate(keyName || undefined); setKeyName(""); }}} />
									<button type="button" className="btn btn-sm btn-primary"
										onClick={() => { createKey.mutate(keyName || undefined); setKeyName(""); }}
										disabled={createKey.isPending}>
										{createKey.isPending ? "Creating..." : "New Key"}
									</button>
								</div>
							</div>
						</div>
						<div className="card-body">
							{/* Show newly created key */}
							{createdKey && (
								<div className="alert alert-success alert-dismissible mb-3" role="alert">
									<div className="d-flex">
										<div>
											<h4 className="alert-title">API Key Created!</h4>
											<div className="text-secondary mb-2">Copy this key now — it won't be shown again.</div>
											<div className="input-group mb-1">
												<input type="text" className="form-control font-monospace" value={createdKey} readOnly
													onClick={(e) => (e.target as HTMLInputElement).select()} />
												<button type="button" className="btn btn-outline-success"
													onClick={() => { navigator.clipboard.writeText(createdKey); }}>
													Copy
												</button>
											</div>
										</div>
									</div>
									<button type="button" className="btn-close" onClick={() => setCreatedKey(null)} />
								</div>
							)}
							{/* Error display */}
							{keyError && (
								<div className="alert alert-danger alert-dismissible mb-3" role="alert">
									<div>Failed to create API key: {keyError}</div>
									<button type="button" className="btn-close" onClick={() => setKeyError(null)} />
								</div>
							)}
							{Array.isArray(apiKeys) && apiKeys.length > 0 ? (
								<div className="list-group list-group-flush">
									{apiKeys.map((key) => (
										<div key={key.id} className="list-group-item d-flex justify-content-between align-items-center">
											<div>
												<strong>{key.name}</strong>
												<code className="ms-2">{key.hint}</code>
												<small className="text-muted ms-2">Created: {new Date(key.created_at).toLocaleDateString()}</small>
												{key.last_used && <small className="text-muted ms-2">Last: {key.last_used}</small>}
											</div>
											<button type="button" className="btn btn-ghost-danger btn-sm"
												onClick={() => { if (window.confirm(`Delete API key "${key.name}"?`)) deleteKey.mutate(key.id); }}>Delete</button>
										</div>
									))}
								</div>
							) : (
								<span className="text-muted">No API keys configured</span>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default SidecarSettingsPage;
