import * as api from "./base";
import type { ErrorPageTemplate } from "./models";

export async function updateErrorPageTemplate(
	item: Partial<ErrorPageTemplate> & { id: number },
): Promise<ErrorPageTemplate> {
	const { id, ...data } = item;
	return await api.put({
		url: `/error-page-templates/${id}`,
		data: data,
	});
}
