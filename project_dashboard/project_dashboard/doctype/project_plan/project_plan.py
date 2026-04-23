import frappe
from frappe.model.document import Document
from frappe.utils import date_diff, today, getdate

BOQ_SECTIONS = [
	("base_total_preliminaries", "Preliminaries"),
	("base_total_structural_works", "Structural Works"),
	("base_total_civil_works", "Civil Works"),
	("base_total_flooring_works", "Flooring Works"),
	("base_total_floor_finishes_works", "Floor Finishes Works"),
	("base_total_partition_and_cladding_works", "Partition & Cladding Works"),
	("base_total_wall_finishes_works", "Wall Finishes Works"),
	("base_total_ceiling_works", "Ceiling Works"),
	("base_total_ceiling_finishes_works", "Ceiling Finishes Works"),
	("base_total_shop_front_works", "Shop Front Works"),
	("base_total_door_works", "Door Works"),
	("base_total_joinery_works", "Joinery Works"),
	("base_total_loose_furniture_works", "Loose Furniture Works"),
	("base_total_exterior_works", "Exterior Works"),
	("base_total_landscaping_works", "Landscaping Works"),
	("base_total_hvac_works", "HVAC Works"),
	("base_total_electrical_works", "Electrical Works"),
	("base_total_lighting_works", "Lighting Works"),
	("base_total_fire_life_safety_works", "Fire Life Safety Works"),
	("base_total_it_works", "IT Works"),
	("base_total_cctv_works", "CCTV Works"),
	("base_total_access_control_works", "Access Control Works"),
	("base_total_access_point_works", "Access Point Works"),
	("base_total_music_system_works", "Music System Works"),
	("base_total_av_works", "AV Works"),
	("base_total_plumbing_works", "Plumbing Works"),
	("base_total_sanitarywares", "Sanitarywares"),
	("base_total_white_goods", "White Goods"),
	("base_total_miscellaneous_works", "Miscellaneous Works"),
]


def get_po_spent_by_order_type(project, order_type):
	if not project or not order_type:
		return 0
	result = frappe.db.sql("""
		SELECT COALESCE(SUM(grand_total), 0)
		FROM `tabPurchase Order`
		WHERE project = %s AND custom_order_type = %s AND docstatus = 1
	""", (project, order_type))
	return float(result[0][0]) if result else 0


def get_project_labour_cost(project):
	"""Get total labour cost from project timesheets"""
	if not project:
		return 0
	employees = frappe.db.sql("""
		SELECT pte.employee,
			COALESCE(SUM(pte.working_hours), 0) as working_hours,
			COALESCE(SUM(pte.overtime_hours), 0) as overtime_hours
		FROM `tabProject Timesheet Employee` pte
		INNER JOIN `tabProject Timesheet` pt ON pt.name = pte.parent
		WHERE pte.project = %s AND pt.docstatus = 1
		GROUP BY pte.employee
	""", project, as_dict=1)

	total_cost = 0
	for emp in employees:
		salary = frappe.db.sql("""
			SELECT custom_monthly_ctc FROM `tabSalary Structure Assignment`
			WHERE employee = %s AND docstatus = 1 AND custom_monthly_ctc > 0
			ORDER BY from_date DESC LIMIT 1
		""", emp.employee)
		if salary and salary[0][0]:
			hourly_rate = float(salary[0][0]) / 30 / 8
			total_cost += float(emp.working_hours or 0) * hourly_rate
			total_cost += float(emp.overtime_hours or 0) * 5
	return round(total_cost, 2)


