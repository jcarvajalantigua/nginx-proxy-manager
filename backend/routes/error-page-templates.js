import express from "express";
import internalErrorPageTemplate from "../internal/error-page-template.js";
import jwtdecode from "../lib/express/jwt-decode.js";
import validator from "../lib/validator/index.js";
import { debug, express as logger } from "../logger.js";

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

/**
 * /api/error-page-templates
 */
router
	.route("/")
	.options((_, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())

	/**
	 * GET /api/error-page-templates
	 *
	 * Retrieve all error page templates
	 */
	.get(async (req, res, next) => {
		try {
			const expand = typeof req.query.expand === "string" ? req.query.expand.split(",") : null;
			const rows = await internalErrorPageTemplate.getAll(res.locals.access, expand);
			res.status(200).send(rows);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	})

	/**
	 * POST /api/error-page-templates
	 *
	 * Create a new error page template
	 */
	.post(async (req, res, next) => {
		try {
			const data = await validator(
				{
					required: ["name", "error_codes", "html_content"],
					additionalProperties: false,
					properties: {
						proxy_host_id: {
							anyOf: [
								{ type: "integer", minimum: 0 },
								{ type: "null" },
							],
						},
						name: {
							type: "string",
							minLength: 1,
							maxLength: 150,
						},
						error_codes: {
							type: "array",
							items: { type: "integer", minimum: 100, maximum: 599 },
							minItems: 1,
						},
						html_content: {
							type: "string",
							minLength: 1,
						},
						variables: {
							type: "object",
						},
						is_active: {
							type: "boolean",
						},
					},
				},
				req.body,
			);
			const row = await internalErrorPageTemplate.create(res.locals.access, data);
			res.status(201).send(row);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	});

/**
 * Preview endpoint — MUST be before /:template_id to avoid route conflict
 *
 * POST /api/error-page-templates/preview
 */
router
	.route("/preview")
	.options((_, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())
	.post(async (req, res, next) => {
		try {
			const data = await validator(
				{
					required: ["html_content"],
					additionalProperties: false,
					properties: {
						html_content: {
							type: "string",
						},
						variables: {
							type: "object",
						},
					},
				},
				req.body,
			);
			const rendered = await internalErrorPageTemplate.preview(res.locals.access, data);
			res.status(200).send({ html: rendered });
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	});

/**
 * Regenerate all error page files — MUST be before /:template_id
 *
 * POST /api/error-page-templates/regenerate
 */
router
	.route("/regenerate")
	.options((_, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())
	.post(async (req, res, next) => {
		try {
			await internalErrorPageTemplate.regenerate(res.locals.access);
			res.status(200).send({ result: true });
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	});

/**
 * Specific error page template
 *
 * /api/error-page-templates/:template_id
 */
router
	.route("/:template_id")
	.options((_, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())

	/**
	 * GET /api/error-page-templates/:id
	 */
	.get(async (req, res, next) => {
		try {
			const data = await validator(
				{
					required: ["template_id"],
					additionalProperties: false,
					properties: {
						template_id: {
							type: "string",
							pattern: "^[0-9]+$",
						},
					},
				},
				{ template_id: req.params.template_id },
			);
			const row = await internalErrorPageTemplate.get(res.locals.access, {
				id: Number.parseInt(data.template_id, 10),
			});
			res.status(200).send(row);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	})

	/**
	 * PUT /api/error-page-templates/:id
	 */
	.put(async (req, res, next) => {
		try {
			const payload = await validator(
				{
					additionalProperties: false,
					properties: {
						proxy_host_id: {
							anyOf: [
								{ type: "integer", minimum: 0 },
								{ type: "null" },
							],
						},
						name: {
							type: "string",
							minLength: 1,
							maxLength: 150,
						},
						error_codes: {
							type: "array",
							items: { type: "integer", minimum: 100, maximum: 599 },
							minItems: 1,
						},
						html_content: {
							type: "string",
							minLength: 1,
						},
						variables: {
							type: "object",
						},
						is_active: {
							type: "boolean",
						},
					},
				},
				req.body,
			);
			payload.id = Number.parseInt(req.params.template_id, 10);
			const row = await internalErrorPageTemplate.update(res.locals.access, payload);
			res.status(200).send(row);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	})

	/**
	 * DELETE /api/error-page-templates/:id
	 */
	.delete(async (req, res, next) => {
		try {
			await internalErrorPageTemplate.delete(res.locals.access, {
				id: Number.parseInt(req.params.template_id, 10),
			});
			res.status(200).send({ result: true });
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	});

export default router;
