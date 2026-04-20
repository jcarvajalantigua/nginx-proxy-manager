import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	getProviders,
	getProvider,
	createProvider,
	updateProvider,
	deleteProvider,
} from "src/api/sidecar";
import type { ProviderResponse, ProviderCreate, ProviderUpdate } from "src/api/sidecar/types";

const useProviders = (options = {}) => {
	return useQuery<ProviderResponse[], Error>({
		queryKey: ["providers"],
		queryFn: getProviders,
		staleTime: 60 * 1000,
		...options,
	});
};

const useProvider = (providerId: string, options = {}) => {
	return useQuery<ProviderResponse, Error>({
		queryKey: ["providers", providerId],
		queryFn: () => getProvider(providerId),
		enabled: !!providerId,
		...options,
	});
};

const useCreateProvider = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: ProviderCreate) => createProvider(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["providers"] });
		},
	});
};

const useUpdateProvider = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: ProviderUpdate }) => updateProvider(id, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["providers"] });
		},
	});
};

const useDeleteProvider = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => deleteProvider(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["providers"] });
		},
	});
};

export { useProviders, useProvider, useCreateProvider, useUpdateProvider, useDeleteProvider };
