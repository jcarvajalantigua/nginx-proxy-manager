import { useQuery } from "@tanstack/react-query";
import { getInfraHealth } from "src/api/sidecar";
import type { HealthResponse } from "src/api/sidecar/types";

const useInfraHealth = (options = {}) => {
	return useQuery<HealthResponse, Error>({
		queryKey: ["infra-health"],
		queryFn: getInfraHealth,
		refetchInterval: 30 * 1000,
		staleTime: 25 * 1000,
		...options,
	});
};

export { useInfraHealth };
