import CodeEditor from "@uiw/react-textarea-code-editor";
import { Field, Form, Formik } from "formik";
import { useState, useMemo } from "react";
import { Alert, Badge, Modal, OverlayTrigger, Tooltip } from "react-bootstrap";
import { Button, Loading } from "src/components";
import {
	useErrorPageTemplates,
	useCreateErrorPageTemplate,
	useUpdateErrorPageTemplate,
	useDeleteErrorPageTemplate,
	useProxyHosts,
} from "src/hooks";

import { showObjectSuccess, showError } from "src/notifications";
import type { ErrorPageTemplate, ProxyHost } from "src/api/backend";

const ERROR_CODE_OPTIONS = [
	{ value: 400, label: "400 Bad Request" },
	{ value: 401, label: "401 Unauthorized" },
	{ value: 403, label: "403 Forbidden" },
	{ value: 404, label: "404 Not Found" },
	{ value: 500, label: "500 Internal Server Error" },
	{ value: 502, label: "502 Bad Gateway" },
	{ value: 503, label: "503 Service Unavailable" },
	{ value: 504, label: "504 Gateway Timeout" },
];

const defaultHtmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{error_code}} - Error</title>
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
  <p class="code">{{error_code}}</p>
  <h1>{{error_title}}</h1>
  <p>An error occurred on <span class="site-name">{{site_name}}</span>.</p>
  <div class="info">
    <p>{{custom_message}}</p>
  </div>
