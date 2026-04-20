import * as api from "./base";

export async function deleteErrorPageTemplate(id: number): Promise<{ result: boolean }> {
	return await api.del({
		url: `/error-page-templates/${id}`,
	});
}
