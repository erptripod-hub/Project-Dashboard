frappe.pages['project-dashboard'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Project Dashboard',
		single_column: true
	});

	page.add_inner_button('Refresh', function() {
		if (cur_project) load_dashboard(cur_project);
	});

	var cur_project = null;

	// CSS
	if (!document.getElementById('pd-style')) {
		var s = document.createElement('style');
		s.id = 'pd-style';
		s.textContent =
			'.pd{padding:20px;background:#f0f4f8;min-height:100vh}' +
			'.pd .hdr{background:#0f1623;border-radius:8px;padding:16px 22px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px}' +
			'.pd .hdr h2{font-size:16px;font-weight:800;color:#fff;margin:0}.pd .hdr h2 span{color:#60a5fa}' +
			'.pd .hdr p{font-size:11px;color:#94a3b8;margin-top:3px}' +
			'.pd .k4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}' +
			'.pd .kc{background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.08);border-top:4px solid #2563eb}' +
			'.pd .kc .t{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;margin-bottom:8px}' +
			'.pd .kc .v{font-size:18px;font-weight:800;color:#1e293b;line-height:1}.pd .kc .s{font-size:10px;color:#64748b;margin-top:5px}' +
			'.pd .g2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px}' +
			'.pd .pn{background:#fff;border-radius:8px;padding:18px;box-shadow:0 1px 3px rgba(0,0,0,.08);margin-bottom:16px}' +
			'.pd .pt{font-size:13px;font-weight:700;color:#1e293b;margin-bottom:4px}' +
			'.pd .ps{font-size:11px;color:#64748b;margin-bottom:12px}' +
			'.pd .sr{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:12px}' +
			'.pd .sr:last-child{border-bottom:none}.pd .sl{color:#64748b}.pd .sv{font-weight:700;color:#1e293b}' +
			'.pd .sv.red{color:#dc2626}.pd .sv.green{color:#16a34a}.pd .sv.orange{color:#d97706}' +
			'.pd .pr{margin-bottom:12px}.pd .pl{display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px}' +
			'.pd .pl span:first-child{font-weight:600;color:#1e293b}.pd .pl span:last-child{color:#64748b}' +
			'.pd .pt2{background:#f1f5f9;border-radius:5px;height:10px}.pd .pf{height:10px;border-radius:5px}' +
			'.pd table{width:100%;border-collapse:collapse}' +
			'.pd th{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#64748b;font-weight:600;padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0}' +
			'.pd td{font-size:12px;padding:8px 10px;border-bottom:1px solid #f1f5f9;color:#1e293b}' +
			'.pd tr:last-child td{border-bottom:none}' +
			'.pd .badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600}' +
			'.pd .bg{background:#f0fdf4;color:#16a34a}.pd .bb{background:#eff6ff;color:#2563eb}' +
			'.pd .bo{background:#fffbeb;color:#d97706}.pd .br2{background:#fef2f2;color:#dc2626}' +
			'.pd .bd2{background:#1e293b;color:#fff}' +
			'.pd .tl-bar{background:#f1f5f9;border-radius:6px;height:14px;overflow:hidden;margin-top:8px}' +
			'.pd .tl-fill{height:14px;border-radius:6px;background:#2563eb}';
		document.head.appendChild(s);
	}

	// Build page
	$(wrapper).find('.page-content').html(
		'<div class="pd">' +
		'<div class="hdr">' +
		'<div><h2>TRIPOD MENA | <span>Project Dashboard</span></h2><p>Select a project below to view live data</p></div>' +
		'</div>' +
		'<div style="margin-bottom:16px">' +
		'<select id="pd-proj-sel" style="width:100%;padding:10px;font-size:14px;border:1px solid #e2e8f0;border-radius:8px;background:#fff">' +
		'<option value="">-- Select Project --</option>' +
		'</select>' +
		'</div>' +
		'<div id="pd-body" style="text-align:center;padding:60px;color:#64748b;font-size:14px;">Select a project above to load dashboard</div>' +
		'</div>'
	);

	// Load project list into dropdown
	frappe.db.get_list('Project', {
		fields: ['name', 'project_name'],
		limit: 500,
		filters: {status: ['!=', 'Cancelled']},
		order_by: 'modified desc'
	}).then(function(projects) {
		var sel = document.getElementById('pd-proj-sel');
		projects.forEach(function(p) {
			var opt = document.createElement('option');
			opt.value = p.name;
			opt.textContent = p.name + ' — ' + p.project_name;
			sel.appendChild(opt);
		});
	});

	document.getElementById('pd-proj-sel').addEventListener('change', function() {
		cur_project = this.value;
		if (cur_project) load_dashboard(cur_project);
	});

	function load_dashboard(project) {
		document.getElementById('pd-body').innerHTML = '<div style="text-align:center;padding:60px;color:#64748b;">Loading...</div>';
		frappe.call({
			method: 'project_dashboard.project_dashboard.page.project_dashboard.project_dashboard.get_dashboard_data',
			args: {project: project},
			callback: function(r) {
				if (r.message) render(r.message);
				else document.getElementById('pd-body').innerHTML = '<div style="text-align:center;padding:40px;color:#dc2626;">Error loading data. Check Error Log.</div>';
			},
			error: function(e) {
				document.getElementById('pd-body').innerHTML = '<div style="text-align:center;padding:40px;color:#dc2626;">Error: ' + (e.message || 'Unknown error') + '</div>';
			}
		});
	}

	function fmt(v) {
		if (!v) return 'AED 0';
		v = parseFloat(v);
		if (v >= 1000000) return 'AED ' + (v/1000000).toFixed(2) + 'M';
		if (v >= 1000) return 'AED ' + Math.round(v/1000) + 'K';
		return 'AED ' + v.toLocaleString('en-AE', {minimumFractionDigits:2, maximumFractionDigits:2});
	}

	function sc(status) {
		return {'Completed':'#16a34a','In Progress':'#2563eb','Delayed':'#dc2626','On Hold':'#d97706','Not Started':'#94a3b8'}[status] || '#2563eb';
	}

	function tb(status) {
		return {'On Track':'bg','Attention':'bo','Warning':'bo','Critical':'br2','Overdue':'bd2'}[status] || 'bb';
	}

	function sr(label, value, cls) {
		return '<div class="sr"><span class="sl">' + label + '</span><span class="sv' + (cls ? ' '+cls : '') + '">' + value + '</span></div>';
	}

	function kc(title, value, sub, color) {
		return '<div class="kc" style="border-top-color:' + color + '"><div class="t">' + title + '</div><div class="v">' + value + '</div><div class="s">' + sub + '</div></div>';
	}

	function render(d) {
		var info = d.project_info || {};
		var plan = d.plan || {};
		var has_plan = d.has_plan || false;
		var mp = d.manpower || {};
		var po = d.purchase_orders || {};

		var tl_pct = 0;
		if (has_plan && plan.project_duration > 0) {
			tl_pct = Math.min(Math.round((plan.days_passed / plan.project_duration) * 100), 100);
		}

		var html = '';

		// Project Header
		html += '<div class="pn" style="border-left:4px solid #2563eb">';
		html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">';
		html += '<div>';
		html += '<div style="font-size:18px;font-weight:800;color:#1e293b">' + (info.project_name || '') + '</div>';
		html += '<div style="font-size:11px;color:#94a3b8;margin-top:4px">Customer: ' + (info.customer || '—') + '</div>';
		html += '</div>';
		html += '<div style="text-align:right">';
		html += '<span class="badge bb">' + (info.status || '') + '</span>';
		if (has_plan && plan.timeline_status) {
			html += '<div style="margin-top:6px"><span class="badge ' + tb(plan.timeline_status) + '">' + plan.timeline_status + '</span></div>';
		}
		html += '</div></div>';

		if (has_plan && plan.start_date) {
			html += '<div style="margin-top:14px">';
			html += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">';
			html += '<span style="color:#64748b">' + plan.start_date + ' → ' + plan.end_date + '</span>';
			html += '<span><b>' + (plan.days_passed||0) + '</b> passed &nbsp;|&nbsp; <b>' + (plan.days_remaining||0) + '</b> remaining &nbsp;|&nbsp; <b>' + (plan.project_duration||0) + '</b> total days</span>';
			html += '</div>';
			html += '<div class="tl-bar"><div class="tl-fill" style="width:' + tl_pct + '%"></div></div>';
			html += '</div>';
		}
		html += '</div>';

		// Financial Cards
		html += '<div class="k4">';
		html += kc('Contract Value', fmt(has_plan ? plan.boq_grand_total : 0), 'BOQ incl. VAT', '#2563eb');
		html += kc('Project Budget', fmt(has_plan ? plan.total_project_cost : 0), 'Adjusted + Overhead', '#7c3aed');
		html += kc('Total Spent', fmt(d.total_spent || 0), 'POs + Expenses', '#0d9488');
		html += kc('Remaining', fmt((has_plan ? plan.total_project_cost : 0) - (d.total_spent || 0)), 'Budget - Spent', '#d97706');
		html += '</div>';

		// Manpower + PO
		html += '<div class="g2">';
		html += '<div class="pn"><div class="pt">👷 Manpower & Hours</div><div class="ps">From Project Timesheets</div>';
		html += sr('Employees', mp.total_employees || 0);
		html += sr('Working Hours', (mp.total_working_hours || 0) + ' hrs');
		html += sr('Overtime Hours', (mp.total_overtime_hours || 0) + ' hrs', 'orange');
		html += sr('Total Manhours', (mp.total_manhours || 0) + ' hrs', 'green');
		html += '</div>';

		html += '<div class="pn"><div class="pt">🛒 Purchase Orders</div><div class="ps">Submitted POs only</div>';
		html += sr('POs Raised', po.total_pos || 0);
		html += sr('Suppliers', po.total_suppliers || 0);
		html += sr('Total PO Value', fmt(po.total_value));
		html += sr('Received', fmt(po.total_received), 'green');
		html += sr('Pending', fmt(po.total_pending), 'red');
		html += sr('Expense Claims', fmt(d.total_expenses || 0));
		html += '</div></div>';

		// Subcontractors
		if (has_plan && plan.subcontractors && plan.subcontractors.length) {
			html += '<div class="pn"><div class="pt">🏗️ Subcontractors (' + plan.subcontractors.length + ')</div><div class="ps">Allocated subcontractors</div>';
			html += '<table><thead><tr><th>Supplier</th><th>Scope</th><th>Contract Value</th><th>Status</th></tr></thead><tbody>';
			plan.subcontractors.forEach(function(s) {
				var bc = s.status === 'Active' ? 'bg' : s.status === 'Completed' ? 'bb' : 'bo';
				html += '<tr><td><b>' + (s.supplier_name||'') + '</b></td><td style="color:#64748b">' + (s.scope_of_work||'—') + '</td><td>' + fmt(s.contract_value) + '</td><td><span class="badge ' + bc + '">' + s.status + '</span></td></tr>';
			});
			html += '</tbody></table></div>';
		}

		// Phase Plan
		if (has_plan && plan.phases && plan.phases.length) {
			html += '<div class="pn"><div class="pt">📋 Project Phases</div><div class="ps">Progress per phase</div>';
			plan.phases.forEach(function(s) {
				var col = sc(s.status);
				var bc = {'Completed':'bg','In Progress':'bb','Delayed':'br2','On Hold':'bo','Not Started':'bd2'}[s.status] || 'bb';
				html += '<div class="pr"><div class="pl"><span>' + s.phase_name + ' <span class="badge ' + bc + '">' + s.status + '</span></span><span>' + (s.start_date||'') + ' → ' + (s.end_date||'') + ' &nbsp;<b>' + (s.progress||0) + '%</b></span></div>';
				html += '<div class="pt2"><div class="pf" style="width:' + (s.progress||0) + '%;background:' + col + '"></div></div></div>';
			});
			html += '</div>';
		}

		// Department Budget
		if (has_plan && plan.department_budgets && plan.department_budgets.length) {
			html += '<div class="pn"><div class="pt">💼 Department Budget</div><div class="ps">Allocation vs Spent</div>';
			plan.department_budgets.forEach(function(dep) {
				var pct = dep.budget_amount > 0 ? Math.min(Math.round(dep.spent_amount/dep.budget_amount*100), 100) : 0;
				var col = dep.status === 'Exceeded' ? '#dc2626' : dep.status === 'Warning' ? '#d97706' : '#16a34a';
				html += '<div class="pr"><div class="pl"><span>' + dep.department_name + ' (' + dep.allocation_percent + '%)</span><span>' + fmt(dep.spent_amount) + ' / ' + fmt(dep.budget_amount) + ' &nbsp;<b style="color:' + col + '">' + pct + '%</b></span></div>';
				html += '<div class="pt2"><div class="pf" style="width:' + pct + '%;background:' + col + '"></div></div></div>';
			});
			html += '</div>';
		}

		// Labour Plan
		if (has_plan && plan.labour_plan && plan.labour_plan.length) {
			html += '<div class="pn"><div class="pt">👷 Labour Plan</div><div class="ps">Estimated workforce</div>';
			html += '<table><thead><tr><th>Trade/Role</th><th>Headcount</th><th>Days</th><th>Working Hrs</th><th>OT Hrs</th><th>Total Hrs</th></tr></thead><tbody>';
			plan.labour_plan.forEach(function(l) {
				html += '<tr><td><b>' + l.trade_role + '</b></td><td>' + l.headcount + '</td><td>' + l.estimated_days + '</td><td>' + (l.estimated_working_hours||0) + '</td><td>' + (l.estimated_ot_hours||0) + '</td><td><b>' + (l.estimated_total_hours||0) + '</b></td></tr>';
			});
			html += '</tbody></table></div>';
		}

		// Weekly Reports
		html += '<div class="pn"><div class="pt">📅 Weekly Reports</div>';
		if (d.weekly_reports && d.weekly_reports.length) {
			html += '<table><thead><tr><th>Week</th><th>Date</th><th>File</th><th>Sent to Client</th></tr></thead><tbody>';
			d.weekly_reports.forEach(function(r) {
				html += '<tr><td><b>Week ' + r.week_number + '</b></td><td style="color:#64748b">' + (r.report_date||'') + '</td>';
				html += '<td>' + (r.report_file ? '<a href="' + r.report_file + '" target="_blank">📎 Download</a>' : '—') + '</td>';
				html += '<td>' + (r.sent_to_client ? '<span class="badge bg">✅ Sent</span>' : '<span class="badge bo">⏳ Pending</span>') + '</td></tr>';
			});
			html += '</tbody></table>';
		} else {
			html += '<div style="color:#94a3b8;font-size:13px;padding:8px 0">No weekly reports added yet</div>';
		}
		html += '</div>';

		document.getElementById('pd-body').innerHTML = html;
	}
};
