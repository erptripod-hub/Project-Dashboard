frappe.ui.form.on("Technical Drawing Request", {

	onload: function(frm) {
		if (frm.is_new()) {
			// Auto set requested_by
			frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name", function(r) {
				if (r && r.name) frm.set_value("requested_by", r.name);
			});

			// Auto populate checklist
			var checklist_items = [
				"Concept/3D Renders",
				"Initial Architectural Drawings",
				"Initial MEP Drawings",
				"Unpriced BOQ (With Scope Highlighted)",
				"Material Specifications/Samples",
				"Site Survey Report",
				"Site Survey Sketch - where applicable",
				"LOD"
			];
			frm.clear_table("initiation_checklist");
			checklist_items.forEach(function(item) {
				var row = frm.add_child("initiation_checklist");
				row.particular = item;
				row.status = "NA";
			});
			frm.refresh_field("initiation_checklist");

			// Auto populate drawing packages
			var drawing_packages = [
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
				"Others - If any"
			];
			frm.clear_table("drawing_packages");
			drawing_packages.forEach(function(pkg) {
				var row = frm.add_child("drawing_packages");
				row.drawing_package = pkg;
				row.drawing_status = "Pending";
			});
			frm.refresh_field("drawing_packages");
		}
	},

	refresh: function(frm) {
		var status_color = {
			"Draft": "gray",
			"Submitted to Design": "blue",
			"Acknowledged": "yellow",
			"In Progress": "orange",
			"Completed": "green"
		};
		if (frm.doc.status) {
			frm.page.set_indicator(frm.doc.status, status_color[frm.doc.status] || "gray");
		}

		if (frm.doc.docstatus === 1 && frm.doc.status === "Submitted to Design" && frappe.user.has_role("Design Manager")) {
			frm.add_custom_button(__("Acknowledge"), function() {
				frappe.confirm("Mark this TDR as Acknowledged?", function() {
					frappe.call({
						method: "frappe.client.set_value",
						args: { doctype: "Technical Drawing Request", name: frm.doc.name, fieldname: "status", value: "Acknowledged" },
						callback: function() { frm.reload_doc(); }
					});
				});
			}, __("Actions")).addClass("btn-primary");
		}

		if (frm.doc.docstatus === 1 && frm.doc.status === "Acknowledged" && frappe.user.has_role("Design Manager")) {
			frm.add_custom_button(__("Mark In Progress"), function() {
				frappe.call({
					method: "frappe.client.set_value",
					args: { doctype: "Technical Drawing Request", name: frm.doc.name, fieldname: "status", value: "In Progress" },
					callback: function() { frm.reload_doc(); }
				});
			}, __("Actions"));
		}

		if (frm.doc.docstatus === 1 && ["Acknowledged","In Progress"].includes(frm.doc.status) && frappe.user.has_role("Design Manager")) {
			frm.add_custom_button(__("Mark Completed"), function() {
				frappe.confirm("Mark this TDR as Completed?", function() {
					frappe.call({
						method: "frappe.client.set_value",
						args: { doctype: "Technical Drawing Request", name: frm.doc.name, fieldname: "status", value: "Completed" },
						callback: function() { frm.reload_doc(); }
					});
				});
			}, __("Actions"));
		}
	}
});

frappe.ui.form.on("TDR Drawing Package", {
	drawing_status: function(frm, cdt, cdn) {
		var row = locals[cdt][cdn];
		if (row.drawing_status === "Drawing Received" && !row.received_date) {
			frappe.model.set_value(cdt, cdn, "received_date", frappe.datetime.get_today());
		}
	}
});