</div>
</body>
</html>`;

const defaultVariables: Record<string, string> = {
	site_name: "Your Site",
	support_email: "admin@example.com",
	custom_message: "Please try again later.",
	error_code: "502",
	error_title: "Error",
};

interface TemplateFormValues {
	name: string;
	proxy_host_id: number | null;
	error_codes: number[];
	html_content: string;
	variables: Record<string, string>;
	is_active: boolean;
}

function VariablesEditor({
	variables,
	onChange,
}: {
	variables: Record<string, string>;
	onChange: (vars: Record<string, string>) => void;
}) {
	const [newKey, setNewKey] = useState("");
	const [newValue, setNewValue] = useState("");

	const addVariable = () => {
		if (newKey.trim()) {
			onChange({ ...variables, [newKey.trim()]: newValue });
			setNewKey("");
			setNewValue("");
		}
	};

	const removeVariable = (key: string) => {
		const copy = { ...variables };
		delete copy[key];
		onChange(copy);
	};

	const updateValue = (key: string, value: string) => {
		onChange({ ...variables, [key]: value });
	};

	return (
		<div className="mb-3">
			<label className="form-label fw-semibold">
				Variables <small className="text-muted">(use {"{{variable_name}}"} in HTML)</small>
			</label>
			<div className="table-responsive">
				<table className="table table-sm table-vcenter">
					<thead>
						<tr>
							<th style={{ width: "35%" }}>Key</th>
							<th>Value</th>
							<th style={{ width: "40px" }} />
						</tr>
					</thead>
					<tbody>
						{Object.entries(variables).map(([key, val]) => (
							<tr key={key}>
								<td>
									<code className="text-teal">{`{{${key}}}`}</code>
								</td>
								<td>
									<input
										type="text"
										className="form-control form-control-sm"
										value={val}
										onChange={(e) => updateValue(key, e.target.value)}
									/>
								</td>
								<td>
									<button
										type="button"
										className="btn btn-sm btn-ghost-danger"
										onClick={() => removeVariable(key)}
									>
										<i className="ti ti-trash" />
									</button>
								</td>
							</tr>
						))}
						<tr>
							<td>
								<input
									type="text"
									className="form-control form-control-sm"
									placeholder="variable_name"
									value={newKey}
									onChange={(e) => setNewKey(e.target.value)}
									onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addVariable())}
								/>
							</td>
							<td>
								<input
									type="text"
									className="form-control form-control-sm"
									placeholder="value"
									value={newValue}
									onChange={(e) => setNewValue(e.target.value)}
									onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addVariable())}
								/>
							</td>
							<td>
								<button type="button" className="btn btn-sm btn-ghost-teal" onClick={addVariable}>
									<i className="ti ti-plus" />
								</button>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);
}

function ErrorCodesSelector({
	selected,
	onChange,
}: {
	selected: number[];
	onChange: (codes: number[]) => void;
}) {
	const toggleCode = (code: number) => {
		if (selected.includes(code)) {
			onChange(selected.filter((c) => c !== code));
		} else {
			onChange([...selected, code]);
		}
	};

	return (
		<div className="mb-3">
			<label className="form-label fw-semibold">Error Codes</label>
			<div className="d-flex flex-wrap gap-2">
				{ERROR_CODE_OPTIONS.map((opt) => (
					<label key={opt.value} className="form-selectgroup-item" style={{ cursor: "pointer" }}>
						<input
							type="checkbox"
							className="form-selectgroup-input"
							checked={selected.includes(opt.value)}
							onChange={() => toggleCode(opt.value)}
						/>
						<span className="form-selectgroup-label d-flex align-items-center px-2 py-1">
							<Badge bg={selected.includes(opt.value) ? "teal" : "secondary"} className="me-1">
								{opt.value}
							</Badge>
							<small>{opt.label.split(" ").slice(1).join(" ")}</small>
						</span>
					</label>
				))}
			</div>
		</div>
	);
}

interface TemplateModalProps {
	show: boolean;
	onClose: () => void;
	template?: ErrorPageTemplate | null;
	proxyHosts: ProxyHost[];
}

function TemplateModal({ show, onClose, template, proxyHosts }: TemplateModalProps) {
	const { mutateAsync: create } = useCreateErrorPageTemplate();
	const { mutateAsync: update } = useUpdateErrorPageTemplate();
	const [previewHtml, setPreviewHtml] = useState<string | null>(null);

	const isEdit = !!template;

	const initialValues: TemplateFormValues = {
		name: template?.name || "",
		proxy_host_id: template?.proxyHostId ?? null,
		error_codes: template?.errorCodes || [502],
		html_content: template?.htmlContent || defaultHtmlTemplate,
		variables: template?.variables || { ...defaultVariables },
		is_active: template?.isActive ?? true,
	};

	const handlePreview = (values: TemplateFormValues) => {
		let rendered = values.html_content;
		for (const [key, val] of Object.entries(values.variables)) {
			rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
		}
		setPreviewHtml(rendered);
	};

	const onSubmit = async (values: TemplateFormValues) => {
		try {
			const payload: any = {
				name: values.name,
				proxy_host_id: values.proxy_host_id || null,
				error_codes: values.error_codes,
				html_content: values.html_content,
				variables: values.variables,
				is_active: values.is_active,
			};

			if (isEdit && template) {
				payload.id = template.id;
				await update(payload);
			} else {
				await create(payload);
			}
			showObjectSuccess("error-page-template", "saved");
			onClose();
		} catch (err: any) {
			showError(err.message || "Failed to save template");
		}
	};

	return (
		<>
			<Modal show={show} onHide={onClose} size="xl" centered scrollable>
				<Formik initialValues={initialValues} enableReinitialize onSubmit={onSubmit}>
					{({ values, setFieldValue, isSubmitting, handleSubmit }) => (
						<Form>
							<Modal.Header closeButton>
								<Modal.Title>
									<i className="ti ti-file-code me-2" />
									{isEdit ? "Edit Error Page Template" : "New Error Page Template"}
								</Modal.Title>
							</Modal.Header>
							<Modal.Body>
								<div className="row">
									<div className="col-md-6">
										{/* Name */}
										<div className="mb-3">
											<label className="form-label fw-semibold">Template Name</label>
											<Field
												name="name"
												type="text"
												className="form-control"
												placeholder="e.g. Bad Gateway for MyApp"
												required
											/>
										</div>

										{/* Proxy Host Selector */}
										<div className="mb-3">
											<label className="form-label fw-semibold">
												Assign to Proxy Host
												<OverlayTrigger
													overlay={
														<Tooltip>
															Leave as "Global" to apply to all hosts that don't have a
															specific template
														</Tooltip>
													}
												>
													<i className="ti ti-info-circle ms-1 text-muted" />
												</OverlayTrigger>
											</label>
											<select
												className="form-select"
												value={values.proxy_host_id ?? ""}
												onChange={(e) =>
													setFieldValue(
														"proxy_host_id",
														e.target.value ? Number(e.target.value) : null,
													)
												}
											>
												<option value="">🌐 Global (all hosts)</option>
												{proxyHosts.map((h) => (
													<option key={h.id} value={h.id}>
														{h.domainNames?.[0] || `Host #${h.id}`}
														{h.domainNames?.length > 1
															? ` (+${h.domainNames.length - 1})`
															: ""}
													</option>
												))}
											</select>
										</div>

										{/* Error Codes */}
										<ErrorCodesSelector
											selected={values.error_codes}
											onChange={(codes) => setFieldValue("error_codes", codes)}
										/>

										{/* Active toggle */}
										<div className="mb-3">
											<label className="form-check form-switch">
												<input
													type="checkbox"
													className="form-check-input"
													checked={values.is_active}
													onChange={(e) => setFieldValue("is_active", e.target.checked)}
												/>
												<span className="form-check-label">Active</span>
											</label>
										</div>

										{/* Variables */}
										<VariablesEditor
											variables={values.variables}
											onChange={(vars) => setFieldValue("variables", vars)}
										/>
									</div>
									<div className="col-md-6">
										{/* HTML Editor */}
										<div className="mb-3">
											<label className="form-label fw-semibold">
												HTML Template
												<button
													type="button"
													className="btn btn-sm btn-outline-teal ms-2"
													onClick={() => handlePreview(values)}
												>
													<i className="ti ti-eye me-1" />
													Preview
												</button>
											</label>
											<CodeEditor
												language="php"
												placeholder="<!-- Enter your custom HTML error page -->"
												padding={15}
												data-color-mode="dark"
												minHeight={400}
												indentWidth={2}
												value={values.html_content}
												onChange={(e) => setFieldValue("html_content", e.target.value)}
												style={{
													fontFamily:
														"ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace",
													borderRadius: "0.3rem",
													minHeight: "400px",
													backgroundColor: "var(--tblr-bg-surface-dark)",
													fontSize: "12px",
												}}
											/>
										</div>
									</div>
								</div>
							</Modal.Body>
							<Modal.Footer>
								<button type="button" className="btn btn-secondary" onClick={onClose}>
									Cancel
								</button>
								<Button
									type="submit"
									actionType="primary"
									className="bg-teal"
									isLoading={isSubmitting}
									disabled={isSubmitting || values.error_codes.length === 0 || !values.name}
									onClick={handleSubmit as any}
								>
									<i className="ti ti-device-floppy me-1" />
									{isEdit ? "Update" : "Create"}
								</Button>
							</Modal.Footer>
						</Form>
					)}
				</Formik>
			</Modal>

			{/* Preview Modal */}
			<Modal show={!!previewHtml} onHide={() => setPreviewHtml(null)} size="lg" centered>
				<Modal.Header closeButton>
					<Modal.Title>
						<i className="ti ti-eye me-2" />
						Preview
					</Modal.Title>
				</Modal.Header>
				<Modal.Body className="p-0">
					{previewHtml && (
						<iframe
							srcDoc={previewHtml}
							title="Error Page Preview"
							style={{ width: "100%", height: "500px", border: "none" }}
						/>
					)}
				</Modal.Body>
			</Modal>
		</>
	);
}

