import {
	IconServer,
	IconDatabase,
	IconCloud,
	IconMail,
	IconShieldCheck,
	IconActivity,
	IconRefresh,
} from "@tabler/icons-react";
import { useInfraHealth, useServiceInventory } from "src/hooks";
import type { ServiceHealth, ServiceStatusType } from "src/api/sidecar/types";

const statusColors: Record<ServiceStatusType, string> = {
	healthy: "bg-green",
	unhealthy: "bg-red",
	unreachable: "bg-yellow",
	unknown: "bg-secondary",
};

const statusLabels: Record<ServiceStatusType, string> = {
	healthy: "Healthy",
	unhealthy: "Unhealthy",
	unreachable: "Unreachable",
	unknown: "Unknown",
};

const roleIcons: Record<string, React.ElementType> = {
	database: IconDatabase,
	"erp-odoo17": IconServer,
	"erp-core": IconShieldCheck,
	cache: IconDatabase,
	"erp-odoo19": IconServer,
	"proxy-manager": IconCloud,
	mail: IconMail,
};

function ServiceCard({ service }: { service: ServiceHealth }) {
	const Icon = roleIcons["database"] || IconServer;
	const color = statusColors[service.status];

	return (
		<div className="col-sm-6 col-lg-4">
			<div className="card card-sm">
				<div className="card-body">
					<div className="row align-items-center">
						<div className="col-auto">
							<span className={`avatar ${color} text-white`}>
								<Icon size={24} />
							</span>
						</div>
						<div className="col">
							<div className="fw-bold">
								PCT {service.pct} — {service.name}
							</div>
							<div className="text-secondary">
								{service.ip}:{service.port}
							</div>
							<div className="d-flex align-items-center mt-1">
								<span className={`badge ${color} text-white me-2`}>
									{statusLabels[service.status]}
								</span>
								{service.responseMs !== null && (
									<small className="text-muted">{service.responseMs}ms</small>
								)}
							</div>
							{service.detail && (
								<small className="text-muted d-block mt-1">{service.detail}</small>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

const InfraDashboard = () => {
	const { data: health, isLoading, refetch, dataUpdatedAt } = useInfraHealth();
	const { data: inventory } = useServiceInventory();

	return (
		<div>
			<div className="page-header d-print-none">
				<div className="row align-items-center">
					<div className="col-auto">
						<h2 className="page-title">
							<IconActivity className="me-2" size={24} />
							Infrastructure Dashboard
						</h2>
					</div>
					<div className="col-auto ms-auto">
						<button
							type="button"
							className="btn btn-primary"
							onClick={() => refetch()}
							disabled={isLoading}
						>
							<IconRefresh size={16} className="me-1" />
							Refresh
						</button>
					</div>
				</div>
			</div>

			{/* Summary Cards */}
			{health && (
				<div className="row row-cards mb-4">
					<div className="col-sm-6 col-lg-3">
						<div className="card">
							<div className="card-body">
								<div className="d-flex align-items-center">
									<div className="subheader">Total Services</div>
								</div>
								<div className="h1 mb-0">{health.total}</div>
							</div>
						</div>
					</div>
					<div className="col-sm-6 col-lg-3">
						<div className="card">
							<div className="card-body">
								<div className="d-flex align-items-center">
									<div className="subheader text-green">Healthy</div>
								</div>
								<div className="h1 mb-0 text-green">{health.healthy}</div>
							</div>
						</div>
					</div>
					<div className="col-sm-6 col-lg-3">
						<div className="card">
							<div className="card-body">
								<div className="d-flex align-items-center">
									<div className="subheader text-red">Unhealthy</div>
								</div>
								<div className="h1 mb-0 text-red">{health.unhealthy}</div>
							</div>
						</div>
					</div>
					<div className="col-sm-6 col-lg-3">
						<div className="card">
							<div className="card-body">
								<div className="d-flex align-items-center">
									<div className="subheader text-muted">Status</div>
								</div>
								<div className="h1 mb-0">
									<span
										className={`badge ${health.status === "ok" ? "bg-green" : "bg-yellow"} text-white`}
									>
										{health.status.toUpperCase()}
									</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Service Grid */}
			<div className="row row-cards">
				{isLoading && (
					<div className="col-12 text-center py-4">
						<div className="spinner-border text-primary" role="status" />
						<div className="mt-2 text-muted">Checking services...</div>
					</div>
				)}
				{health?.services.map((svc) => (
					<ServiceCard key={svc.pct} service={svc} />
				))}
			</div>

			{/* Service Inventory Table */}
			{inventory && inventory.length > 0 && (
				<div className="card mt-4">
					<div className="card-header">
						<h3 className="card-title">Service Inventory</h3>
					</div>
					<div className="table-responsive">
						<table className="table table-vcenter card-table">
							<thead>
								<tr>
									<th>PCT</th>
									<th>Name</th>
									<th>IP</th>
									<th>Ports</th>
									<th>Role</th>
									<th>Domains</th>
								</tr>
							</thead>
							<tbody>
								{inventory.map((svc) => (
									<tr key={svc.pct}>
										<td>
											<span className="badge bg-blue-lt">{svc.pct}</span>
										</td>
										<td className="fw-bold">{svc.name}</td>
										<td>
											<code>{svc.ip}</code>
										</td>
										<td>{svc.ports.join(", ")}</td>
										<td>
											<span className="badge bg-cyan-lt">{svc.role}</span>
										</td>
										<td>
											{svc.domains.length > 0
												? svc.domains.map((d) => (
														<span key={d} className="badge bg-purple-lt me-1">
															{d}
														</span>
													))
												: <span className="text-muted">—</span>}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{dataUpdatedAt && (
				<div className="text-muted text-end mt-2">
					<small>Last updated: {new Date(dataUpdatedAt).toLocaleTimeString()}</small>
				</div>
			)}
		</div>
	);
};

export default InfraDashboard;
