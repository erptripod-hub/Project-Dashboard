frappe.pages['project-dashboard'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Project Dashboard',
		single_column: true
	});

	var cur_project = null;

	page.add_inner_button('Refresh', function() {
		if (cur_project) load_dashboard(cur_project);
	});

	if (!document.getElementById('pd-style')) {
		var s = document.createElement('style');
		s.id = 'pd-style';
		s.textContent =
			'.pd-wrap{margin:-15px;background:#f0f4f8;min-height:100vh;padding:14px}' +
			'.pd .hdr{background:#0f1623;border-radius:12px;padding:16px 22px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}' +
			'.pd .hdr-l h2{font-size:16px;font-weight:800;color:#fff;margin:0}.pd .hdr-l h2 span{color:#60a5fa}' +
			'.pd .hdr-l p{font-size:11px;color:#94a3b8;margin-top:2px}' +
			'.pd .hdr select{background:#1e2a3b;border:1px solid #334155;color:#e2e8f0;padding:8px 14px;border-radius:8px;font-size:12px;min-width:280px}' +
			'.pd .proj-hdr{background:#fff;border-radius:12px;padding:18px 22px;margin-bottom:14px;border:1px solid #e2e8f0;border-left:5px solid #2563eb}' +
			'.pd .proj-name{font-size:17px;font-weight:800;color:#0f172a}' +
			'.pd .proj-meta{font-size:12px;color:#64748b;margin-top:3px}' +
			'.pd .badges{display:flex;gap:6px;margin-top:8px}' +
			'.pd .badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}' +
			'.pd .bg{background:#dcfce7;color:#15803d}.pd .bb{background:#dbeafe;color:#1d4ed8}' +
			'.pd .bo{background:#fff7ed;color:#c2410c}.pd .br{background:#fee2e2;color:#b91c1c}' +
			'.pd .bgr{background:#f1f5f9;color:#475569}.pd .bd{background:#1e293b;color:#f1f5f9}' +
			'.pd .ba{background:#fef3c7;color:#92400e}' +
			'.pd .tl-bar{background:#e2e8f0;border-radius:8px;height:10px;overflow:hidden;margin-top:8px}' +
			'.pd .tl-fill{height:10px;border-radius:8px;background:#2563eb}' +
			'.pd .k4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}' +
			'.pd .kc{background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #e2e8f0;border-top:4px solid #ccc}' +
			'.pd .kc .t{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#64748b;font-weight:600;margin-bottom:8px}' +
			'.pd .kc .v{font-size:20px;font-weight:800;color:#0f172a}.pd .kc .s{font-size:10px;color:#94a3b8;margin-top:4px}' +
			'.pd .g2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;align-items:start}' +
			'.pd .card{background:#fff;border-radius:12px;padding:16px 18px;border:1px solid #e2e8f0}' +
			'.pd .ch{display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #f1f5f9}' +
			'.pd .ci{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}' +
			'.pd .ci-b{background:#dbeafe}.pd .ci-p{background:#ede9fe}.pd .ci-t{background:#ccfbf1}.pd .ci-a{background:#fff7ed}.pd .ci-g{background:#dcfce7}' +
			'.pd .ct{font-size:13px;font-weight:700;color:#0f172a}.pd .cs{font-size:11px;color:#94a3b8}' +
			'.pd .sr{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #f8fafc;font-size:12px}' +
			'.pd .sr:last-child{border-bottom:none}.pd .sl{color:#64748b}.pd .sv{font-weight:700;color:#0f172a}' +
			'.pd .sv-g{color:#15803d}.pd .sv-r{color:#b91c1c}.pd .sv-o{color:#c2410c}.pd .sv-b{color:#1d4ed8}' +
			'.pd table{width:100%;border-collapse:collapse;font-size:12px}' +
			'.pd th{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;font-weight:600;padding:6px 10px;text-align:left;border-bottom:2px solid #f1f5f9}' +
			'.pd td{padding:10px;border-bottom:1px solid #f8fafc;color:#0f172a;font-size:12px}' +
			'.pd tr:last-child td{border-bottom:none}' +
			'.pd .pr{margin-bottom:10px}.pd .pr:last-child{margin-bottom:0}' +
			'.pd .pl{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px}' +
			'.pd .pn{font-size:12px;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:6px}' +
			'.pd .pm{font-size:11px;color:#64748b}' +
			'.pd .pbar{background:#f1f5f9;border-radius:6px;height:8px;overflow:hidden}' +
			'.pd .pfill{height:8px;border-radius:6px}' +
			'.pd .dr{margin-bottom:14px}.pd .dr:last-child{margin-bottom:0}' +
			'.pd .dt{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px}' +
			'.pd .dn{font-size:12px;font-weight:700;color:#0f172a}' +
			'.pd .da{font-size:11px;color:#94a3b8;font-weight:400}' +
			'.pd .dbar{background:#f1f5f9;border-radius:6px;height:10px;overflow:hidden}' +
			'.pd .dfill{height:10px;border-radius:6px}' +
			'.pd .dsub{display:flex;justify-content:space-between;font-size:11px;margin-top:3px}';
		document.head.appendChild(s);
	}

	$(page.main).html(
		'<div class="pd-wrap">' +
		'<div class="hdr">' +
		'<div class="hdr-l"><h2>TRIPOD MENA | <span>Project Dashboard</span></h2><p>Select a project to view live data</p></div>' +
		'<input id="pd-inp" list="pd-dl" placeholder="Type project name or number..." style="background:#1e2a3b;border:1px solid #334155;color:#e2e8f0;padding:8px 14px;border-radius:8px;font-size:12px;min-width:300px;outline:none" autocomplete="off"><datalist id="pd-dl"></datalist>' +
		'</div>' +
		'<div id="pd-body" style="text-align:center;padding:60px;color:#64748b;font-size:13px">Select a project above to load dashboard</div>' +
		'</div>'
	);

	frappe.db.get_list('Project', {
		fields: ['name', 'project_name'],
		limit: 500,
		filters: {status: ['!=', 'Cancelled']},
		order_by: 'modified desc'
	}).then(function(projects) {
		var dl = document.getElementById('pd-dl');
		var map = {};
		projects.forEach(function(p) {
			var opt = document.createElement('option');
			opt.value = p.name + ' — ' + p.project_name;
			opt.setAttribute('data-id', p.name);
			dl.appendChild(opt);
			map[p.name + ' — ' + p.project_name] = p.name;
		});
		window._pd_project_map = map;
	});

	document.getElementById('pd-inp').addEventListener('change', function() {
		var val = this.value;
		var map = window._pd_project_map || {};
		// Try exact match first
		if (map[val]) {
			cur_project = map[val];
			load_dashboard(cur_project);
			return;
		}
		// Try matching by project ID
		var keys = Object.keys(map);
		for (var i = 0; i < keys.length; i++) {
			if (keys[i].indexOf(val) === 0) {
				cur_project = map[keys[i]];
				load_dashboard(cur_project);
				return;
			}
		}
	});

	function load_dashboard(project) {
		document.getElementById('pd-body').innerHTML = '<div style="text-align:center;padding:60px;color:#64748b">Loading...</div>';
		frappe.call({
			method: 'project_dashboard.project_dashboard.page.project_dashboard.project_dashboard.get_dashboard_data',
			args: {project: project},
			callback: function(r) {
				if (r.message) render(r.message);
				else document.getElementById('pd-body').innerHTML = '<div style="text-align:center;padding:40px;color:#dc2626">Error loading data. Check error log.</div>';
			},
			error: function() {
				document.getElementById('pd-body').innerHTML = '<div style="text-align:center;padding:40px;color:#dc2626">Error loading data.</div>';
			}
		});
	}

	function fmt(v) {
		v = parseFloat(v) || 0;
		if (v >= 1000000) return 'AED ' + (v/1000000).toFixed(2) + 'M';
		if (v >= 1000) return 'AED ' + Math.round(v/1000) + 'K';
		return 'AED ' + v.toLocaleString('en-AE', {minimumFractionDigits:2, maximumFractionDigits:2});
	}

	function badge(text, cls) {
		return '<span class="badge ' + cls + '">' + text + '</span>';
	}

	function sr(label, value, cls) {
		return '<div class="sr"><span class="sl">' + label + '</span><span class="sv' + (cls ? ' '+cls : '') + '">' + value + '</span></div>';
	}

	function kc(title, value, sub, color) {
		return '<div class="kc" style="border-top-color:' + color + '"><div class="t">' + title + '</div><div class="v">' + value + '</div><div class="s">' + sub + '</div></div>';
	}

	function phase_badge(status) {
		var map = {'Completed':'bg','In Progress':'bb','Delayed':'br','On Hold':'ba','Not Started':'bgr'};
		return badge(status, map[status] || 'bgr');
	}

	function phase_color(status) {
		var map = {'Completed':'#15803d','In Progress':'#2563eb','Delayed':'#dc2626','On Hold':'#d97706','Not Started':'#94a3b8'};
		return map[status] || '#94a3b8';
	}

	function tl_badge(status) {
		var map = {'On Track':'bg','Attention':'ba','Warning':'bo','Critical':'br','Overdue':'bd'};
		return badge(status, map[status] || 'bb');
	}

	function fmtAED(v) {
		v = parseFloat(v) || 0;
		if (v >= 1000000) return 'AED ' + (v/1000000).toFixed(2) + 'M';
		if (v >= 1000) return 'AED ' + Math.round(v/1000) + 'K';
		return 'AED ' + v.toLocaleString('en-AE', {minimumFractionDigits:2, maximumFractionDigits:2});
	}

	function mp_row(label, est, act, unit) {
		var diff = act - est;
		var diff_col = diff >= 0 ? '#15803d' : '#b91c1c';
		var diff_str = (diff >= 0 ? '+' : '') + Math.round(diff) + unit;
		return '<tr>' +
			'<td style="font-size:12px;font-weight:600;color:#0f172a">' + label + '</td>' +
			'<td style="text-align:right;font-size:12px;font-weight:700;color:#7c3aed">' + Math.round(est) + unit + '</td>' +
			'<td style="text-align:right;font-size:12px;font-weight:700;color:#0d9488">' + Math.round(act) + unit + '</td>' +
			'<td style="text-align:right;font-size:12px;font-weight:700;color:' + diff_col + '">' + diff_str + '</td>' +
			'</tr>';
	}

	function render(d) {
		var info = d.project_info || {};
		var plan = d.plan || {};
		var has_plan = d.has_plan || false;
		var mp = d.manpower || {};
		var po = d.purchase_orders || {};
		var pot = d.po_by_type || {};

		var dur = plan.project_duration || 0;
		var passed = plan.days_passed || 0;
		var tl_pct = dur > 0 ? Math.min(Math.round(passed / dur * 100), 100) : 0;

		var html = '';

		// --- Project Header ---
		html += '<div class="proj-hdr">';
		html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">';
		html += '<div>';
		html += '<div class="proj-name">' + (info.project_name || '') + '</div>';
		html += '<div class="proj-meta">Customer: ' + (info.customer || '—') + '</div>';
		html += '<div class="badges">' + badge(info.status || '', 'bb') + (has_plan ? tl_badge(plan.timeline_status || 'On Track') : '') + '</div>';
		html += '</div>';
		if (has_plan && plan.start_date) {
			html += '<div style="text-align:right;font-size:12px">';
			html += '<div style="color:#64748b;margin-bottom:4px">' + plan.start_date + ' → ' + plan.end_date + '</div>';
			html += '<div style="color:#475569"><b style="color:#0f172a">' + passed + '</b> passed &nbsp;·&nbsp; <b style="color:#0f172a">' + (plan.days_remaining||0) + '</b> remaining &nbsp;·&nbsp; <b style="color:#0f172a">' + dur + '</b> total days</div>';
			html += '</div>';
		}
		html += '</div>';
		if (has_plan && plan.start_date) {
			html += '<div class="tl-bar" style="margin-top:12px"><div class="tl-fill" style="width:' + tl_pct + '%"></div></div>';
			html += '<div style="font-size:10px;color:#94a3b8;margin-top:3px;text-align:right">' + tl_pct + '% of project timeline elapsed</div>';
		}
		html += '</div>';

		// --- Financial Cards ---
		html += '<div class="k4">';
		html += kc('Contract Value', fmt(has_plan ? plan.boq_grand_total : 0), 'BOQ incl. VAT & markup', '#2563eb');
		html += kc('Project Budget', fmt(has_plan ? plan.total_project_cost : 0), 'Adjusted cost + overhead', '#7c3aed');
		html += kc('Total Spent', fmt(d.total_spent || 0), 'POs + expense claims', '#0d9488');
		html += kc('Remaining', fmt((has_plan ? plan.total_project_cost : 0) - (d.total_spent || 0)), 'Budget minus spent', '#d97706');
		html += '</div>';

		// --- Row: Manpower + PO ---
		html += '<div class="g2">';

		// Manpower - Estimated vs Actual + Cost
		var est_w = (has_plan && plan.est_working_hrs) ? plan.est_working_hrs : 0;
		var est_ot = (has_plan && plan.est_ot_hrs) ? plan.est_ot_hrs : 0;
		var est_tot = (has_plan && plan.est_total_hrs) ? plan.est_total_hrs : 0;
		var est_wkrs = (has_plan && plan.est_workers) ? plan.est_workers : 0;
		var act_w = mp.actual_working_hours || 0;
		var act_ot = mp.actual_ot_hours || 0;
		var act_tot = mp.actual_manhours || 0;
		var act_wkrs = mp.actual_workers || 0;

		html += '<div class="card">';
		html += '<div class="ch"><div class="ci ci-b">👷</div><div><div class="ct">Manpower & Hours</div><div class="cs">Estimated vs actual progress</div></div></div>';

		// Comparison table
		html += '<table style="margin-bottom:14px">';
		html += '<thead><tr><th></th><th style="text-align:right;color:#7c3aed">Estimated</th><th style="text-align:right;color:#0d9488">Actual</th><th style="text-align:right;color:#64748b">Variance</th></tr></thead>';
		html += '<tbody>';
		html += mp_row('Workers', est_wkrs, act_wkrs, '');
		html += mp_row('Working Hrs', est_w, act_w, ' hrs');
		html += mp_row('OT Hrs', est_ot, act_ot, ' hrs');
		html += mp_row('Total Hrs', est_tot, act_tot, ' hrs');
		html += '</tbody></table>';

		// Labour cost breakdown
		html += '<div style="background:#f8fafc;border-radius:8px;padding:12px;border:1px solid #e2e8f0">';
		html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#64748b;margin-bottom:10px">Labour Cost</div>';
		html += sr('Working cost (' + act_w + ' hrs × rate)', fmtAED(mp.total_working_cost || 0));
		html += sr('OT cost (' + act_ot + ' hrs × AED 5)', fmtAED(mp.total_ot_cost || 0), 'sv-o');
		html += '<div style="border-top:2px solid #e2e8f0;margin-top:6px;padding-top:8px;display:flex;justify-content:space-between">';
		html += '<span style="font-size:13px;font-weight:700;color:#0f172a">Total Labour Cost</span>';
		html += '<span style="font-size:14px;font-weight:800;color:#2563eb">' + fmtAED(mp.total_labour_cost || 0) + '</span>';
		html += '</div>';
		html += '<div style="font-size:10px;color:#94a3b8;margin-top:6px">Rate: monthly salary ÷ 30 days ÷ 8 hrs &nbsp;|&nbsp; OT: AED 5/hr fixed</div>';
		html += '</div>';
		html += '</div>';

		// POs with breakdown by type
		html += '<div class="card"><div class="ch"><div class="ci ci-p">🛒</div><div><div class="ct">Purchase Orders</div><div class="cs">Submitted POs — breakdown by type</div></div></div>';
		html += sr('Total POs raised', po.total_pos || 0);
		html += sr('Total suppliers', po.total_suppliers || 0);
		html += sr('Total PO value', fmt(po.total_value));
		html += sr('Amount received', fmt(po.total_received), 'sv-g');
		html += sr('Amount pending', fmt(po.total_pending), 'sv-r');
		// Breakdown by order type
		if (pot.Joinery) html += sr('↳ Joinery (Material)', fmt(pot.Joinery.total_value), 'sv-b');
		if (pot.Fitout) html += sr('↳ Fitout (Subcontractor)', fmt(pot.Fitout.total_value), 'sv-b');
		if (pot.Logistics) html += sr('↳ Logistics', fmt(pot.Logistics.total_value), 'sv-b');
		html += sr('Expense claims', fmt(d.total_expenses || 0));
		html += '</div></div>';

		// --- Row: Phases + Department Budget ---
		html += '<div class="g2">';

		// Phases
		if (has_plan && plan.phases && plan.phases.length) {
			html += '<div class="card"><div class="ch"><div class="ci ci-t">📋</div><div><div class="ct">Project Phases</div><div class="cs">Progress per phase</div></div></div>';
			plan.phases.forEach(function(s) {
				html += '<div class="pr"><div class="pl">';
				html += '<span class="pn">' + s.phase_name + ' ' + phase_badge(s.status) + '</span>';
				html += '<span class="pm">' + (s.start_date||'') + ' → ' + (s.end_date||'') + ' &nbsp;<b style="color:#0f172a">' + (s.progress||0) + '%</b></span>';
				html += '</div><div class="pbar"><div class="pfill" style="width:' + (s.progress||0) + '%;background:' + phase_color(s.status) + '"></div></div></div>';
			});
			html += '</div>';
		} else {
			html += '<div class="card"><div class="ch"><div class="ci ci-t">📋</div><div><div class="ct">Project Phases</div><div class="cs">No phases added</div></div></div><div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">No phases in project plan</div></div>';
		}

		// Department Budget
		if (has_plan && plan.department_budgets && plan.department_budgets.length) {
			html += '<div class="card"><div class="ch"><div class="ci ci-p">💼</div><div><div class="ct">Department Budget</div><div class="cs">Allocated budget vs actual spent</div></div></div>';
			plan.department_budgets.forEach(function(dep) {
				var bamt = dep.budget_amount || 0;
				var spent = dep.spent_amount || 0;
				var pct = bamt > 0 ? Math.min(Math.round(spent / bamt * 100), 100) : 0;
				var over = bamt > 0 && spent > bamt;
				var bar_col = dep.status === 'Exceeded' ? '#dc2626' : dep.status === 'Warning' ? '#d97706' : '#15803d';
				var pct_col = dep.status === 'Exceeded' ? '#b91c1c' : dep.status === 'Warning' ? '#c2410c' : '#15803d';
				var src = dep.po_order_type ? '(' + dep.po_order_type + ')' : '(Manual)';
				html += '<div class="dr">';
				html += '<div class="dt"><span class="dn">' + dep.department_name + ' <span class="da">' + dep.allocation_percent + '%</span></span>';
				html += '<span style="font-size:12px;font-weight:700;color:' + pct_col + '">' + (over ? '⚠️ ' : '') + pct + '% used</span></div>';
				html += '<div class="dbar"><div class="dfill" style="width:' + pct + '%;background:' + bar_col + '"></div></div>';
				html += '<div class="dsub"><span style="color:#64748b">Spent: <b style="color:#0f172a">' + fmt(spent) + '</b> ' + src + '</span><span style="color:#64748b">Budget: <b style="color:#0f172a">' + fmt(bamt) + '</b></span></div>';
				html += '</div>';
			});
			html += '</div>';
		} else {
			html += '<div class="card"><div class="ch"><div class="ci ci-p">💼</div><div><div class="ct">Department Budget</div><div class="cs">No budgets set</div></div></div><div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">No department budgets in project plan</div></div>';
		}
		html += '</div>';

		// --- Row: Subcontractors + Weekly Reports ---
		html += '<div class="g2">';

		// Subcontractors
		if (has_plan && plan.subcontractors && plan.subcontractors.length) {
			html += '<div class="card"><div class="ch"><div class="ci ci-a">🏗️</div><div><div class="ct">Subcontractors (' + plan.subcontractors.length + ')</div><div class="cs">Allocated per project plan</div></div></div>';
			html += '<table><thead><tr><th>Supplier</th><th>Scope</th><th>Value</th><th>Status</th></tr></thead><tbody>';
			plan.subcontractors.forEach(function(s) {
				var bc = s.status === 'Active' ? 'bg' : s.status === 'Completed' ? 'bb' : 'bo';
				html += '<tr><td><b>' + (s.supplier_name||'') + '</b></td><td style="color:#64748b">' + (s.scope_of_work||'—') + '</td><td><b>' + fmt(s.contract_value) + '</b></td><td>' + badge(s.status, bc) + '</td></tr>';
			});
			html += '</tbody></table></div>';
		} else {
			html += '<div class="card"><div class="ch"><div class="ci ci-a">🏗️</div><div><div class="ct">Subcontractors</div><div class="cs">None added</div></div></div><div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">No subcontractors in project plan</div></div>';
		}

		// Weekly Reports
		html += '<div class="card"><div class="ch"><div class="ci ci-g">📅</div><div><div class="ct">Weekly Reports</div><div class="cs">Client report submission status</div></div></div>';
		if (d.weekly_reports && d.weekly_reports.length) {
			html += '<table><thead><tr><th>Week</th><th>Date</th><th>File</th><th>Client</th></tr></thead><tbody>';
			d.weekly_reports.forEach(function(r) {
				html += '<tr><td><b>Week ' + (r.week_number||'') + '</b></td><td style="color:#64748b">' + (r.report_date||'') + '</td>';
				html += '<td>' + (r.report_file ? '<a href="' + r.report_file + '" target="_blank" style="color:#2563eb">Download</a>' : '<span style="color:#94a3b8">—</span>') + '</td>';
				html += '<td>' + (r.sent_to_client ? badge('Sent','bg') : badge('Pending','ba')) + '</td></tr>';
			});
			html += '</tbody></table>';
		} else {
			html += '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">No weekly reports added yet</div>';
		}
		html += '</div></div>';

		// Labour Plan (full width)
		if (has_plan && plan.labour_plan && plan.labour_plan.length) {
			html += '<div class="card" style="margin-top:0"><div class="ch"><div class="ci ci-b">👷</div><div><div class="ct">Labour Plan (Estimated)</div><div class="cs">Planned workforce breakdown</div></div></div>';
			html += '<table><thead><tr><th>Trade / Role</th><th>Headcount</th><th>Days</th><th>Working Hrs</th><th>OT Hrs</th><th>Total Hrs</th></tr></thead><tbody>';
			plan.labour_plan.forEach(function(l) {
				html += '<tr><td><b>' + l.trade_role + '</b></td><td>' + l.headcount + '</td><td>' + l.estimated_days + '</td><td>' + (l.estimated_working_hours||0) + '</td><td>' + (l.estimated_ot_hours||0) + '</td><td><b>' + (l.estimated_total_hours||0) + '</b></td></tr>';
			});
			html += '</tbody></table></div>';
		}

		document.getElementById('pd-body').innerHTML = html;
	}
};
