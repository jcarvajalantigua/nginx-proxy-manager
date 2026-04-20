import { Model } from "objection";
import db from "../db.js";
import now from "./now_helper.js";
import ProxyHost from "./proxy_host.js";

Model.knex(db());

class ErrorPageTemplate extends Model {
	$beforeInsert() {
		this.created_on = now();
		this.modified_on = now();

		if (typeof this.variables === "undefined") {
			this.variables = {};
		}
		if (typeof this.error_codes === "undefined") {
			this.error_codes = [502];
		}
	}

	$beforeUpdate() {
		this.modified_on = now();
	}

	static get name() {
		return "ErrorPageTemplate";
	}

	static get tableName() {
		return "error_page_template";
	}

	static get jsonAttributes() {
		return ["error_codes", "variables"];
	}

	static get relationMappings() {
		return {
			proxy_host: {
				relation: Model.BelongsToOneRelation,
				modelClass: ProxyHost,
				join: {
					from: "error_page_template.proxy_host_id",
					to: "proxy_host.id",
				},
			},
		};
	}
}

export default ErrorPageTemplate;
