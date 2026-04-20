import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	getBackends,
	getBackend,
	createBackend,
	updateBackend,
	deleteBackend,
	addNode,
	removeNode,
	toggleNode,
	runBackendHealthCheck,
	getBackendNginxConfig,
} from "src/api/sidecar";
import type { LBBackend } from "src/api/sidecar/types";

const useBackends = (options = {}) => {
	return useQuery<LBBackend[], Error>({
		queryKey: ["lb-backends"],
		queryFn: getBackends,
		staleTime: 30 * 1000,
		...options,
	});
};

const useBackend = (backendId: string, options = {}) => {
	return useQuery<LBBackend, Error>({
		queryKey: ["lb-backends", backendId],
		queryFn: () => getBackend(backendId),
		enabled: !!backendId,
		...options,
	});
};

const useCreateBackend = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (params: { name: string; strategy: string; sticky_sessions?: boolean }) => createBackend(params),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["lb-backends"] });
		},
	});
};

const useUpdateBackend = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, params }: { id: string; params: { name?: string; strategy?: string; sticky_sessions?: boolean; connection_limit?: number } }) => updateBackend(id, params),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["lb-backends"] });
		},
	});
};

const useDeleteBackend = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => deleteBackend(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["lb-backends"] });
		},
	});
};

const useAddNode = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ backendId, params }: { backendId: string; params: { host: string; port: number; weight?: number; max_connections?: number } }) => addNode(backendId, params),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["lb-backends"] });
		},
	});
};

const useRemoveNode = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ backendId, host, port }: { backendId: string; host: string; port: number }) => removeNode(backendId, host, port),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["lb-backends"] });
		},
	});
};

const useToggleNode = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ backendId, host, enabled }: { backendId: string; host: string; enabled: boolean }) => toggleNode(backendId, host, enabled),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["lb-backends"] });
		},
	});
};

const useBackendHealthCheck = () => {
	return useMutation<any, Error, string>({
		mutationFn: (backendId: string) => runBackendHealthCheck(backendId),
	});
};

const useBackendNginxConfig = (backendId: string) => {
	return useQuery<string, Error>({
		queryKey: ["lb-nginx-config", backendId],
		queryFn: () => getBackendNginxConfig(backendId),
		staleTime: 60 * 1000,
		enabled: false,
	});
};

export {
	useBackends,
	useBackend,
	useCreateBackend,
	useUpdateBackend,
	useDeleteBackend,
	useAddNode,
	useRemoveNode,
	useToggleNode,
	useBackendHealthCheck,
	useBackendNginxConfig,
};
