# Copyright (c) 2026, Tripod Mena and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class ProjectProductionPlan(Document):
	def validate(self):
		"""Run on every save - keep the overall % in sync with stage %s."""
		self.compute_overall_joinery_completion()
		self.flag_revised_dispatch_if_drawing_changed()

	def compute_overall_joinery_completion(self):
		"""
		Overall Joinery Completion % = simple average of all Production Stage %s.
		If there are no stages, the value is 0.
		This is the single field exposed to the main Project Dashboard.
		"""
		stages = self.get("production_stages") or []

		if not stages:
			self.overall_joinery_completion_pct = 0
			return

		total = 0.0
		count = 0
		for stage in stages:
			pct = stage.get("completion_percentage") or 0
			# Clamp to 0-100 just in case
			try:
				pct = float(pct)
			except (TypeError, ValueError):
				pct = 0
			if pct < 0:
				pct = 0
			if pct > 100:
				pct = 100
			total += pct
			count += 1

		if count == 0:
			self.overall_joinery_completion_pct = 0
		else:
			self.overall_joinery_completion_pct = round(total / count, 2)

	def flag_revised_dispatch_if_drawing_changed(self):
		"""
		If any Drawing Change row has a revised_completion_date later than target,
		copy the latest revised date to the header field. Non-destructive: only
		updates if the field is empty or older than the latest change.
		"""
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


# ---------------------------------------------------------------------------
# Hook: auto-create a Project Production Plan whenever a Project is created
# ---------------------------------------------------------------------------
def create_production_plan_for_project(doc, method=None):
	"""
	Called via the 'after_insert' hook on the Project doctype.
	Creates a Project Production Plan linked to the new Project so the
	Production team can start tracking from day one - even before Project
	Plan is finalised.

	Safe to call multiple times: if a plan already exists for this project,
	the function is a no-op. This means re-running migrations or imports
	will never duplicate.
	"""
	if not doc or not doc.name:
		return

	# Bail out if a plan already exists (unique constraint on 'project' field
	# also enforces this at DB level, but we check first to avoid noise)
	if frappe.db.exists("Project Production Plan", {"project": doc.name}):
		return

	try:
		plan = frappe.new_doc("Project Production Plan")
		plan.project = doc.name
		plan.overall_status = "Drawing Pending"

		# Use ignore_permissions because Project insert may run in contexts
		# (background jobs, imports) where the user might not have explicit
		# create permission on Project Production Plan
		plan.insert(ignore_permissions=True)

	except Exception:
		# Never block Project creation if the plan fails - log and continue
		frappe.log_error(
			title="Auto-create Project Production Plan failed",
			message=frappe.get_traceback(),
		)
