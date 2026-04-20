import fs from "node:fs";
import path from "node:path";
import errs from "../lib/error.js";
import errorPageTemplateModel from "../models/error_page_template.js";
import internalNginx from "./nginx.js";

const ERROR_PAGES_DIR = "/data/nginx/error_pages";

/**
 * Ensures the error_pages directory exists
 */
const ensureDir = () => {
	if (!fs.existsSync(ERROR_PAGES_DIR)) {
		fs.mkdirSync(ERROR_PAGES_DIR, { recursive: true });
	}
};

/**
 * Replaces {{variable}} placeholders in HTML with values from variables object
 * @param {string} html
 * @param {object} variables
 * @returns {string}
 */
const renderHtml = (html, variables) => {
	let rendered = html;
	for (const [key, value] of Object.entries(variables || {})) {
		rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
	}
	return rendered;
};

/**
 * Writes the error page HTML file to disk
 * @param {object} template
 */
const writeErrorPageFile = (template) => {
	ensureDir();
	const rendered = renderHtml(template.html_content, template.variables);
	const codes = Array.isArray(template.error_codes) ? template.error_codes : JSON.parse(template.error_codes);

	// Write one file per error code for this template
	// Filename pattern: {proxy_host_id|global}_{code}.html
	const prefix = template.proxy_host_id ? `host_${template.proxy_host_id}` : "global";
	for (const code of codes) {
		const filename = path.join(ERROR_PAGES_DIR, `${prefix}_${code}.html`);
		fs.writeFileSync(filename, rendered, { encoding: "utf8" });
	}
};

/**
 * Removes error page files for a template
 * @param {object} template
 */
const removeErrorPageFiles = (template) => {
	const codes = Array.isArray(template.error_codes) ? template.error_codes : JSON.parse(template.error_codes);
	const prefix = template.proxy_host_id ? `host_${template.proxy_host_id}` : "global";

	for (const code of codes) {
		const filename = path.join(ERROR_PAGES_DIR, `${prefix}_${code}.html`);
		if (fs.existsSync(filename)) {
			fs.unlinkSync(filename);
		}
	}
};

/**
 * Regenerates all active error page files from the database
 */
const regenerateAll = async () => {
	ensureDir();

	// Clean existing files
	const existing = fs.readdirSync(ERROR_PAGES_DIR);
	for (const file of existing) {
		if (file.endsWith(".html")) {
			fs.unlinkSync(path.join(ERROR_PAGES_DIR, file));
		}
	}

	// Write all active templates
	const templates = await errorPageTemplateModel
		.query()
		.where("is_active", true);

	for (const tpl of templates) {
		writeErrorPageFile(tpl);
	}
};

/**
 * Returns the nginx error_page directives for a given proxy_host_id
 * Falls back to global templates if no host-specific template exists
 * @param {number|null} proxyHostId
 * @returns {Promise<string>} nginx config snippet
 */
const getNginxDirectives = async (proxyHostId) => {
	// Get host-specific templates first, then global
	const hostTemplates = proxyHostId
		? await errorPageTemplateModel
				.query()
				.where("proxy_host_id", proxyHostId)
				.andWhere("is_active", true)
		: [];

	const globalTemplates = await errorPageTemplateModel
		.query()
		.whereNull("proxy_host_id")
		.andWhere("is_active", true);

	// Merge: host-specific overrides global for same error codes
	const codeMap = new Map();

	// Global first (will be overridden by host-specific)
	for (const tpl of globalTemplates) {
		const codes = Array.isArray(tpl.error_codes) ? tpl.error_codes : JSON.parse(tpl.error_codes);
		for (const code of codes) {
			codeMap.set(code, { prefix: "global", code });
		}
	}

	// Host-specific overrides
	for (const tpl of hostTemplates) {
		const codes = Array.isArray(tpl.error_codes) ? tpl.error_codes : JSON.parse(tpl.error_codes);
		for (const code of codes) {
			codeMap.set(code, { prefix: `host_${proxyHostId}`, code });
		}
	}

	if (codeMap.size === 0) {
		return "";
	}

	let directives = "\n  # Custom Error Pages\n";
	for (const [code, info] of codeMap) {
		directives += `  error_page ${code} /_error_pages/${info.prefix}_${code}.html;\n`;
	}
	directives += `  location /_error_pages/ {\n`;
	directives += `    internal;\n`;
	directives += `    root /data/nginx;\n`;
	directives += `  }\n`;

	return directives;
};

