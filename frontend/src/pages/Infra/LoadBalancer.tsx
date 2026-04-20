import { useState } from "react";
import {
	IconScale,
	IconPlus,
	IconTrash,
	IconRefresh,
	IconServer2,
	IconPlayerPlay,
	IconPlayerStop,
} from "@tabler/icons-react";
import {
	useBackends,
	useCreateBackend,
	useUpdateBackend,
	useDeleteBackend,
	useAddNode,
	useRemoveNode,
	useToggleNode,
} from "src/hooks";
import type { LBStrategy } from "src/api/sidecar/types";

const strategies: LBStrategy[] = ["round-robin", "weighted", "least-connections", "ip-hash", "failover"];

const LoadBalancerPage = () => {
	const { data: backends, isLoading, refetch } = useBackends();
	const createBackend = useCreateBackend();
	const updateBackendMut = useUpdateBackend();
	const deleteBackend = useDeleteBackend();
	const addNodeMutation = useAddNode();
	const removeNodeMutation = useRemoveNode();
	const toggleNodeMutation = useToggleNode();

	const [showBackendForm, setShowBackendForm] = useState(false);
	const [backendForm, setBackendForm] = useState({ name: "", strategy: "round-robin" as string });
	const [showNodeForm, setShowNodeForm] = useState<string | null>(null);
	const [nodeForm, setNodeForm] = useState({ host: "", port: 80, weight: 1 });
	const [editingBackend, setEditingBackend] = useState<string | null>(null);
	const [editForm, setEditForm] = useState({ name: "", strategy: "" });

	const handleCreateBackend = async () => {
		await createBackend.mutateAsync({ name: backendForm.name, strategy: backendForm.strategy });
		setBackendForm({ name: "", strategy: "round-robin" });
		setShowBackendForm(false);
	};

	const handleAddNode = async (backendId: string) => {
		await addNodeMutation.mutateAsync({ backendId, params: { host: nodeForm.host, port: nodeForm.port, weight: nodeForm.weight } });
		setNodeForm({ host: "", port: 80, weight: 1 });
		setShowNodeForm(null);
	};

	const handleEditBackend = async (backendId: string) => {
		await updateBackendMut.mutateAsync({ id: backendId, params: { name: editForm.name || undefined, strategy: editForm.strategy || undefined } });
		setEditingBackend(null);
	};

	return (
		<div>
			<div className="page-header d-print-none">
				<div className="row align-items-center">
					<div className="col-auto">
						<h2 className="page-title"><IconScale className="me-2" size={24} />Load Balancer</h2>
					</div>
					<div className="col-auto ms-auto d-flex gap-2">
						<button type="button" className="btn btn-outline-primary" onClick={() => refetch()}>
							<IconRefresh size={16} className="me-1" />Refresh
						</button>
						<button type="button" className="btn btn-primary" onClick={() => setShowBackendForm(!showBackendForm)}>
							<IconPlus size={16} className="me-1" />Add Backend
						</button>
					</div>
				</div>
			</div>

			{showBackendForm && (
				<div className="card mb-4">
					<div className="card-header"><h3 className="card-title">New Backend Pool</h3></div>
					<div className="card-body">
						<div className="row g-3">
							<div className="col-md-6">
								<label className="form-label">Name</label>
								<input type="text" className="form-control" placeholder="lb_sajet"
									value={backendForm.name} onChange={(e) => setBackendForm({ ...backendForm, name: e.target.value })} />
							</div>
							<div className="col-md-6">
								<label className="form-label">Strategy</label>
								<select className="form-select" value={backendForm.strategy}
									onChange={(e) => setBackendForm({ ...backendForm, strategy: e.target.value })}>
									{strategies.map(s => <option key={s} value={s}>{s}</option>)}
								</select>
							</div>
						</div>
					</div>
					<div className="card-footer text-end">
						<button type="button" className="btn btn-secondary me-2" onClick={() => setShowBackendForm(false)}>Cancel</button>
						<button type="button" className="btn btn-primary" onClick={handleCreateBackend}
							disabled={createBackend.isPending || !backendForm.name}>
							{createBackend.isPending ? "Creating..." : "Create Backend"}
						</button>
					</div>
				</div>
			)}

			{isLoading && <div className="text-center py-4"><div className="spinner-border text-primary" /></div>}

			{backends?.map((backend) => (
				<div key={backend.id} className="card mb-3">
					<div className="card-header">
						<div className="col">
							{editingBackend === backend.id ? (
								<div className="row g-2 align-items-end">
									<div className="col-auto">
										<input type="text" className="form-control form-control-sm" value={editForm.name}
											onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
									</div>
									<div className="col-auto">
										<select className="form-select form-select-sm" value={editForm.strategy}
											onChange={(e) => setEditForm({ ...editForm, strategy: e.target.value })}>
											{strategies.map(s => <option key={s} value={s}>{s}</option>)}
										</select>
									</div>
									<div className="col-auto">
										<button type="button" className="btn btn-sm btn-primary" onClick={() => handleEditBackend(backend.id)}>Save</button>
										<button type="button" className="btn btn-sm btn-secondary ms-1" onClick={() => setEditingBackend(null)}>Cancel</button>
									</div>
								</div>
							) : (
								<>
									<h3 className="card-title"><IconServer2 size={18} className="me-2" />{backend.name}</h3>
									<div className="card-subtitle">
										<span className="badge bg-cyan-lt me-2">{backend.strategy}</span>
										{backend.domains?.length > 0 && (
											<span className="text-muted me-2">{backend.domains.slice(0, 3).join(", ")}{backend.domains.length > 3 && ` +${backend.domains.length - 3}`}</span>
										)}
										{backend.health_check?.enabled && (
											<span className="text-muted">Health: {backend.health_check.path} every {backend.health_check.interval_sec}s</span>
										)}
									</div>
								</>
							)}
						</div>
						<div className="card-actions d-flex gap-1">
							<button type="button" className="btn btn-sm btn-outline-secondary"
								onClick={() => { setEditingBackend(backend.id); setEditForm({ name: backend.name, strategy: backend.strategy }); }}>Edit</button>
							<button type="button" className="btn btn-sm btn-outline-primary"
								onClick={() => setShowNodeForm(showNodeForm === backend.id ? null : backend.id)}>
								<IconPlus size={14} className="me-1" />Node
							</button>
							<button type="button" className="btn btn-sm btn-ghost-danger"
								onClick={() => { if (window.confirm(`Delete backend "${backend.name}"?`)) deleteBackend.mutate(backend.id); }}>
								<IconTrash size={14} />
							</button>
						</div>
					</div>

					{showNodeForm === backend.id && (
						<div className="card-body bg-light">
							<div className="row g-2 align-items-end">
								<div className="col-md-4">
									<label className="form-label">Host</label>
									<input type="text" className="form-control form-control-sm" placeholder="10.10.20.202"
										value={nodeForm.host} onChange={(e) => setNodeForm({ ...nodeForm, host: e.target.value })} />
								</div>
								<div className="col-md-2">
									<label className="form-label">Port</label>
									<input type="number" className="form-control form-control-sm"
										value={nodeForm.port} onChange={(e) => setNodeForm({ ...nodeForm, port: parseInt(e.target.value) || 80 })} />
								</div>
								<div className="col-md-2">
									<label className="form-label">Weight</label>
									<input type="number" className="form-control form-control-sm"
										value={nodeForm.weight} onChange={(e) => setNodeForm({ ...nodeForm, weight: parseInt(e.target.value) || 1 })} />
								</div>
								<div className="col-auto">
									<button type="button" className="btn btn-sm btn-primary" onClick={() => handleAddNode(backend.id)}
										disabled={addNodeMutation.isPending || !nodeForm.host}>Add</button>
								</div>
							</div>
						</div>
					)}

					{backend.nodes?.length > 0 ? (
						<div className="table-responsive">
							<table className="table table-vcenter card-table table-sm">
								<thead>
									<tr><th>Host</th><th>Port</th><th>Weight</th><th>Health</th><th>Failures</th><th>Enabled</th><th>Actions</th></tr>
								</thead>
								<tbody>
									{backend.nodes.map((node, idx) => (
										<tr key={`${node.host}-${node.port}-${idx}`}>
											<td><code>{node.host}</code></td>
											<td>{node.port}</td>
											<td>{node.weight}</td>
											<td><span className={`badge ${node.healthy ? "bg-green" : "bg-red"} text-white`}>{node.healthy ? "healthy" : "unhealthy"}</span></td>
											<td>{node.check_failures}</td>
											<td>
												<button type="button" className={`btn btn-sm ${node.enabled ? "btn-outline-warning" : "btn-outline-success"}`}
													onClick={() => toggleNodeMutation.mutate({ backendId: backend.id, host: node.host, enabled: !node.enabled })}
													disabled={toggleNodeMutation.isPending}>
													{node.enabled ? <><IconPlayerStop size={14} /> Disable</> : <><IconPlayerPlay size={14} /> Enable</>}
												</button>
											</td>
											<td>
												<button type="button" className="btn btn-sm btn-ghost-danger"
													onClick={() => { if (window.confirm(`Remove node ${node.host}:${node.port}?`)) removeNodeMutation.mutate({ backendId: backend.id, host: node.host, port: node.port }); }}>
													<IconTrash size={14} />
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : (
						<div className="card-body text-center text-muted">No nodes configured</div>
					)}
				</div>
			))}

			{backends?.length === 0 && !isLoading && (
				<div className="card"><div className="card-body text-center text-muted py-4">No backends configured. Create one to start load balancing.</div></div>
			)}
		</div>
	);
};

export default LoadBalancerPage;
