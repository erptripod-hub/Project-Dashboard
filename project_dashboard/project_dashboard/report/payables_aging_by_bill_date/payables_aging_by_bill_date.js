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
			options: "Invoice Detail\nSupplier Summary",
			default: "Invoice Detail",
			reqd: 1,
		},
		{
			fieldname: "ageing_based_on",
			label: __("Ageing Based On"),
			fieldtype: "Select",
			options: "Supplier Invoice Date\nPosting Date\nDue Date",
			default: "Supplier Invoice Date",
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

	formatter(value, row, column, data, default_formatter) {
		value = default_formatter(value, row, column, data);
		if (!data) return value;
		const f = column.fieldname;
		const v = flt(data[f]);
		if (f === "outstanding") {
			return `<span style="font-weight:700">${value}</span>`;
		}
		if ((f === "range4" || f === "range5") && v > 0) {
			return `<span style="color:#b91c1c;font-weight:600">${value}</span>`;
		}
		if (f === "range3" && v > 0) {
			return `<span style="color:#c2410c;font-weight:600">${value}</span>`;
		}
		if (f.startsWith("range") && v === 0) {
			return `<span style="color:#9ca3af">${value}</span>`;
		}
		if (f === "no_bill_date" && v > 0) {
			return `<span style="color:#c2410c;font-weight:600">${value}</span>`;
		}
		if (f === "age" && v > 90) {
			return `<span style="color:#b91c1c;font-weight:600">${value}</span>`;
		}
		return value;
	},
};
