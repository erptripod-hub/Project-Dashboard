frappe.ui.form.on("Technical Drawing Request", {

	onload: function(frm) {
		// Auto set requested_by from logged in employee
		if (frm.is_new()) {
			frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name", function(r) {
				if (r && r.name) frm.set_value("requested_by", r.name);
			});
		}
	},

	refresh: function(frm) {
		// Status indicator colors
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

		// Design Manager: button to mark Acknowledged
		if (
			frm.doc.docstatus === 1 &&
			frm.doc.status === "Submitted to Design" &&
			frappe.user.has_role("Design Manager")
		) {
			frm.add_custom_button(__("Acknowledge"), function() {
				frappe.confirm(
					"Mark this TDR as Acknowledged?",
					function() {
						frappe.call({
							method: "frappe.client.set_value",
							args: {
								doctype: "Technical Drawing Request",
								name: frm.doc.name,
								fieldname: "status",
								value: "Acknowledged"
							},
							callback: function() {
								frm.reload_doc();
								frappe.msgprint("TDR Acknowledged successfully.", "green");
							}
						});
					}
				);
			}, __("Actions")).addClass("btn-primary");
		}

		// Design Manager: mark as In Progress
		if (
			frm.doc.docstatus === 1 &&
			frm.doc.status === "Acknowledged" &&
			frappe.user.has_role("Design Manager")
		) {
			frm.add_custom_button(__("Mark In Progress"), function() {
				frappe.call({
					method: "frappe.client.set_value",
					args: {
						doctype: "Technical Drawing Request",
						name: frm.doc.name,
						fieldname: "status",
						value: "In Progress"
					},
					callback: function() { frm.reload_doc(); }
				});
			}, __("Actions"));
		}

		// Design Manager: mark as Completed
		if (
			frm.doc.docstatus === 1 &&
			["Acknowledged", "In Progress"].includes(frm.doc.status) &&
			frappe.user.has_role("Design Manager")
		) {
			frm.add_custom_button(__("Mark Completed"), function() {
				frappe.confirm(
					"Mark all drawings as received and complete this TDR?",
					function() {
						frappe.call({
							method: "frappe.client.set_value",
							args: {
								doctype: "Technical Drawing Request",
								name: frm.doc.name,
								fieldname: "status",
								value: "Completed"
							},
							callback: function() { frm.reload_doc(); }
						});
					}
				);
			}, __("Actions"));
		}

		// Drawing package - auto set received date when status = Drawing Received
		frm.fields_dict["drawing_packages"].grid.get_field("drawing_status").df.onchange = function() {
			var row = frm.fields_dict["drawing_packages"].grid.get_selected_children()[0];
			if (row && row.drawing_status === "Drawing Received" && !row.received_date) {
				frappe.model.set_value(row.doctype, row.name, "received_date", frappe.datetime.get_today());
			}
		};
	},

	project: function(frm) {
		if (frm.doc.project) {
			frappe.db.get_value("Project", frm.doc.project, ["project_name", "custom_project_location"], function(r) {
				if (r) {
					if (r.custom_project_location) frm.set_value("project_location", r.custom_project_location);
				}
			});
		}
	}
});

// Auto set received_date when drawing status changes to received
frappe.ui.form.on("TDR Drawing Package", {
	drawing_status: function(frm, cdt, cdn) {
		var row = locals[cdt][cdn];
		if (row.drawing_status === "Drawing Received" && !row.received_date) {
			frappe.model.set_value(cdt, cdn, "received_date", frappe.datetime.get_today());
		}
	}
});
