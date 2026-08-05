# Copyright (c) 2026, Tripod Mena and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate, date_diff, today, flt


class ProjectProductionPlan(Document):
	def validate(self):
		"""Recompute all derived fields on every save."""
		self.compute_overall_joinery_completion()
		self.flag_revised_dispatch_if_drawing_changed()
		self.compute_duration()
		self.compute_material_bar()
		self.auto_fetch_linked_documents()
		self.compute_material_delay_flag()
		self.validate_installed_status()

	# -------------------------------------------------------------------
	# Overall joinery completion (already existed)
	# -------------------------------------------------------------------
	def compute_overall_joinery_completion(self):
		stages = self.get("production_stages") or []
		if not stages:
			self.overall_joinery_completion_pct = 0
			return
		total = 0.0
		count = 0
		for stage in stages:
			pct = stage.get("completion_percentage") or 0
			try:
				pct = float(pct)
			except (TypeError, ValueError):
				pct = 0
			pct = max(0, min(100, pct))
			total += pct
			count += 1
		self.overall_joinery_completion_pct = round(total / count, 2) if count else 0

	def flag_revised_dispatch_if_drawing_changed(self):
		changes = self.get("drawing_change_log") or []
		if not changes:
			return
		latest_revised = None
		for change in changes:
			rd = change.get("revised_completion_date")
			if not rd:
				continue
			if latest_revised is None or rd > latest_revised:
				latest_revised = rd
		if latest_revised and (
			not self.revised_dispatch_date or latest_revised > self.revised_dispatch_date
		):
			self.revised_dispatch_date = latest_revised

	# -------------------------------------------------------------------
	# Duration: Production Start → Production End (with fallback chain)
	# -------------------------------------------------------------------
	def compute_duration(self):
		"""
		Total Duration = Production Start Date → end date
		End date fallback chain:
		  1. Actual Completion Date (if set)
		  2. Production End Date
		  3. Installation End Date
		  4. Revised Dispatch Date
		  5. Target Dispatch Date
		If Production Start not set, all values are 0.
		"""
		start = self.production_start_date
		if not start:
			self.total_duration_days = 0
			self.days_elapsed = 0
			self.days_remaining = 0
			self.days_progress_pct = 0
			return

		end = (
			self.actual_completion_date
			or self.production_end_date
			or self.installation_end_date
			or self.revised_dispatch_date
			or self.target_dispatch_date
		)
		if not end:
			# No end date at all — count elapsed only
			try:
				elapsed = date_diff(today(), start)
			except Exception:
				elapsed = 0
			self.total_duration_days = 0
			self.days_elapsed = max(0, elapsed)
			self.days_remaining = 0
			self.days_progress_pct = 0
			return

		try:
			total = date_diff(end, start)
			elapsed = date_diff(today(), start)
		except Exception:
			total = 0
			elapsed = 0

		total = max(0, total)
		elapsed = max(0, elapsed)

		self.total_duration_days = total
		self.days_elapsed = elapsed
		self.days_remaining = max(0, total - elapsed)
		if total > 0:
			pct = (elapsed / total) * 100
			self.days_progress_pct = round(min(100, max(0, pct)), 2)
		else:
			self.days_progress_pct = 0

	# -------------------------------------------------------------------
	# Material bar: Available (Stock+GRN) / PO Placed / MR Awaiting PO
	# -------------------------------------------------------------------
	def compute_material_bar(self):
		"""
		For all MRs linked to this project:
		  - required_qty = sum of MR line qtys
		  - received_qty = qty received via Purchase Receipt against this project's POs
		  - transferred_qty = qty transferred via Stock Entry (Material Transfer) tagged with this project
		  - po_qty = qty on Purchase Orders raised (whether or not received)

		available = received + transferred (already in project's hands)
		po_only = po_qty - received (ordered but not received)
		mr_only = required - po_qty (MR raised, no PO yet)

		Percentages calculated against required_qty.
		"""
		try:
			if not self.project:
				self._reset_material_fields()
				return

			# Get all MRs for this project (not cancelled)
			mrs = frappe.get_all(
				"Material Request",
				filters={"project": self.project, "docstatus": ["!=", 2]},
				fields=["name"],
			)
			if not mrs:
				self._reset_material_fields()
				return

			mr_names = [m["name"] for m in mrs]
			mr_count = len(mr_names)

			# Count PO docs raised for this project (distinct, not cancelled)
			po_count_rows = frappe.db.sql(
				"""
				SELECT COUNT(DISTINCT po.name) as cnt
				FROM `tabPurchase Order` po
				INNER JOIN `tabPurchase Order Item` poi ON poi.parent = po.name
				WHERE poi.project = %(project)s
				  AND po.docstatus != 2
				""",
				{"project": self.project},
				as_dict=True,
			)
			po_count = int(po_count_rows[0]["cnt"] if po_count_rows else 0)

			# Sum required qty across MR items
			required_rows = frappe.db.sql(
				"""
				SELECT COALESCE(SUM(qty), 0) as total_qty
				FROM `tabMaterial Request Item`
				WHERE parent IN %(mrs)s
				""",
				{"mrs": tuple(mr_names) if len(mr_names) > 1 else (mr_names[0], mr_names[0])},
				as_dict=True,
			)
			required_qty = flt(required_rows[0]["total_qty"] if required_rows else 0)

			if required_qty <= 0:
				self._reset_material_fields()
				return

			# Received via Purchase Receipt (project-tagged, submitted)
			received_rows = frappe.db.sql(
				"""
				SELECT COALESCE(SUM(pri.qty), 0) as qty
				FROM `tabPurchase Receipt Item` pri
				INNER JOIN `tabPurchase Receipt` pr ON pri.parent = pr.name
				WHERE pri.project = %(project)s
				  AND pr.docstatus = 1
				""",
				{"project": self.project},
				as_dict=True,
			)
			received_qty = flt(received_rows[0]["qty"] if received_rows else 0)

			# Transferred via Stock Entry (Material Transfer type, project-tagged)
			# We look at Stock Entry Detail where t_warehouse is set (in-transfer)
			transferred_rows = frappe.db.sql(
				"""
				SELECT COALESCE(SUM(sed.qty), 0) as qty
				FROM `tabStock Entry Detail` sed
				INNER JOIN `tabStock Entry` se ON sed.parent = se.name
				WHERE (sed.project = %(project)s OR se.project = %(project)s)
				  AND se.docstatus = 1
				  AND se.purpose IN ('Material Transfer', 'Material Transfer for Manufacture', 'Material Receipt')
				  AND sed.t_warehouse IS NOT NULL
				  AND sed.t_warehouse != ''
				""",
				{"project": self.project},
				as_dict=True,
			)
			transferred_qty = flt(transferred_rows[0]["qty"] if transferred_rows else 0)

			# PO qty raised (project-tagged, submitted or draft)
			po_rows = frappe.db.sql(
				"""
				SELECT COALESCE(SUM(poi.qty), 0) as qty
				FROM `tabPurchase Order Item` poi
				INNER JOIN `tabPurchase Order` po ON poi.parent = po.name
				WHERE poi.project = %(project)s
				  AND po.docstatus != 2
				""",
				{"project": self.project},
				as_dict=True,
			)
			po_qty = flt(po_rows[0]["qty"] if po_rows else 0)

			# Received = Stock Entry transferred + GRN received, clamped to required
			received_total = min(required_qty, received_qty + transferred_qty)
			pending_qty = max(0, required_qty - received_total)

			def pct(n):
				return round((n / required_qty) * 100) if required_qty else 0

			received_pct = pct(received_total)
			pending_pct = 100 - received_pct

			# Bar is now 2 segments: available (received, green) + pending (grey).
			# material_available_pct drives the green segment; keep po/mr fields at 0
			# so any old bar rendering stays consistent.
			self.material_available_pct = received_pct
			self.material_po_pct = 0
			self.material_mr_pct = 0

			# Plain-language line the team can read at a glance:
			# MR: 10 · PO: 5 · Received: 60% (12 of 20 qty) · Pending: 40%
			self.material_summary_text = (
				f"MR: {mr_count} · PO: {po_count} · "
				f"Received: {received_pct}% ({int(received_total)} of {int(required_qty)} qty) · "
				f"Pending: {pending_pct}%"
			)
		except Exception:
			frappe.log_error(
				title="Project Production Plan: material bar calc failed",
				message=frappe.get_traceback(),
			)
			self._reset_material_fields()

	def _reset_material_fields(self):
		self.material_available_pct = 0
		self.material_po_pct = 0
		self.material_mr_pct = 0
		self.material_summary_text = "No MRs raised yet for this project"

	# -------------------------------------------------------------------
	# Auto-fetch QC Inspection + Logistics Request from Project
	# -------------------------------------------------------------------
	def auto_fetch_linked_documents(self):
		"""
		If linked fields are empty, try to find the latest QC Inspection and
		Logistics Request for this project and populate.
		Wrapped so a missing doctype (installation on a new site) doesn't crash.
		"""
		if not self.project:
			return

		# QC Inspection
		if not self.linked_qc_inspection:
			try:
				qc = frappe.db.get_value(
					"QC Inspection",
					{"project": self.project, "docstatus": ["!=", 2]},
					"name",
					order_by="modified desc",
				)
				if qc:
					self.linked_qc_inspection = qc
			except Exception:
				# QC Inspection doctype may not exist yet
				pass

		# Logistics Request
		if not self.linked_logistics_request:
			try:
				lr = frappe.db.get_value(
					"Logistics Request",
					{"project": self.project, "docstatus": ["!=", 2]},
					"name",
					order_by="modified desc",
				)
				if lr:
					self.linked_logistics_request = lr
			except Exception:
				pass

	# -------------------------------------------------------------------
	# Material delay flag for Installation section
	# -------------------------------------------------------------------
	def compute_material_delay_flag(self):
		"""
		Populates material_delay_flag with a red-flag summary if any material
		or upstream issue may impact installation. Empty string if all clear.
		"""
		issues = []

		# Material availability check
		if flt(self.material_available_pct or 0) < 90 and self.installation_start_date:
			issues.append(
				f"Only {self.material_available_pct}% material available "
				f"but Installation Start is set"
			)
		elif flt(self.material_available_pct or 0) < 60:
			issues.append(f"Only {self.material_available_pct}% material available")

		# Pending drawings
		pending_drawings = [
			d for d in (self.drawing_log or []) if (d.get("status") or "").lower() == "pending"
		]
		if pending_drawings:
			issues.append(f"{len(pending_drawings)} drawings still pending approval")

		# Dispatch slippage
		if (
			self.revised_dispatch_date
			and self.target_dispatch_date
			and self.revised_dispatch_date > self.target_dispatch_date
		):
			try:
				slippage = date_diff(self.revised_dispatch_date, self.target_dispatch_date)
				issues.append(f"Dispatch slipped {slippage} days from target")
			except Exception:
				pass

		# Status stuck in awaiting material
		if self.overall_status == "Awaiting Material":
			issues.append("Status is 'Awaiting Material' — waiting for procurement")

		# Un-signed samples
		unsigned_samples = [
			s for s in (self.sample_log or [])
			if (s.get("approval_status") or "").lower() != "approved"
		]
		if unsigned_samples and self.installation_start_date:
			issues.append(f"{len(unsigned_samples)} samples still not approved")

		self.material_delay_flag = " · ".join(issues) if issues else ""

	# -------------------------------------------------------------------
	# Guard: cannot mark Installed without 5 final images
	# -------------------------------------------------------------------
	def validate_installed_status(self):
		# No image count requirement. Users attach as many final images as
		# they want (0 to 5). Kept as a method so the validate() call stays valid.
		return


# ---------------------------------------------------------------------------
# Hook: auto-create a Project Production Plan when a Project is inserted
# ---------------------------------------------------------------------------
def create_production_plan_for_project(doc, method=None):
	"""Called via the 'after_insert' hook on the Project doctype."""
	if not doc or not doc.name:
		return
	if frappe.db.exists("Project Production Plan", {"project": doc.name}):
		return
	try:
		plan = frappe.new_doc("Project Production Plan")
		plan.project = doc.name
		plan.overall_status = "Drawing Pending"
		plan.insert(ignore_permissions=True)
	except Exception:
		frappe.log_error(
			title="Auto-create Project Production Plan failed",
			message=frappe.get_traceback(),
		)
