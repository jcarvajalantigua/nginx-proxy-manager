import * as api from "./base";
import type { ErrorPageTemplate } from "./models";

export async function getErrorPageTemplate(
	id: number,
	expand?: string[],
): Promise<ErrorPageTemplate> {
	return await api.get({
		url: `/error-page-templates/${id}`,
		params: {
			expand: expand?.join(","),
		},
	});
}
