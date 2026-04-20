import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	getDocsSettings,
	updateDocsSettings,
	rotateDocsApiKey,
	getCorsSettings,
	updateCorsSettings,
	getMaintenanceSettings,
	updateMaintenanceSettings,
	getApiKeys,
	createApiKey,
	deleteApiKey,
} from "src/api/sidecar";
import type { DocsSettings, CorsSettings, MaintenanceSettings, ApiKeyEntry } from "src/api/sidecar/types";

// ---- Docs ----
const useDocsSettings = (options = {}) => {
	return useQuery<DocsSettings, Error>({
		queryKey: ["settings-docs"],
		queryFn: getDocsSettings,
		staleTime: 60 * 1000,
		...options,
	});
};

const useUpdateDocsSettings = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (params: { docs_enabled?: boolean; docs_require_internal?: boolean }) => updateDocsSettings(params),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["settings-docs"] });
		},
	});
};

const useRotateDocsApiKey = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: rotateDocsApiKey,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["settings-docs"] });
		},
	});
};

// ---- CORS ----
const useCorsSettings = (options = {}) => {
	return useQuery<CorsSettings, Error>({
		queryKey: ["settings-cors"],
		queryFn: getCorsSettings,
		staleTime: 60 * 1000,
		...options,
	});
};

const useUpdateCorsSettings = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (origins: string[]) => updateCorsSettings(origins),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["settings-cors"] });
		},
	});
};

// ---- Maintenance ----
const useMaintenanceSettings = (options = {}) => {
	return useQuery<MaintenanceSettings, Error>({
		queryKey: ["settings-maintenance"],
		queryFn: getMaintenanceSettings,
		staleTime: 60 * 1000,
		...options,
	});
};

const useUpdateMaintenanceSettings = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (enabled: boolean) => updateMaintenanceSettings(enabled),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["settings-maintenance"] });
		},
	});
};

// ---- API Keys ----
const useApiKeys = (options = {}) => {
	return useQuery<ApiKeyEntry[], Error>({
		queryKey: ["settings-api-keys"],
		queryFn: getApiKeys,
		staleTime: 60 * 1000,
		...options,
	});
};

const useCreateApiKey = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (name?: string) => createApiKey(name),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["settings-api-keys"] });
		},
	});
};

const useDeleteApiKey = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (keyId: string) => deleteApiKey(keyId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["settings-api-keys"] });
		},
	});
};

export {
	useDocsSettings,
	useUpdateDocsSettings,
	useRotateDocsApiKey,
	useCorsSettings,
	useUpdateCorsSettings,
	useMaintenanceSettings,
	useUpdateMaintenanceSettings,
	useApiKeys,
	useCreateApiKey,
	useDeleteApiKey,
};
