import { useQuery, useMutation } from "@tanstack/react-query";
import { getDeployStatusAll, executeDeploy } from "src/api/sidecar";
import type { DeployRequest, DeployResponse, DeployStatusAll } from "src/api/sidecar/types";

const useDeployStatusAll = (options = {}) => {
	return useQuery<DeployStatusAll, Error>({
		queryKey: ["deploy-status"],
		queryFn: getDeployStatusAll,
		staleTime: 30 * 1000,
		...options,
	});
};

const useExecuteDeploy = () => {
	return useMutation<DeployResponse, Error, DeployRequest>({
		mutationFn: (data: DeployRequest) => executeDeploy(data),
	});
};

export { useDeployStatusAll, useExecuteDeploy };
