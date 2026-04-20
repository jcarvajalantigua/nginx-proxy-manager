import * as api from "./base";
import type { ErrorPageTemplate } from "./models";

export async function createErrorPageTemplate(
	item: Omit<ErrorPageTemplate, "id" | "createdOn" | "modifiedOn">,
): Promise<ErrorPageTemplate> {
	return await api.post({
		url: "/error-page-templates",
		data: item,
	});
}
