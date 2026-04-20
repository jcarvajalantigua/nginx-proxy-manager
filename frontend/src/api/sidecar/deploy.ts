import { sidecarGet, sidecarPost } from "./base";
import type { DeployRequest, DeployResponse, DeployStatusAll } from "./types";

/** GET /deploy/status/all — returns {success, data: {sajet: {...}, odoo17: {...}, ...}} */
export function getDeployStatusAll(): Promise<DeployStatusAll> {
	return sidecarGet<DeployStatusAll>("/deploy/status/all");
}

/** POST /deploy/{target} — execute deploy action on a target */
export function executeDeploy(data: DeployRequest): Promise<DeployResponse> {
	return sidecarPost<DeployResponse>(`/deploy/${data.target}`, {
		action: data.action,
		branch: data.branch,
		force: data.force,
	});
}
