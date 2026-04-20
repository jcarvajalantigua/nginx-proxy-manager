import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllTunnels, getTunnelById, updateTunnelIngress, createTunnelDNS } from "src/api/sidecar";
import type { TunnelInfo, TunnelIngressRule } from "src/api/sidecar/types";

const useAllTunnels = (options = {}) => {
	return useQuery<TunnelInfo[], Error>({
		queryKey: ["tunnels"],
		queryFn: getAllTunnels,
		staleTime: 30 * 1000,
		...options,
	});
};

const useTunnelById = (tunnelId: string, options = {}) => {
	return useQuery<TunnelInfo, Error>({
		queryKey: ["tunnels", tunnelId],
		queryFn: () => getTunnelById(tunnelId),
		enabled: !!tunnelId,
		staleTime: 30 * 1000,
		...options,
	});
};

const useUpdateTunnelIngress = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ tunnelId, rules }: { tunnelId: string; rules: TunnelIngressRule[] }) =>
			updateTunnelIngress(tunnelId, rules),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["tunnels"] });
		},
	});
};

const useCreateTunnelDNS = () => {
	return useMutation({
		mutationFn: (domain: string) => createTunnelDNS(domain),
	});
};

export { useAllTunnels, useTunnelById, useUpdateTunnelIngress, useCreateTunnelDNS };
