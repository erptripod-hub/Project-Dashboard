frappe.pages['project-dashboard'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Project Dashboard',
		single_column: true
	});

	page.add_inner_button('Refresh', function() {
		var proj = page.fields_dict.project.get_value();
		if (proj) load_dashboard(proj);
	});

	$('<style>').text(
		'.pd{padding:20px;background:#f0f4f8;min-height:100vh}' +
		'.pd .hdr{background:#0f1623;border-radius:8px;padding:16px 22px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px}' +
		'.pd .hdr h2{font-size:16px;font-weight:800;color:#fff;margin:0}' +
		'.pd .hdr h2 span{color:#60a5fa}' +
		'.pd .hdr p{font-size:11px;color:#94a3b8;margin-top:3px}' +
		'.pd .hdr-r select{background:#1e2a3b;border:1px solid #2d3748;color:#e2e8f0;padding:6px 10px;border-radius:6px;font-size:12px}' +
		'.pd .sec{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin:18px 0 10px 0}' +
		'.pd .k4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}' +
		'.pd .k3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}' +
		'.pd .kc{background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.08);border-top:4px solid #2563eb}' +
		'.pd .kc .t{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;margin-bottom:8px}' +
		'.pd .kc .v{font-size:22px;font-weight:800;color:#1e293b;line-height:1}' +
		'.pd .kc .s{font-size:10px;color:#64748b;margin-top:5px}' +
		'.pd .g2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px}' +
		'.pd .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:16px}' +
		'.pd .pn{background:#fff;border-radius:8px;padding:18px;box-shadow:0 1px 3px rgba(0,0,0,0.08)}' +
		'.pd .pt{font-size:13px;font-weight:700;color:#1e293b;margin-bottom:3px}' +
		'.pd .ps{font-size:11px;color:#64748b;margin-bottom:14px}' +
		'.pd .sr{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:12px}' +
		'.pd .sr:last-child{border-bottom:none}' +
		'.pd .sl{color:#64748b}' +
		'.pd .sv{font-weight:700;color:#1e293b}' +
		'.pd .sv.red{color:#dc2626}' +
		'.pd .sv.green{color:#16a34a}' +
		'.pd .sv.orange{color:#d97706}' +
		'.pd .pr{margin-bottom:14px}' +
		'.pd .pl{display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px}' +
		'.pd .pl span:first-child{font-weight:600;color:#1e293b}' +
		'.pd .pl span:last-child{color:#64748b}' +
		'.pd .pt2{background:#f1f5f9;border-radius:5px;height:10px}' +
		'.pd .pf{height:10px;border-radius:5px}' +
		'.pd table{width:100%;border-collapse:collapse}' +
		'.pd th{font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;font-weight:600;padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0}' +
		'.pd td{font-size:12px;padding:9px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle;color:#1e293b}' +
		'.pd tr:last-child td{border-bottom:none}' +
		'.pd .badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600}' +
		'.pd .bg{background:#f0fdf4;color:#16a34a}' +
		'.pd .bb{background:#eff6ff;color:#2563eb}' +
		'.pd .bo{background:#fffbeb;color:#d97706}' +
		'.pd .br{background:#fef2f2;color:#dc2626}' +
		'.pd .bd2{background:#1e293b;color:#fff}' +
		'.pd .tl-bar{background:#f1f5f9;border-radius:6px;height:14px;overflow:hidden;margin-top:8px}' +
		'.pd .tl-fill{height:14px;border-radius:6px;background:#2563eb;transition:width 0.5s}'
	).appendTo('head');

	$(wrapper).find('.page-content').html(
		'<div class="pd">' +
		'<div class="hdr"><div><h2>TRIPOD MENA | <span>Project Dashboard</span></h2><p>Select a project to view live data</p></div>' +
		'<div class="hdr-r"><select id="pd-proj"><option value="">-- Select Project --</option></select></div></div>' +
		'<div id="pd-body"><div style="text-align:center;padding:60px;color:#64748b;font-size:14px;">Select a project from the dropdown above</div></div>' +
		'</div>'
	);

	// Load project list
	frappe.db.get_list('Project', {fields: ['name','project_name'], limit: 500, filters: {status: ['!=','Cancelled']}}).then(function(projects) {
		var sel = document.getElementById('pd-proj');
		projects.forEach(function(p) {
			var opt = document.createElement('option');
			opt.value = p.name;
			opt.textContent = p.name + ' — ' + p.project_name;
			sel.appendChild(opt);
		});
	});

	document.getElementById('pd-proj').addEventListener('change', function() {
		if (this.value) load_dashboard(this.value);
	});

	function load_dashboard(project) {
		document.getElementById('pd-body').innerHTML = '<div style="text-align:center;padding:60px;color:#64748b;">Loading...</div>';
		frappe.call({
			method: 'project_dashboard.project_dashboard.page.project_dashboard.project_dashboard.get_dashboard_data',
			args: { project: project },
			callback: function(r) {
				if (r.message) render(r.message);
				else document.getElementById('pd-body').innerHTML = '<div style="text-align:center;padding:60px;color:#dc2626;">Error loading data</div>';
			}
		});
	}

	function fmt(v) {
		if (!v) return 'AED 0';
		if (v >= 1000000) return 'AED ' + (v/1000000).toFixed(2) + 'M';
		if (v >= 1000) return 'AED ' + Math.round(v/1000) + 'K';
		return 'AED ' + parseFloat(v).toLocaleString('en-AE', {minimumFractionDigits:2, maximumFractionDigits:2});
	}

	function stage_color(status) {
		return {'Completed':'#16a34a','In Progress':'#2563eb','Delayed':'#dc2626','On Hold':'#d97706','Not Started':'#94a3b8'}[status] || '#2563eb';
	}

	function timeline_badge(status) {
		return {'On Track':'bg','Attention':'bo','Warning':'bo','Critical':'br','Overdue':'bd2'}[status] || 'bb';
	}

	function render(d) {
		var info = d.project_info;
		var plan = d.plan;
		var mp = d.manpower;
		var po = d.purchase_orders;
		var has_plan = d.has_plan;

		// Timeline calc
		var tl_pct = 0;
		if (has_plan && plan.project_duration > 0) {
			tl_pct = Math.min(Math.round(plan.days_passed / plan.project_duration * 100), 100);
		}

		var html =
		// Project Header
		'<div class="pn" style="margin-bottom:16px;border-left:4px solid #2563eb">' +
		'<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">' +
		'<div>' +
		'<div style="font-size:18px;font-weight:800;color:#1e293b">' + d.plan.project || info.project_name + '</div>' +
		'<div style="font-size:13px;color:#64748b;margin-top:2px">' + info.project_name + '</div>' +
		'<div style="font-size:11px;color:#94a3b8;margin-top:4px">Customer: ' + (info.customer || '—') + '</div>' +
		'</div>' +
		'<div style="text-align:right">' +
		'<span class="badge bb">' + info.status + '</span>' +
		(has_plan ? '<div style="margin-top:6px"><span class="badge ' + timeline_badge(plan.timeline_status) + '">' + plan.timeline_status + '</span></div>' : '') +
		'</div></div>' +
		(has_plan && plan.start_date ?
			'<div style="margin-top:14px">' +
			'<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">' +
			'<span style="color:#64748b">' + plan.start_date + ' → ' + plan.end_date + '</span>' +
			'<span><b>' + plan.days_passed + '</b> days passed &nbsp;|&nbsp; <b>' + plan.days_remaining + '</b> days remaining &nbsp;|&nbsp; <b>' + plan.project_duration + '</b> total days</span>' +
			'</div>' +
			'<div class="tl-bar"><div class="tl-fill" style="width:' + tl_pct + '%"></div></div>' +
			'</div>' : '') +
		'</div>' +

		// Financial Cards
		'<div class="sec">Financial Summary</div>' +
		'<div class="k4">' +
		kcard("Contract Value", fmt(has_plan ? plan.boq_grand_total : 0), "BOQ incl. VAT & Markup", "#2563eb") +
		kcard("Project Budget", fmt(has_plan ? plan.total_project_cost : 0), "Adjusted + Overhead", "#7c3aed") +
		kcard("Total Spent", fmt(d.total_spent), "POs + Expense Claims", "#0d9488") +
		kcard("Remaining", fmt((has_plan ? plan.total_project_cost : 0) - d.total_spent), "Budget - Spent", "#d97706") +
		'</div>' +

		// Manpower + PO
		'<div class="g2">' +
		'<div class="pn"><div class="pt">👷 Manpower & Hours</div><div class="ps">From Project Timesheets</div>' +
		sr("Employees Worked", (mp.total_employees || 0)) +
		sr("Total Working Hours", (mp.total_working_hours || 0) + " hrs") +
		sr("Total Overtime Hours", (mp.total_overtime_hours || 0) + " hrs", "orange") +
		sr("Total Manhours", (mp.total_manhours || 0) + " hrs", "green") +
		'</div>' +
		'<div class="pn"><div class="pt">🛒 Purchase Orders</div><div class="ps">Submitted POs only</div>' +
		sr("POs Raised", po.total_pos || 0) +
		sr("Suppliers", po.total_suppliers || 0) +
		sr("Total PO Value", fmt(po.total_value)) +
		sr("Amount Received", fmt(po.total_received), "green") +
		sr("Amount Pending", fmt(po.total_pending), "red") +
		sr("Expense Claims", fmt(d.total_expenses)) +
		'</div></div>' +

		// Subcontractors
		(has_plan && plan.subcontractors && plan.subcontractors.length > 0 ?
		'<div class="pn" style="margin-bottom:16px"><div class="pt">🏗️ Subcontractors</div><div class="ps">' + plan.subcontractors.length + ' subcontractor(s)</div>' +
		'<table><thead><tr><th>Supplier</th><th>Scope</th><th>Contract Value</th><th>Status</th></tr></thead><tbody>' +
		plan.subcontractors.map(function(s) {
			var bc = s.status === 'Active' ? 'bg' : s.status === 'Completed' ? 'bb' : 'bo';
			return '<tr><td><b>' + s.supplier_name + '</b></td><td style="color:#64748b">' + (s.scope_of_work || '—') + '</td><td>' + fmt(s.contract_value) + '</td><td><span class="badge ' + bc + '">' + s.status + '</span></td></tr>';
		}).join('') +
		'</tbody></table></div>' : '') +

		// Phase Plan
		(has_plan && plan.phases && plan.phases.length > 0 ?
		'<div class="pn" style="margin-bottom:16px"><div class="pt">📋 Project Plan & Stages</div><div class="ps">Progress per phase</div>' +
		plan.phases.map(function(s) {
			var col = stage_color(s.status);
			var bc = {'Completed':'bg','In Progress':'bb','Delayed':'br','On Hold':'bo','Not Started':'bd2'}[s.status] || 'bb';
			return '<div class="pr">' +
				'<div class="pl"><span>' + s.phase_name + ' <span class="badge ' + bc + '">' + s.status + '</span></span>' +
				'<span>' + (s.start_date || '') + ' → ' + (s.end_date || '') + ' &nbsp;<b>' + (s.progress || 0) + '%</b></span></div>' +
				'<div class="pt2"><div class="pf" style="width:' + (s.progress || 0) + '%;background:' + col + '"></div></div>' +
				'</div>';
		}).join('') + '</div>' : '') +

		// Department Budget
		(has_plan && plan.department_budgets && plan.department_budgets.length > 0 ?
		'<div class="pn" style="margin-bottom:16px"><div class="pt">💼 Department Budget</div><div class="ps">Allocation vs Spent</div>' +
		plan.department_budgets.map(function(d2) {
			var pct = d2.budget_amount > 0 ? Math.min(Math.round(d2.spent_amount / d2.budget_amount * 100), 100) : 0;
			var col = d2.status === 'Exceeded' ? '#dc2626' : d2.status === 'Warning' ? '#d97706' : '#16a34a';
			return '<div class="pr">' +
				'<div class="pl"><span>' + d2.department_name + ' (' + d2.allocation_percent + '%)</span>' +
				'<span>' + fmt(d2.spent_amount) + ' / ' + fmt(d2.budget_amount) + ' &nbsp;<b style="color:' + col + '">' + pct + '%</b></span></div>' +
				'<div class="pt2"><div class="pf" style="width:' + pct + '%;background:' + col + '"></div></div>' +
				'</div>';
		}).join('') + '</div>' : '') +

		// Labour Plan
		(has_plan && plan.labour_plan && plan.labour_plan.length > 0 ?
		'<div class="pn" style="margin-bottom:16px"><div class="pt">👷 Labour Plan (Estimated)</div><div class="ps">Planned workforce</div>' +
		'<table><thead><tr><th>Trade/Role</th><th>Headcount</th><th>Est. Days</th><th>Working Hrs</th><th>OT Hrs</th><th>Total Hrs</th></tr></thead><tbody>' +
		plan.labour_plan.map(function(l) {
			return '<tr><td><b>' + l.trade_role + '</b></td><td>' + l.headcount + '</td><td>' + l.estimated_days + '</td><td>' + l.estimated_working_hours + '</td><td>' + (l.estimated_ot_hours || 0) + '</td><td><b>' + l.estimated_total_hours + '</b></td></tr>';
		}).join('') +
		'</tbody></table></div>' : '') +

		// Weekly Reports
		(d.weekly_reports && d.weekly_reports.length > 0 ?
		'<div class="pn"><div class="pt">📅 Weekly Reports</div><div class="ps">Client report status</div>' +
		'<table><thead><tr><th>Week</th><th>Date</th><th>File</th><th>Sent to Client</th></tr></thead><tbody>' +
		d.weekly_reports.map(function(r) {
			return '<tr><td><b>Week ' + r.week_number + '</b></td><td style="color:#64748b">' + r.report_date + '</td>' +
				'<td>' + (r.report_file ? '<a href="' + r.report_file + '" target="_blank">📎 Download</a>' : '<span style="color:#94a3b8">—</span>') + '</td>' +
				'<td>' + (r.sent_to_client ? '<span class="badge bg">✅ Sent</span>' : '<span class="badge bo">⏳ Pending</span>') + '</td></tr>';
		}).join('') + '</tbody></table></div>' :
		'<div class="pn"><div class="pt">📅 Weekly Reports</div><div style="color:#94a3b8;font-size:13px;padding:10px 0">No weekly reports added yet</div></div>');

		document.getElementById('pd-body').innerHTML = html;
	}

	function kcard(title, value, sub, color) {
		return '<div class="kc" style="border-top-color:' + color + '"><div class="t">' + title + '</div><div class="v" style="font-size:16px">' + value + '</div><div class="s">' + sub + '</div></div>';
	}

	function sr(label, value, color) {
		return '<div class="sr"><span class="sl">' + label + '</span><span class="sv' + (color ? ' ' + color : '') + '">' + value + '</span></div>';
	}
};
