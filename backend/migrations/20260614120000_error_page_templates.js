import { migrate as logger } from "../logger.js";

const migrateName = "error_page_templates";

/**
 * Migrate
 *
 * @see http://knexjs.org/#Schema
 *
 * @param   {Object}  knex
 * @returns {Promise}
 */
const up = (knex) => {
	logger.info(`[${migrateName}] Migrating Up...`);

	return knex.schema
		.createTable("error_page_template", (table) => {
			table.increments("id").primary();
			table.integer("proxy_host_id").unsigned().nullable();
			table.string("name", 150).notNull();
			table.json("error_codes").notNull(); // e.g. [502, 503, 504]
			table.text("html_content").notNull();
			table.json("variables").notNull(); // e.g. {"site_name":"Mi Sitio","support_email":"..."}
			table.boolean("is_active").notNull().defaultTo(true);
			table.dateTime("created_on").notNull();
			table.dateTime("modified_on").notNull();
			// FK to proxy_host (nullable = global template)
			table
				.foreign("proxy_host_id")
				.references("id")
				.inTable("proxy_host")
				.onDelete("CASCADE");
		})
		.then(() => {
			logger.info(`[${migrateName}] error_page_template Table created`);

			// Insert default templates
			const now = new Date().toISOString();
			return knex("error_page_template").insert([
				{
					proxy_host_id: null,
					name: "Bad Gateway (502)",
					error_codes: JSON.stringify([502]),
					html_content: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>502 - Bad Gateway</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #0c0c1d 0%, #1a1a2e 100%); color: #e0e0e0; }
  .container { text-align: center; padding: 2rem; max-width: 600px; }
  .code { font-size: 6rem; font-weight: 700; background: linear-gradient(135deg, #e74c3c, #c0392b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; }
  h1 { font-size: 1.5rem; margin: 0.5rem 0 1rem; color: #fff; }
  p { color: #aaa; line-height: 1.6; }
  .info { margin-top: 2rem; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); }
  .site-name { color: #00ff9f; font-weight: 600; }
</style>
</head>
<body>
<div class="container">
  <p class="code">502</p>
  <h1>Bad Gateway</h1>
  <p>The server <span class="site-name">{{site_name}}</span> received an invalid response from the upstream server.</p>
  <div class="info">
    <p>This is usually temporary. Please try again in a few moments.</p>
    <p>If the problem persists, contact <strong>{{support_email}}</strong></p>
  </div>
</div>
</body>
</html>`,
					variables: JSON.stringify({ site_name: "Your Site", support_email: "admin@example.com" }),
					is_active: true,
					created_on: now,
					modified_on: now,
				},
				{
					proxy_host_id: null,
					name: "Service Unavailable (503)",
					error_codes: JSON.stringify([503]),
					html_content: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>503 - Service Unavailable</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #0c0c1d 0%, #1a1a2e 100%); color: #e0e0e0; }
  .container { text-align: center; padding: 2rem; max-width: 600px; }
  .code { font-size: 6rem; font-weight: 700; background: linear-gradient(135deg, #f39c12, #e67e22); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; }
  h1 { font-size: 1.5rem; margin: 0.5rem 0 1rem; color: #fff; }
  p { color: #aaa; line-height: 1.6; }
  .info { margin-top: 2rem; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); }
  .site-name { color: #00ff9f; font-weight: 600; }
</style>
</head>
<body>
<div class="container">
  <p class="code">503</p>
  <h1>Service Unavailable</h1>
  <p><span class="site-name">{{site_name}}</span> is temporarily under maintenance.</p>
  <div class="info">
    <p>{{custom_message}}</p>
    <p>We apologize for the inconvenience. Contact <strong>{{support_email}}</strong> for updates.</p>
  </div>
</div>
</body>
</html>`,
					variables: JSON.stringify({ site_name: "Your Site", support_email: "admin@example.com", custom_message: "We'll be back shortly." }),
					is_active: true,
					created_on: now,
					modified_on: now,
				},
				{
					proxy_host_id: null,
					name: "Gateway Timeout (504)",
					error_codes: JSON.stringify([504]),
					html_content: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>504 - Gateway Timeout</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #0c0c1d 0%, #1a1a2e 100%); color: #e0e0e0; }
  .container { text-align: center; padding: 2rem; max-width: 600px; }
  .code { font-size: 6rem; font-weight: 700; background: linear-gradient(135deg, #9b59b6, #8e44ad); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; }
  h1 { font-size: 1.5rem; margin: 0.5rem 0 1rem; color: #fff; }
  p { color: #aaa; line-height: 1.6; }
  .info { margin-top: 2rem; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); }
  .site-name { color: #00ff9f; font-weight: 600; }
</style>
</head>
<body>
<div class="container">
  <p class="code">504</p>
  <h1>Gateway Timeout</h1>
  <p>The server <span class="site-name">{{site_name}}</span> did not respond in time.</p>
  <div class="info">
    <p>The upstream server took too long to respond. Please try again later.</p>
    <p>Contact <strong>{{support_email}}</strong> if this continues.</p>
  </div>
</div>
</body>
</html>`,
					variables: JSON.stringify({ site_name: "Your Site", support_email: "admin@example.com" }),
					is_active: true,
					created_on: now,
					modified_on: now,
				},
				{
					proxy_host_id: null,
					name: "Not Found (404)",
					error_codes: JSON.stringify([404]),
					html_content: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>404 - Not Found</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #0c0c1d 0%, #1a1a2e 100%); color: #e0e0e0; }
  .container { text-align: center; padding: 2rem; max-width: 600px; }
  .code { font-size: 6rem; font-weight: 700; background: linear-gradient(135deg, #3498db, #2980b9); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; }
  h1 { font-size: 1.5rem; margin: 0.5rem 0 1rem; color: #fff; }
  p { color: #aaa; line-height: 1.6; }
  .info { margin-top: 2rem; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); }
  .site-name { color: #00ff9f; font-weight: 600; }
</style>
</head>
<body>
<div class="container">
  <p class="code">404</p>
  <h1>Page Not Found</h1>
  <p>The page you're looking for on <span class="site-name">{{site_name}}</span> doesn't exist.</p>
  <div class="info">
    <p>Please check the URL or go back to the homepage.</p>
  </div>
</div>
</body>
</html>`,
					variables: JSON.stringify({ site_name: "Your Site" }),
					is_active: true,
					created_on: now,
					modified_on: now,
				},
			]);
		})
		.then(() => {
			logger.info(`[${migrateName}] Default error page templates seeded`);
		});
};

/**
 * Undo Migrate
 *
 * @param   {Object}  knex
 * @returns {Promise}
 */
const down = (knex) => {
	logger.info(`[${migrateName}] Migrating Down...`);

	return knex.schema.dropTableIfExists("error_page_template").then(() => {
		logger.info(`[${migrateName}] error_page_template Table dropped`);
	});
};

export { up, down };
