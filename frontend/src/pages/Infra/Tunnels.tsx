import { useState } from "react";
import {
	IconRoute,
	IconRefresh,
	IconPlugConnected,
	IconPlugConnectedX,
} from "@tabler/icons-react";
import { useAllTunnels } from "src/hooks";
import type { TunnelInfo } from "src/api/sidecar/types";

const TunnelsPage = () => {
	const { data: tunnels, isLoading, refetch } = useAllTunnels();
	const [selectedTunnel, setSelectedTunnel] = useState<TunnelInfo | null>(null);

	const healthyCount = tunnels?.filter((t) => t.status === "healthy").length || 0;
	const totalCount = tunnels?.length || 0;

	return (
		<div>
			<div className="page-header d-print-none">
				<div className="row align-items-center">
					<div className="col-auto">
						<h2 className="page-title">
							<IconRoute className="me-2" size={24} />
							Cloudflare Tunnels
						</h2>
					</div>
					<div className="col-auto ms-auto d-flex gap-2">
						<span className="badge bg-green-lt me-2 fs-6">
							{healthyCount}/{totalCount} healthy
						</span>
						<button type="button" className="btn btn-outline-primary" onClick={() => refetch()}>
							<IconRefresh size={16} className="me-1" />
							Refresh
						</button>
					</div>
				</div>
			</div>

			{isLoading && (
				<div className="text-center py-4">
					<div className="spinner-border text-primary" />
				</div>
			)}

			{/* Tunnels Table */}
			<div className="card">
				<div className="card-header">
					<h3 className="card-title">All Tunnels</h3>
					<div className="card-actions">
						<span className="badge bg-blue-lt">{totalCount} tunnels</span>
					</div>
				</div>
				<div className="table-responsive">
					<table className="table table-vcenter card-table">
						<thead>
							<tr>
								<th>Status</th>
								<th>Name</th>
								<th>Tunnel ID</th>
								<th>Connections</th>
								<th>Ingress Rules</th>
							</tr>
						</thead>
						<tbody>
							{tunnels?.length === 0 && !isLoading && (
								<tr>
									<td colSpan={5} className="text-center text-muted py-4">
										No tunnels found
									</td>
								</tr>
							)}
							{tunnels?.map((tunnel) => (
								<tr
									key={tunnel.id}
									className={selectedTunnel?.id === tunnel.id ? "table-active" : ""}
									style={{ cursor: "pointer" }}
									onClick={() => setSelectedTunnel(selectedTunnel?.id === tunnel.id ? null : tunnel)}
								>
									<td>
										{tunnel.status === "healthy" ? (
											<span className="badge bg-green text-white">
												<IconPlugConnected size={14} className="me-1" />
												healthy
											</span>
										) : (
											<span className="badge bg-red text-white">
												<IconPlugConnectedX size={14} className="me-1" />
												{tunnel.status}
											</span>
										)}
									</td>
									<td className="fw-bold">{tunnel.name}</td>
									<td>
										<code className="small">{tunnel.id.slice(0, 12)}...</code>
									</td>
									<td>
										<strong>{tunnel.connections}</strong>
									</td>
									<td>
										<span className="badge bg-blue-lt">
											{tunnel.ingress_rules?.length || 0} rules
										</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			{/* Selected Tunnel Detail */}
			{selectedTunnel && (
				<div className="card mt-3">
					<div className="card-header">
						<h3 className="card-title">
							Tunnel: {selectedTunnel.name}
						</h3>
						<div className="card-actions">
							<button
								type="button"
								className="btn btn-sm btn-outline-secondary"
								onClick={() => setSelectedTunnel(null)}
							>
								Close
							</button>
						</div>
					</div>
					<div className="card-body">
						<div className="datagrid">
							<div className="datagrid-item">
								<div className="datagrid-title">Tunnel ID</div>
								<div className="datagrid-content"><code>{selectedTunnel.id}</code></div>
							</div>
							<div className="datagrid-item">
								<div className="datagrid-title">Status</div>
								<div className="datagrid-content">
									<span className={`badge ${selectedTunnel.status === "healthy" ? "bg-green" : "bg-red"} text-white`}>
										{selectedTunnel.status}
									</span>
								</div>
							</div>
							<div className="datagrid-item">
								<div className="datagrid-title">Connections</div>
								<div className="datagrid-content">{selectedTunnel.connections}</div>
							</div>
						</div>
						{selectedTunnel.ingress_rules?.length > 0 && (
							<div className="mt-3">
								<h4>Ingress Rules</h4>
								<div className="table-responsive">
									<table className="table table-sm">
										<thead>
											<tr>
												<th>Hostname</th>
												<th>Service</th>
												<th>Path</th>
											</tr>
										</thead>
										<tbody>
											{selectedTunnel.ingress_rules.map((rule, idx) => (
												<tr key={idx}>
													<td><code>{rule.hostname || "* (catch-all)"}</code></td>
													<td><code>{rule.service}</code></td>
													<td>{rule.path || "—"}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
};

export default TunnelsPage;
