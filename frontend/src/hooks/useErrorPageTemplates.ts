import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createErrorPageTemplate,
	deleteErrorPageTemplate,
	type ErrorPageTemplate,
	getErrorPageTemplates,
	getErrorPageTemplate,
	updateErrorPageTemplate,
} from "src/api/backend";

const QUERY_KEY = "error-page-templates";

const useErrorPageTemplates = (expand?: string[], options = {}) => {
	return useQuery<ErrorPageTemplate[], Error>({
		queryKey: [QUERY_KEY, expand],
		queryFn: () => getErrorPageTemplates(expand),
		staleTime: 60 * 1000,
		...options,
	});
};

const useErrorPageTemplate = (id: number, expand?: string[], options = {}) => {
	return useQuery<ErrorPageTemplate, Error>({
		queryKey: [QUERY_KEY, id, expand],
		queryFn: () => getErrorPageTemplate(id, expand),
		enabled: !!id,
		staleTime: 60 * 1000,
		...options,
	});
};

const useCreateErrorPageTemplate = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (values: Omit<ErrorPageTemplate, "id" | "createdOn" | "modifiedOn">) =>
			createErrorPageTemplate(values),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
		},
	});
};

const useUpdateErrorPageTemplate = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (values: Partial<ErrorPageTemplate> & { id: number }) =>
			updateErrorPageTemplate(values),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
		},
	});
};

const useDeleteErrorPageTemplate = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: number) => deleteErrorPageTemplate(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
		},
	});
};

export {
	useErrorPageTemplates,
	useErrorPageTemplate,
	useCreateErrorPageTemplate,
	useUpdateErrorPageTemplate,
	useDeleteErrorPageTemplate,
};