class ProjectPlan(Document):

	def validate(self):
		self.fetch_boq_totals()
		self.calculate_timeline()
		self.validate_department_allocation()
		self.calculate_section_variance()
		self.calculate_labour_hours()
		self.calculate_department_budgets()
		self.calculate_summary()

	def fetch_boq_totals(self):
		if self.boq:
			boq = frappe.get_doc("BOQ", self.boq)
			self.boq_grand_total = boq.grand_total or 0
			self.boq_base_total = sum((getattr(boq, f, 0) or 0) for f, _ in BOQ_SECTIONS)

	def calculate_timeline(self):
		if self.start_date and self.end_date:
			self.project_duration = date_diff(self.end_date, self.start_date)
			self.days_passed = max(date_diff(today(), self.start_date), 0)
			self.days_remaining = date_diff(self.end_date, today())
			days_rem = self.days_remaining
			if days_rem < 0:
				self.timeline_status = "Overdue"
			elif days_rem < 7:
				self.timeline_status = "Critical"
			elif days_rem < 15:
				self.timeline_status = "Warning"
			elif days_rem < 30:
				self.timeline_status = "Attention"
			else:
				self.timeline_status = "On Track"

	def validate_department_allocation(self):
		total_pct = sum(row.allocation_percent or 0 for row in self.department_budgets)
		if total_pct > 100:
			frappe.throw(f"Total department allocation is {total_pct}% — cannot exceed 100%.")

	def calculate_section_variance(self):
		for row in self.section_costs:
			boq = row.boq_total or 0
			adjusted = row.adjusted_cost or boq
			row.adjusted_cost = adjusted
			row.variance = boq - adjusted

	def calculate_labour_hours(self):
		for row in self.labour_plan:
			headcount = row.headcount or 0
			days = row.estimated_days or 0
			row.estimated_working_hours = headcount * days * 8
			row.estimated_total_hours = row.estimated_working_hours + (row.estimated_ot_hours or 0)

	def calculate_department_budgets(self):
		total_adjusted = sum(r.adjusted_cost or 0 for r in self.section_costs)
		total_overhead = sum(r.amount or 0 for r in self.overhead_costs)
		labour_cost = get_project_labour_cost(self.project) if self.project else 0

		for row in self.department_budgets:
			pct = row.allocation_percent or 0
			row.budget_amount = round(total_adjusted * pct / 100, 2)

			dept_type = row.department_type or ""

			if dept_type == "Design":
				# Hours based calculation
				actual_hrs = row.actual_hours or 0
				rate = row.avg_hourly_rate or 0
				row.spent_amount = round(actual_hrs * rate, 2)

			elif dept_type == "Production":
				# Labour cost + all overhead
				row.spent_amount = round(labour_cost + total_overhead, 2)

			elif dept_type in ("Procurement Material", "Procurement Subcontractor"):
				# Auto from POs by order type
				if row.po_order_type and row.po_order_type != "Manual":
					row.spent_amount = get_po_spent_by_order_type(self.project, row.po_order_type)

			# For Other or empty type — keep manual (don't overwrite)

			spent = row.spent_amount or 0
			row.remaining = row.budget_amount - spent
			if row.budget_amount and spent >= row.budget_amount:
				row.status = "Exceeded"
			elif row.budget_amount and spent >= row.budget_amount * 0.8:
				row.status = "Warning"
			else:
				row.status = "On Track"

	def calculate_summary(self):
		self.total_adjusted_cost = sum(r.adjusted_cost or 0 for r in self.section_costs)
		self.total_subcontractor_cost = sum(r.contract_value or 0 for r in self.subcontractor_allocations)
		self.total_overhead = sum(r.amount or 0 for r in self.overhead_costs)
		self.total_estimated_labour = sum(r.estimated_cost or 0 for r in self.labour_plan)
		self.total_project_cost = (
			self.total_adjusted_cost +
			self.total_overhead +
			self.total_estimated_labour
		)
		self.total_variance = (self.boq_base_total or 0) - self.total_project_cost


@frappe.whitelist()
def load_sections_from_boq(boq_name):
	if not boq_name:
		return []
	boq = frappe.get_doc("BOQ", boq_name)
	sections = []
	for fieldname, label in BOQ_SECTIONS:
		value = getattr(boq, fieldname, 0) or 0
		if value > 0:
			sections.append({
				"section_name": label,
				"boq_total": value,
				"work_type": "Subcontract",
				"adjusted_cost": value,
				"variance": 0
			})
	return sections
