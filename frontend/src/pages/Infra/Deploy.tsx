import { useState } from "react";
import { IconRocket, IconPlayerPlay, IconLoader } from "@tabler/icons-react";
import { useDeployStatusAll, useExecuteDeploy } from "src/hooks";
import type { DeployTargetType, DeployResponse } from "src/api/sidecar/types";

const targetMeta: Record<string, { label: string; pct: number; color: string }> = {
	sajet: { label: "SAJET ERP Core", pct: 202, color: "bg-green" },
	odoo17: { label: "Odoo 17 Multi-tenant", pct: 201, color: "bg-blue" },
	odoo19: { label: "Odoo 19 Jeturing", pct: 204, color: "bg-purple" },
	postal: { label: "Postal Mail", pct: 206, color: "bg-orange" },
};

const actions = ["status", "restart", "pull", "update"];

const DeployPage = () => {
	const { data: statusAll, isLoading } = useDeployStatusAll();
	const deployMutation = useExecuteDeploy();
	const [results, setResults] = useState<DeployResponse[]>([]);
	const [activeOp, setActiveOp] = useState<string | null>(null);

	// Extract targets from the API response or fall back to hardcoded
	const targets = statusAll?.data ? Object.keys(statusAll.data) : Object.keys(targetMeta);

	const handleDeploy = async (target: DeployTargetType, action: string) => {
		const opKey = `${target}-${action}`;
		setActiveOp(opKey);
		try {
			const result = await deployMutation.mutateAsync({
				target,
				action,
				force: false,
			});
			setResults((prev) => [result, ...prev.slice(0, 19)]);
		} catch (err: any) {
			setResults((prev) => [
				{
					target,
					action,
					success: false,
					output: err.message || "Error",
					duration_ms: 0,
				},
				...prev.slice(0, 19),
			]);
		}
		setActiveOp(null);
	};

	return (
		<div>
			<div className="page-header d-print-none">
				<div className="row align-items-center">
					<div className="col-auto">
						<h2 className="page-title">
							<IconRocket className="me-2" size={24} />
							Deploy Panel
						</h2>
					</div>
				</div>
			</div>

			{/* Deploy Targets Grid */}
			<div className="row row-cards mb-4">
				{isLoading && (
					<div className="col-12 text-center py-4">
						<div className="spinner-border text-primary" />
					</div>
				)}
				{targets.map((t) => {
					const meta = targetMeta[t] || {
						label: t,
						pct: 0,
						color: "bg-secondary",
					};
					const targetStatus = statusAll?.data?.[t];
					return (
						<div key={t} className="col-sm-6 col-lg-3">
							<div className="card">
								<div className={`card-status-top ${meta.color}`} />
								<div className="card-body">
									<h3 className="card-title">{meta.label}</h3>
									<p className="text-muted">
										PCT {meta.pct} — <code>{t}</code>
									</p>
									{targetStatus && (
										<p className="mb-2">
											<span className={`badge ${targetStatus.status === "running" ? "bg-green" : "bg-yellow"} text-white`}>
												{targetStatus.status}
											</span>
										</p>
									)}
									<div className="btn-list">
										{actions.map((action) => {
											const opKey = `${t}-${action}`;
											const isRunning = activeOp === opKey;
											return (
												<button
													key={action}
													type="button"
													className={`btn btn-sm ${action === "restart" ? "btn-outline-warning" : action === "status" ? "btn-outline-info" : "btn-outline-primary"}`}
													onClick={() => handleDeploy(t as DeployTargetType, action)}
													disabled={isRunning}
												>
													{isRunning ? (
														<IconLoader size={14} className="me-1 spinner-border spinner-border-sm" />
													) : (
														<IconPlayerPlay size={14} className="me-1" />
													)}
													{action}
												</button>
											);
										})}
									</div>
								</div>
							</div>
						</div>
					);
				})}
			</div>

			{/* Results Log */}
			{results.length > 0 && (
				<div className="card">
					<div className="card-header">
						<h3 className="card-title">Execution Log</h3>
						<div className="card-actions">
							<button
								type="button"
								className="btn btn-sm btn-outline-secondary"
								onClick={() => setResults([])}
							>
								Clear
							</button>
						</div>
					</div>
					<div className="card-body p-0" style={{ maxHeight: "400px", overflow: "auto" }}>
						{results.map((r, idx) => (
							<div
								key={idx}
								className={`p-3 border-bottom ${r.success ? "" : "bg-red-lt"}`}
							>
								<div className="d-flex justify-content-between align-items-center mb-1">
									<div>
										<span className={`badge ${r.success ? "bg-green" : "bg-red"} text-white me-2`}>
											{r.success ? "OK" : "FAIL"}
										</span>
										<strong>{r.target}</strong>
										<span className="text-muted ms-2">→ {r.action}</span>
									</div>
									{r.duration_ms > 0 && (
										<small className="text-muted">{r.duration_ms.toFixed(0)}ms</small>
									)}
								</div>
								<pre
									className="mb-0 small text-muted"
									style={{
										maxHeight: "120px",
										overflow: "auto",
										whiteSpace: "pre-wrap",
									}}
								>
									{r.output || "No output"}
								</pre>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
};

export default DeployPage;