export default function ErrorPages() {
	const { data: templates, isLoading, error } = useErrorPageTemplates(["proxy_host"]);
	const { data: proxyHosts } = useProxyHosts();
	const { mutateAsync: deleteTemplate } = useDeleteErrorPageTemplate();
	const [showModal, setShowModal] = useState(false);
	const [editTemplate, setEditTemplate] = useState<ErrorPageTemplate | null>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

	const hostList = useMemo(() => proxyHosts || [], [proxyHosts]);

	const handleEdit = (tpl: ErrorPageTemplate) => {
		setEditTemplate(tpl);
		setShowModal(true);
	};

	const handleCreate = () => {
		setEditTemplate(null);
		setShowModal(true);
	};

	const handleDelete = async (id: number) => {
		try {
			await deleteTemplate(id);
			showObjectSuccess("error-page-template", "deleted");
			setDeleteConfirm(null);
		} catch (err: any) {
			showError(err.message || "Failed to delete");
		}
	};

	if (isLoading) {
		return (
			<div className="card-body">
				<Loading noLogo />
			</div>
		);
	}

	if (error) {
		return (
			<div className="card-body">
				<Alert variant="danger" show>
					{error.message}
				</Alert>
			</div>
		);
	}

	return (
		<>
			<div className="card-body">
				<div className="d-flex justify-content-between align-items-center mb-3">
					<div>
						<p className="text-muted mb-0">
							Custom HTML error pages for each proxy host or globally. Templates support{" "}
							<code>{"{{variable}}"}</code> placeholders.
						</p>
					</div>
					<button type="button" className="btn btn-teal" onClick={handleCreate}>
						<i className="ti ti-plus me-1" />
						New Template
					</button>
				</div>

				{templates && templates.length === 0 ? (
					<div className="empty">
						<div className="empty-icon">
							<i className="ti ti-file-code" style={{ fontSize: "3rem" }} />
						</div>
						<p className="empty-title">No Error Page Templates</p>
						<p className="empty-subtitle text-muted">
							Create custom error pages for your proxy hosts
						</p>
						<div className="empty-action">
							<button type="button" className="btn btn-teal" onClick={handleCreate}>
								<i className="ti ti-plus me-1" />
								Create First Template
							</button>
						</div>
					</div>
				) : (
					<div className="table-responsive">
						<table className="table table-vcenter table-hover">
							<thead>
								<tr>
									<th>Name</th>
									<th>Assigned To</th>
									<th>Error Codes</th>
									<th>Status</th>
									<th style={{ width: "120px" }}>Actions</th>
								</tr>
							</thead>
							<tbody>
								{templates?.map((tpl) => (
									<tr key={tpl.id}>
										<td>
											<div className="d-flex align-items-center">
												<i className="ti ti-file-code me-2 text-teal" />
												<span className="fw-semibold">{tpl.name}</span>
											</div>
										</td>
										<td>
											{tpl.proxyHostId ? (
												<Badge bg="blue-lt">
													<i className="ti ti-server me-1" />
													{(tpl as any).proxy_host?.domain_names?.[0] ||
														`Host #${tpl.proxyHostId}`}
												</Badge>
											) : (
												<Badge bg="teal-lt">
													<i className="ti ti-world me-1" />
													Global
												</Badge>
											)}
										</td>
										<td>
											<div className="d-flex flex-wrap gap-1">
												{tpl.errorCodes?.map((code) => (
													<Badge
														key={code}
														bg={
															code >= 500
																? "red-lt"
																: code >= 400
																	? "orange-lt"
																	: "blue-lt"
														}
													>
														{code}
													</Badge>
												))}
											</div>
										</td>
										<td>
											{tpl.isActive ? (
												<Badge bg="green-lt">
													<i className="ti ti-check me-1" />
													Active
												</Badge>
											) : (
												<Badge bg="secondary">
													<i className="ti ti-x me-1" />
													Inactive
												</Badge>
											)}
										</td>
										<td>
											<div className="btn-list">
												<button
													type="button"
													className="btn btn-sm btn-ghost-primary"
													onClick={() => handleEdit(tpl)}
													title="Edit"
												>
													<i className="ti ti-pencil" />
												</button>
												{deleteConfirm === tpl.id ? (
													<>
														<button
															type="button"
															className="btn btn-sm btn-danger"
															onClick={() => handleDelete(tpl.id)}
														>
															<i className="ti ti-check" />
														</button>
														<button
															type="button"
															className="btn btn-sm btn-secondary"
															onClick={() => setDeleteConfirm(null)}
														>
															<i className="ti ti-x" />
														</button>
													</>
												) : (
													<button
														type="button"
														className="btn btn-sm btn-ghost-danger"
														onClick={() => setDeleteConfirm(tpl.id)}
														title="Delete"
													>
														<i className="ti ti-trash" />
													</button>
												)}
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>

			<TemplateModal
				show={showModal}
				onClose={() => {
					setShowModal(false);
					setEditTemplate(null);
				}}
				template={editTemplate}
				proxyHosts={hostList}
			/>
		</>
	);
}
