import * as api from "./base";
import type { ErrorPageTemplate } from "./models";

export async function getErrorPageTemplates(
	expand?: string[],
	params = {},
): Promise<ErrorPageTemplate[]> {
	return await api.get({
		url: "/error-page-templates",
		params: {
			expand: expand?.join(","),
			...params,
		},
	});
}
