import { useState } from "react";
import { IconCloudComputing, IconPlus, IconTrash, IconRefresh, IconWorld } from "@tabler/icons-react";
import { useProviders, useCreateProvider, useDeleteProvider } from "src/hooks";
import type { ProviderCreate } from "src/api/sidecar/types";

const emptyProvider: ProviderCreate = {
	name: "",
	cf_api_token: "",
	cf_account_id: "",
	zones: {},
	tunnels: {},
	domains: [],
	notes: "",
};

const ProvidersPage = () => {
	const { data: providers, isLoading, refetch } = useProviders();
	const createMutation = useCreateProvider();
	const deleteMutation = useDeleteProvider();
	const [showForm, setShowForm] = useState(false);
	const [form, setForm] = useState<ProviderCreate>({ ...emptyProvider });
	const [zonesInput, setZonesInput] = useState("");
	const [domainsInput, setDomainsInput] = useState("");

	const handleCreate = async () => {
		// Parse zones: "domain:zone_id, domain2:zone_id2"
		const zones: Record<string, string> = {};
		zonesInput
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean)
			.forEach((pair) => {
				const [domain, zoneId] = pair.split(":").map((s) => s.trim());
				if (domain && zoneId) zones[domain] = zoneId;
			});

		const domains = domainsInput
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);

		await createMutation.mutateAsync({ ...form, zones, domains });
		setForm({ ...emptyProvider });
		setZonesInput("");
		setDomainsInput("");
		setShowForm(false);
	};

	const handleDelete = async (id: string, name: string) => {
		if (window.confirm(`Delete provider "${name}"?`)) {
			await deleteMutation.mutateAsync(id);
		}
	};

	return (
		<div>
			<div className="page-header d-print-none">
				<div className="row align-items-center">
					<div className="col-auto">
						<h2 className="page-title">
							<IconCloudComputing className="me-2" size={24} />
							Cloudflare Providers
						</h2>
					</div>
					<div className="col-auto ms-auto d-flex gap-2">
						<button type="button" className="btn btn-outline-primary" onClick={() => refetch()}>
							<IconRefresh size={16} className="me-1" />
							Refresh
						</button>
						<button
							type="button"
							className="btn btn-primary"
							onClick={() => setShowForm(!showForm)}
						>
							<IconPlus size={16} className="me-1" />
							Add Provider
						</button>
					</div>
				</div>
			</div>

			{/* Create Form */}
			{showForm && (
				<div className="card mb-4">
					<div className="card-header">
						<h3 className="card-title">New Provider</h3>
					</div>
					<div className="card-body">
						<div className="row g-3">
							<div className="col-md-6">
								<label className="form-label">Name</label>
								<input
									type="text"
									className="form-control"
									placeholder="TecHeels"
									value={form.name}
									onChange={(e) => setForm({ ...form, name: e.target.value })}
								/>
							</div>
							<div className="col-md-6">
								<label className="form-label">CF Account ID</label>
								<input
									type="text"
									className="form-control"
									value={form.cf_account_id}
									onChange={(e) => setForm({ ...form, cf_account_id: e.target.value })}
								/>
							</div>
							<div className="col-12">
								<label className="form-label">CF API Token</label>
								<input
									type="password"
									className="form-control"
									value={form.cf_api_token}
									onChange={(e) => setForm({ ...form, cf_api_token: e.target.value })}
								/>
							</div>
							<div className="col-md-6">
								<label className="form-label">Zones (domain:zone_id, ...)</label>
								<input
									type="text"
									className="form-control"
									placeholder="techeels.io:abc123, femrd.net:def456"
									value={zonesInput}
									onChange={(e) => setZonesInput(e.target.value)}
								/>
							</div>
							<div className="col-md-6">
								<label className="form-label">Domains (comma separated)</label>
								<input
									type="text"
									className="form-control"
									placeholder="techeels.io, femrd.net"
									value={domainsInput}
									onChange={(e) => setDomainsInput(e.target.value)}
								/>
							</div>
							<div className="col-12">
								<label className="form-label">Notes</label>
								<textarea
									className="form-control"
									rows={2}
									value={form.notes}
									onChange={(e) => setForm({ ...form, notes: e.target.value })}
								/>
							</div>
						</div>
					</div>
					<div className="card-footer text-end">
						<button
							type="button"
							className="btn btn-secondary me-2"
							onClick={() => setShowForm(false)}
						>
							Cancel
						</button>
						<button
							type="button"
							className="btn btn-primary"
							onClick={handleCreate}
							disabled={createMutation.isPending || !form.name || !form.cf_api_token}
						>
							{createMutation.isPending ? "Creating..." : "Create Provider"}
						</button>
					</div>
				</div>
			)}

			{/* Providers Table */}
			<div className="card">
				<div className="table-responsive">
					<table className="table table-vcenter card-table">
						<thead>
							<tr>
								<th>Name</th>
								<th>Account ID</th>
								<th>Token</th>
								<th>Zones</th>
								<th>Domains</th>
								<th>Updated</th>
								<th className="w-1">Actions</th>
							</tr>
						</thead>
						<tbody>
							{isLoading && (
								<tr>
									<td colSpan={7} className="text-center py-4">
										<div className="spinner-border spinner-border-sm text-primary" />
									</td>
								</tr>
							)}
							{providers?.length === 0 && !isLoading && (
								<tr>
									<td colSpan={7} className="text-center text-muted py-4">
										No providers configured yet
									</td>
								</tr>
							)}
							{providers?.map((p) => (
								<tr key={p.id}>
									<td className="fw-bold">
										<IconWorld size={16} className="me-1 text-primary" />
										{p.name}
									</td>
									<td>
										<code className="small">{p.cf_account_id.slice(0, 12)}...</code>
									</td>
									<td>
										<code className="small">...{p.cf_api_token_hint}</code>
									</td>
									<td>
										{Object.keys(p.zones).map((z) => (
											<span key={z} className="badge bg-blue-lt me-1">
												{z}
											</span>
										))}
									</td>
									<td>
										{p.domains.map((d) => (
											<span key={d} className="badge bg-purple-lt me-1">
												{d}
											</span>
										))}
									</td>
									<td>
										<small className="text-muted">{p.updated_at?.slice(0, 10)}</small>
									</td>
									<td>
										<button
											type="button"
											className="btn btn-ghost-danger btn-sm"
											onClick={() => handleDelete(p.id, p.name)}
											disabled={deleteMutation.isPending}
											title="Delete"
										>
											<IconTrash size={16} />
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
};

export default ProvidersPage;
