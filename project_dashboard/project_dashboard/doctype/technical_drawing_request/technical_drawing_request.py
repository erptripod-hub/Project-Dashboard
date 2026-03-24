import frappe
from frappe.model.document import Document

CHECKLIST_ITEMS = [
	"Concept/3D Renders",
	"Initial Architectural Drawings",
	"Initial MEP Drawings",
	"Unpriced BOQ (With Scope Highlighted)",
	"Material Specifications/Samples",
	"Site Survey Report",
	"Site Survey Sketch - where applicable",
	"LOD",
]

DRAWING_PACKAGES = [
	"Demolition Plan",
	"General Arrangement Plan",
	"Floor Plan & RCP",
	"Elevations & Sections",
	"JOINERY - Fixed",
	"JOINERY - Free Standing",
	"Shopfront",
	"Electrical & Plumbing",
	"HVAC, Fire Fighting & Fire Alarm",
	"IT Works - CCTV, Data",
	"Others - If any",
]


def get_dashboard_data(data):
	"""Called by Frappe to show TDR in Project connections panel"""
	return {
		"fieldname": "project",
		"transactions": [
			{
				"label": "Technical Drawing",
				"items": ["Technical Drawing Request"]
			}
		]
	}


class TechnicalDrawingRequest(Document):

	def validate(self):
		if not self.requested_by:
			employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
			if employee:
				self.requested_by = employee

	def on_submit(self):
		self.status = "Submitted to Design"
		self.notify_design_manager()

	def on_cancel(self):
		self.status = "Draft"

	def notify_design_manager(self):
		design_managers = frappe.db.sql("""
			SELECT DISTINCT u.email, u.full_name
			FROM `tabUser` u
			INNER JOIN `tabHas Role` hr ON hr.parent = u.name
			WHERE hr.role = 'Design Manager'
			AND u.enabled = 1
			AND u.email != ''
		""", as_dict=1)

		if not design_managers:
			frappe.msgprint("No users found with Design Manager role. Email not sent.", alert=True, indicator="orange")
			return

		checklist_rows = "".join([
			f"<tr><td style='padding:6px 8px;border-bottom:1px solid #f1f5f9'>{i+1}</td>"
			f"<td style='padding:6px 8px;border-bottom:1px solid #f1f5f9'>{row.particular}</td>"
			f"<td style='padding:6px 8px;border-bottom:1px solid #f1f5f9'><b>{row.status}</b></td>"
			f"<td style='padding:6px 8px;border-bottom:1px solid #f1f5f9'>{row.remarks or '—'}</td></tr>"
			for i, row in enumerate(self.initiation_checklist)
		])

		drawing_rows = "".join([
			f"<tr><td style='padding:6px 8px;border-bottom:1px solid #f1f5f9'>{i+1}</td>"
			f"<td style='padding:6px 8px;border-bottom:1px solid #f1f5f9'>{row.drawing_package}</td>"
			f"<td style='padding:6px 8px;border-bottom:1px solid #f1f5f9'>{str(row.required_date) if row.required_date else '—'}</td>"
			f"<td style='padding:6px 8px;border-bottom:1px solid #f1f5f9'>{row.drawing_status}</td>"
			f"<td style='padding:6px 8px;border-bottom:1px solid #f1f5f9'>{row.remarks or '—'}</td></tr>"
			for i, row in enumerate(self.drawing_packages)
		])

		project_name = frappe.db.get_value("Project", self.project, "project_name") or self.project
		pm_name = frappe.db.get_value("Employee", self.requested_by, "employee_name") or self.requested_by
		subject = f"Technical Drawing Request — {self.name} | {project_name}"

		message = f"""
		<div style="font-family:Arial,sans-serif;max-width:700px;">
			<div style="background:#0f1623;padding:16px 22px;border-radius:8px 8px 0 0;">
				<h2 style="color:#fff;margin:0;font-size:16px;">TRIPOD MENA | Technical Drawing Request</h2>
			</div>
			<div style="background:#f8fafc;padding:20px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
				<table style="width:100%;margin-bottom:16px;border-collapse:collapse;">
					<tr><td style="color:#64748b;font-size:12px;padding:4px 0;width:140px;">TDR Reference</td><td style="font-weight:700">{self.name}</td></tr>
					<tr><td style="color:#64748b;font-size:12px;padding:4px 0;">Project</td><td style="font-weight:700">{self.project} — {project_name}</td></tr>
					<tr><td style="color:#64748b;font-size:12px;padding:4px 0;">Requested By</td><td>{pm_name}</td></tr>
					<tr><td style="color:#64748b;font-size:12px;padding:4px 0;">Date</td><td>{str(self.date)}</td></tr>
				</table>

				<h3 style="font-size:13px;color:#1e293b;border-bottom:2px solid #2563eb;padding-bottom:6px;">Initiation Checklist</h3>
				<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px;">
					<thead style="background:#f1f5f9;">
						<tr>
							<th style="padding:6px 8px;text-align:left;color:#64748b;">#</th>
							<th style="padding:6px 8px;text-align:left;color:#64748b;">Particular</th>
							<th style="padding:6px 8px;text-align:left;color:#64748b;">Status</th>
							<th style="padding:6px 8px;text-align:left;color:#64748b;">Remarks</th>
						</tr>
					</thead>
					<tbody>{checklist_rows}</tbody>
				</table>

				<h3 style="font-size:13px;color:#1e293b;border-bottom:2px solid #2563eb;padding-bottom:6px;">Drawing Packages Required</h3>
				<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px;">
					<thead style="background:#f1f5f9;">
						<tr>
							<th style="padding:6px 8px;text-align:left;color:#64748b;">#</th>
							<th style="padding:6px 8px;text-align:left;color:#64748b;">Drawing Package</th>
							<th style="padding:6px 8px;text-align:left;color:#64748b;">Required Date</th>
							<th style="padding:6px 8px;text-align:left;color:#64748b;">Status</th>
							<th style="padding:6px 8px;text-align:left;color:#64748b;">Remarks</th>
						</tr>
					</thead>
					<tbody>{drawing_rows}</tbody>
				</table>

				<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:12px;font-size:11px;color:#92400e;">
					<b>Notes:</b><br>
					• Please mention NA for information not applicable for the project.<br>
					• Required date for drawings must match the project schedule with a buffer of 2 days.<br>
					• Please update the Received Date and Status once drawings are received in the system.
				</div>

				<div style="margin-top:16px;text-align:center;">
					<a href="{frappe.utils.get_url()}/app/technical-drawing-request/{self.name}"
					   style="background:#2563eb;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">
						Open in ERP → Fill Details
					</a>
				</div>
			</div>
		</div>
		"""

		frappe.sendmail(
			recipients=[dm.email for dm in design_managers],
			subject=subject,
			message=message,
			now=True
		)

		frappe.msgprint(
			f"Email sent to: {', '.join([dm.email for dm in design_managers])}",
			indicator="green", alert=True
		)


def get_project_dashboard_data(data):
	"""Used by override_doctype_dashboards hook to add TDR to Project connections"""
	return {
		"fieldname": "project",
		"transactions": [
			{
				"label": "Technical Drawing",
				"items": ["Technical Drawing Request"]
			}
		]
	}
