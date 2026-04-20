import { useQuery } from "@tanstack/react-query";
import { getServiceInventory } from "src/api/sidecar";
import type { ServiceInfo } from "src/api/sidecar/types";

const useServiceInventory = (options = {}) => {
	return useQuery<ServiceInfo[], Error>({
		queryKey: ["service-inventory"],
		queryFn: getServiceInventory,
		staleTime: 60 * 1000,
		...options,
	});
};

export { useServiceInventory };
