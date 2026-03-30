import frappe
from frappe.model.document import Document

BOQ_SECTIONS = [
	("section_total_preliminaries", "Preliminaries"),
	("section_total_structural_works", "Structural Works"),
	("section_total_civil_works", "Civil Works"),
	("section_total_flooring_works", "Flooring Works"),
	("section_total_floor_finishes_works", "Floor Finishes Works"),
	("section_total_partition_and_cladding_works", "Partition & Cladding Works"),
	("section_total_wall_finishes_works", "Wall Finishes Works"),
	("section_total_ceiling_works", "Ceiling Works"),
	("section_total_ceiling_finishes_works", "Ceiling Finishes Works"),
	("section_total_shop_front_works", "Shop Front Works"),
	("section_total_door_works", "Door Works"),
	("section_total_joinery_works", "Joinery Works"),
	("section_total_loose_furniture_works", "Loose Furniture Works"),
	("section_total_exterior_works", "Exterior Works"),
	("section_total_landscaping_works", "Landscaping Works"),
	("section_total_hvac_works", "HVAC Works"),
	("section_total_electrical_works", "Electrical Works"),
	("section_total_lighting_works", "Lighting Works"),
	("section_total_fire_life_safety_works", "Fire Life Safety Works"),
	("section_total_it_works", "IT Works"),
	("section_total_cctv_works", "CCTV Works"),
	("section_total_access_control_works", "Access Control Works"),
	("section_total_access_point_works", "Access Point Works"),
	("section_total_music_system_works", "Music System Works"),
	("section_total_av_works", "AV Works"),
	("section_total_plumbing_works", "Plumbing Works"),
	("section_total_sanitarywares", "Sanitarywares"),
	("section_total_white_goods", "White Goods"),
	("section_total_miscellaneous_works", "Miscellaneous Works"),
]


class ProjectPlan(Document):

	def validate(self):
		self.fetch_boq_total()
		self.calculate_section_variance()
		self.calculate_summary()

	def fetch_boq_total(self):
		if self.boq:
			grand_total = frappe.db.get_value("BOQ", self.boq, "grand_total")
			self.boq_grand_total = grand_total or 0

	def calculate_section_variance(self):
		for row in self.section_costs:
			boq = row.boq_total or 0
			adjusted = row.adjusted_cost or 0
			if not adjusted:
				row.adjusted_cost = boq
				adjusted = boq
			row.variance = boq - adjusted

	def calculate_summary(self):
		self.total_adjusted_cost = sum(row.adjusted_cost or 0 for row in self.section_costs)
		self.total_overhead = sum(row.amount or 0 for row in self.overhead_costs)
		self.total_project_cost = self.total_adjusted_cost + self.total_overhead
		self.total_variance = (self.boq_grand_total or 0) - self.total_project_cost


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
