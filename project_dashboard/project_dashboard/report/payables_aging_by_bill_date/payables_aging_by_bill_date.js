// Copyright (c) 2026, Tripod and contributors

frappe.query_reports["Payables Aging by Bill Date"] = {
	filters: [
		{
			fieldname: "company",
			label: __("Company"),
			fieldtype: "Link",
			options: "Company",
			reqd: 1,
			default: frappe.defaults.get_user_default("Company"),
		},
		{
			fieldname: "view",
			label: __("View"),
			fieldtype: "Select",
			options: "Supplier Summary\nInvoice Detail",
			default: "Supplier Summary",
			reqd: 1,
		},
		{
			fieldname: "ageing_based_on",
			label: __("Ageing Based On"),
			fieldtype: "Select",
			options: "Bill Date\nPosting Date\nDue Date",
			default: "Bill Date",
			reqd: 1,
		},
		{
			fieldname: "supplier",
			label: __("Supplier"),
			fieldtype: "Link",
			options: "Supplier",
		},
		{
			fieldname: "supplier_group",
			label: __("Supplier Group"),
			fieldtype: "Link",
			options: "Supplier Group",
		},
		{
			fieldname: "range1",
			label: __("Range 1"),
			fieldtype: "Int",
			default: 30,
			reqd: 1,
		},
		{
			fieldname: "range2",
			label: __("Range 2"),
			fieldtype: "Int",
			default: 60,
			reqd: 1,
		},
		{
			fieldname: "range3",
			label: __("Range 3"),
			fieldtype: "Int",
			default: 90,
			reqd: 1,
		},
		{
			fieldname: "range4",
			label: __("Range 4"),
			fieldtype: "Int",
			default: 120,
			reqd: 1,
		},
	],
};