const internalErrorPageTemplate = {
	/**
	 * Create a new error page template
	 * @param {Access} access
	 * @param {Object} data
	 * @returns {Promise}
	 */
	create: (access, data) => {
		return access
			.can("settings:update", "error-pages")
			.then(() => {
				return errorPageTemplateModel.query().insertAndFetch(data);
			})
			.then((row) => {
				if (row.is_active) {
					writeErrorPageFile(row);
				}
				return row;
			});
	},

	/**
	 * Update an existing error page template
	 * @param {Access} access
	 * @param {Object} data
	 * @returns {Promise}
	 */
	update: (access, data) => {
		return access
			.can("settings:update", "error-pages")
			.then(() => {
				return internalErrorPageTemplate.get(access, { id: data.id });
			})
			.then((existingRow) => {
				// Remove old files before update
				removeErrorPageFiles(existingRow);

				return errorPageTemplateModel
					.query()
					.where({ id: data.id })
					.patch(data)
					.then(() => {
						return internalErrorPageTemplate.get(access, { id: data.id });
					});
			})
			.then((row) => {
				if (row.is_active) {
					writeErrorPageFile(row);
				}
				return row;
			});
	},

	/**
	 * Get a single error page template
	 * @param {Access} access
	 * @param {Object} data
	 * @param {Number} data.id
	 * @returns {Promise}
	 */
	get: (access, data) => {
		return access
			.can("settings:get", "error-pages")
			.then(() => {
				return errorPageTemplateModel
					.query()
					.where("id", data.id)
					.allowGraph("[proxy_host]")
					.first();
			})
			.then((row) => {
				if (!row) {
					throw new errs.ItemNotFoundError(data.id);
				}
				return row;
			});
	},

	/**
	 * Get all error page templates
	 * @param {Access} access
	 * @param {string} [expand]
	 * @returns {Promise}
	 */
	getAll: (access, expand) => {
		return access.can("settings:list").then(() => {
			const query = errorPageTemplateModel
				.query()
				.allowGraph("[proxy_host]")
				.orderBy("created_on", "DESC");

			if (typeof expand !== "undefined" && expand !== null) {
				query.withGraphFetched(`[${expand.join(", ")}]`);
			}

			return query;
		});
	},

	/**
	 * Delete an error page template
	 * @param {Access} access
	 * @param {Object} data
	 * @param {Number} data.id
	 * @returns {Promise}
	 */
	delete: (access, data) => {
		return access
			.can("settings:update", "error-pages")
			.then(() => {
				return internalErrorPageTemplate.get(access, { id: data.id });
			})
			.then((row) => {
				removeErrorPageFiles(row);
				return errorPageTemplateModel.query().deleteById(data.id);
			})
			.then(() => {
				return true;
			});
	},

	/**
	 * Preview: renders the HTML with the given variables without saving
	 * @param {Access} access
	 * @param {Object} data
	 * @returns {Promise<string>}
	 */
	preview: (access, data) => {
		return access.can("settings:get", "error-pages").then(() => {
			return renderHtml(data.html_content || "", data.variables || {});
		});
	},

	/**
	 * Regenerate all error page files from database
	 * @param {Access} access
	 * @returns {Promise}
	 */
	regenerate: (access) => {
		return access.can("settings:update", "error-pages").then(() => {
			return regenerateAll();
		});
	},

	/**
	 * Get nginx directives for a proxy host
	 * @param {number|null} proxyHostId
	 * @returns {Promise<string>}
	 */
	getNginxDirectives,
};

export default internalErrorPageTemplate;
