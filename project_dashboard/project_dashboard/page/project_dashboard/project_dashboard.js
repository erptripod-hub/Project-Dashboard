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

	if (!document.getElementById('pd-style')) {
		var s = document.createElement('style');
		s.id = 'pd-style';
		s.textContent =
			'.pd{padding:16px;background:#f0f4f8;min-height:100vh;margin:-15px}' +
			'.pd .hdr{background:#0f1623;border-radius:10px;padding:16px 22px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px}' +
			'.pd .hdr h2{font-size:16px;font-weight:800;color:#fff;margin:0}.pd .hdr h2 span{color:#60a5fa}' +
			'.pd .hdr p{font-size:11px;color:#94a3b8;margin-top:2px}' +
			'.pd .proj-hdr{background:#fff;border-radius:10px;padding:16px 20px;margin-bottom:14px;border:1px solid #e2e8f0;border-left:5px solid #2563eb}' +
			'.pd .k4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}' +
			'.pd .kc{background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #e2e8f0;border-top:4px solid #2563eb}' +
			'.pd .kc .t{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#64748b;font-weight:600;margin-bottom:6px}' +
			'.pd .kc .v{font-size:20px;font-weight:800;color:#0f172a}.pd .kc .s{font-size:10px;color:#94a3b8;margin-top:4px}' +
			'.pd .g2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;align-items:start}' +
			'.pd .card{background:#fff;border-radius:10px;padding:16px;border:1px solid #e2e8f0;margin-bottom:12px}' +
			'.pd .ch{display:flex;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #f1f5f9}' +
			'.pd .ci{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}' +
			'.pd .ci-b{background:#dbeafe}.pd .ci-p{background:#ede9fe}.pd .ci-t{background:#ccfbf1}.pd .ci-a{background:#fff7ed}.pd .ci-g{background:#dcfce7}' +
			'.pd .ct{font-size:13px;font-weight:700;color:#0f172a}.pd .cs{font-size:11px;color:#94a3b8}' +
			'.pd .sr{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f8fafc;font-size:12px}' +
			'.pd .sr:last-child{border-bottom:none}.pd .sl{color:#64748b}.pd .sv{font-weight:700;color:#0f172a}' +
			'.pd .sv-g{color:#15803d}.pd .sv-r{color:#b91c1c}.pd .sv-o{color:#c2410c}.pd .sv-b{color:#1d4ed8}' +
			'.pd .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600}' +
			'.pd .bg{background:#dcfce7;color:#15803d}.pd .bb{background:#dbeafe;color:#1d4ed8}' +
			'.pd .bo{background:#fff7ed;color:#c2410c}.pd .br{background:#fee2e2;color:#b91c1c}' +
			'.pd .bgr{background:#f1f5f9;color:#475569}.pd .bd{background:#1e293b;color:#f1f5f9}.pd .ba{background:#fef3c7;color:#92400e}' +
			'.pd .tl-bar{background:#e2e8f0;border-radius:6px;height:10px;overflow:hidden;margin-top:8px}' +
			'.pd .tl-fill{height:10px;border-radius:6px;background:#2563eb}' +
			'.pd .pbar{background:#f1f5f9;border-radius:5px;height:8px;overflow:hidden}' +
			'.pd .pfill{height:8px;border-radius:5px}' +
			'.pd .dbar{background:#f1f5f9;border-radius:5px;height:10px;overflow:hidden}' +
			'.pd .dfill{height:10px;border-radius:5px}' +
			'.pd table{width:100%;border-collapse:collapse}' +
			'.pd th{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;font-weight:600;padding:6px 8px;text-align:left;border-bottom:2px solid #f1f5f9}' +
			'.pd td{font-size:12px;padding:8px;border-bottom:1px solid #f8fafc;color:#0f172a}' +
			'.pd tr:last-child td{border-bottom:none}' +
			'.pd .cost-box{background:#f8fafc;border-radius:8px;padding:12px;border:1px solid #e2e8f0;margin-top:12px}' +
			'.pd .cost-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#64748b;margin-bottom:8px}';
		document.head.appendChild(s);
	}

	$(wrapper).find('.page-content').html(
		'<div class="pd">' +
		'<div class="hdr">' +
		'<div><h2>TRIPOD MENA | <span>Project Dashboard</span></h2><p>Select a project to view live data</p></div>' +
		'<div><input id="pd-inp" list="pd-dl" placeholder="Type project name or number..." autocomplete="off" style="background:#1e2a3b;border:1px solid #334155;color:#e2e8f0;padding:8px 14px;border-radius:8px;font-size:12px;min-width:280px;outline:none"><datalist id="pd-dl"></datalist></div>' +
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
		window._pd_map = {};
		projects.forEach(function(p) {
			var opt = document.createElement('option');
			var label = p.name + ' — ' + p.project_name;
			opt.value = label;
			dl.appendChild(opt);
			window._pd_map[label] = p.name;
		});
	});

	document.getElementById('pd-inp').addEventListener('change', function() {
		var val = this.value;
		var map = window._pd_map || {};
		if (map[val]) {
			cur_project = map[val];
			load_dashboard(cur_project);
		}
	});

	function load_dashboard(project) {
		document.getElementById('pd-body').innerHTML = '<div style="text-align:center;padding:60px;color:#64748b">Loading...</div>';
		frappe.call({
			method: 'project_dashboard.project_dashboard.page.project_dashboard.project_dashboard.get_dashboard_data',
			args: {project: project},
			callback: function(r) {
				if (r.message) render(r.message);
				else document.getElementById('pd-body').innerHTML = '<div style="text-align:center;padding:40px;color:#dc2626">Error loading. Check error log.</div>';
			}
		});
	}

	function fmt(v) {
		v = parseFloat(v) || 0;
		if (v >= 1000000) return 'AED ' + (v/1000000).toFixed(2) + 'M';
		if (v >= 1000) return 'AED ' + Math.round(v/1000) + 'K';
		return 'AED ' + v.toLocaleString('en-AE', {minimumFractionDigits:2, maximumFractionDigits:2});
	}

	function sr(label, value, cls) {
		return '<div class="sr"><span class="sl">' + label + '</span><span class="sv' + (cls ? ' '+cls : '') + '">' + value + '</span></div>';
	}

	function kc(title, value, sub, color) {
		return '<div class="kc" style="border-top-color:' + color + '"><div class="t">' + title + '</div><div class="v">' + value + '</div><div class="s">' + sub + '</div></div>';
	}

	function badge(text, cls) {
		return '<span class="badge ' + cls + '">' + text + '</span>';
	}

	function phase_color(status) {
		return {'Completed':'#15803d','In Progress':'#2563eb','Delayed':'#dc2626','On Hold':'#d97706','Not Started':'#94a3b8'}[status] || '#94a3b8';
	}

	function phase_badge(status) {
		return badge(status, {'Completed':'bg','In Progress':'bb','Delayed':'br','On Hold':'ba','Not Started':'bgr'}[status] || 'bgr');
	}

	function tl_badge(status) {
		return badge(status, {'On Track':'bg','Attention':'ba','Warning':'bo','Critical':'br','Overdue':'bd'}[status] || 'bb');
	}

	function mp_row(label, est, act, unit) {
		var diff = act - est;
		var col = diff >= 0 ? '#15803d' : '#b91c1c';
		return '<tr>' +
			'<td style="font-size:12px;font-weight:600;color:#0f172a">' + label + '</td>' +
			'<td style="text-align:right;font-size:12px;font-weight:700;color:#7c3aed">' + Math.round(est) + unit + '</td>' +
			'<td style="text-align:right;font-size:12px;font-weight:700;color:#0d9488">' + Math.round(act) + unit + '</td>' +
			'<td style="text-align:right;font-size:12px;font-weight:700;color:' + col + '">' + (diff >= 0 ? '+' : '') + Math.round(diff) + unit + '</td>' +
			'</tr>';
	}

	function render(d) {
		var info = d.project_info || {};
		var plan = d.plan || {};
		var hp = d.has_plan || false;
		var mp = d.manpower || {};
		var po = d.purchase_orders || {};
		var pot = d.po_by_type || {};

		var dur = plan.project_duration || 0;
		var tl_pct = dur > 0 ? Math.min(Math.round((plan.days_passed || 0) / dur * 100), 100) : 0;

		var html = '';

		// Project Header
		html += '<div class="proj-hdr">';
		html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">';
		html += '<div>';
		html += '<div style="font-size:17px;font-weight:800;color:#0f172a">' + (info.project_name || '') + '</div>';
		html += '<div style="font-size:12px;color:#64748b;margin-top:3px">Customer: ' + (info.customer || '—') + '</div>';
		html += '<div style="display:flex;gap:6px;margin-top:8px">' + badge(info.status || '', 'bb') + (hp ? tl_badge(plan.timeline_status || 'On Track') : '') + '</div>';
		html += '</div>';
		if (hp && plan.start_date) {
			html += '<div style="text-align:right;font-size:12px">';
			html += '<div style="color:#64748b;margin-bottom:3px">' + plan.start_date + ' → ' + plan.end_date + '</div>';
			html += '<div style="color:#475569"><b style="color:#0f172a">' + (plan.days_passed||0) + '</b> passed &nbsp;·&nbsp; <b style="color:#0f172a">' + (plan.days_remaining||0) + '</b> remaining &nbsp;·&nbsp; <b style="color:#0f172a">' + dur + '</b> total</div>';
			html += '</div>';
		}
		html += '</div>';
		if (hp && plan.start_date) {
			html += '<div class="tl-bar"><div class="tl-fill" style="width:' + tl_pct + '%"></div></div>';
			html += '<div style="font-size:10px;color:#94a3b8;margin-top:3px;text-align:right">' + tl_pct + '% of timeline elapsed</div>';
		}
		html += '</div>';

		// Financial Cards
		html += '<div class="k4">';
		html += kc('Contract Value', fmt(hp ? plan.boq_grand_total : 0), 'BOQ incl. VAT', '#2563eb');
		html += kc('Project Budget', fmt(hp ? plan.total_project_cost : 0), 'Adjusted + overhead', '#7c3aed');
		html += kc('Total Spent', fmt(d.total_spent || 0), 'POs + expenses', '#0d9488');
		html += kc('Remaining', fmt((hp ? plan.total_project_cost : 0) - (d.total_spent || 0)), 'Budget − spent', '#d97706');
		html += '</div>';

		// Row 1: Manpower + PO
		html += '<div class="g2">';

		// Manpower
		var ew = hp ? (plan.est_workers||0) : 0;
		var ewh = hp ? (plan.est_working_hrs||0) : 0;
		var eoh = hp ? (plan.est_ot_hrs||0) : 0;
		var eth = hp ? (plan.est_total_hrs||0) : 0;
		html += '<div class="card">';
		html += '<div class="ch"><div class="ci ci-b">👷</div><div><div class="ct">Manpower & Hours</div><div class="cs">Estimated vs actual</div></div></div>';
		html += '<table style="margin-bottom:12px">';
		html += '<thead><tr><th></th><th style="text-align:right;color:#7c3aed">Estimated</th><th style="text-align:right;color:#0d9488">Actual</th><th style="text-align:right">Variance</th></tr></thead><tbody>';
		html += mp_row('Workers', ew, mp.actual_workers||0, '');
		html += mp_row('Working hrs', ewh, mp.actual_working_hours||0, '');
		html += mp_row('OT hrs', eoh, mp.actual_ot_hours||0, '');
		html += mp_row('Total hrs', eth, mp.actual_manhours||0, '');
		html += '</tbody></table>';
		html += '<div class="cost-box">';
		html += '<div class="cost-lbl">Labour Cost</div>';
		html += sr('Working cost (' + (mp.actual_working_hours||0) + ' hrs × rate)', fmt(mp.total_working_cost||0));
		html += sr('OT cost (' + (mp.actual_ot_hours||0) + ' hrs × AED 5)', fmt(mp.total_ot_cost||0), 'sv-o');
		html += '<div style="border-top:1px solid #e2e8f0;margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;align-items:center">';
		html += '<span style="font-size:13px;font-weight:700;color:#0f172a">Total Labour Cost</span>';
		html += '<span style="font-size:14px;font-weight:800;color:#2563eb">' + fmt(mp.total_labour_cost||0) + '</span>';
		html += '</div>';
		html += '<div style="font-size:10px;color:#94a3b8;margin-top:4px">Salary ÷ 30 ÷ 8 = hourly rate &nbsp;·&nbsp; OT: AED 5/hr</div>';
		html += '</div></div>';

		// Purchase Orders
		html += '<div class="card">';
		html += '<div class="ch"><div class="ci ci-p">🛒</div><div><div class="ct">Purchase Orders</div><div class="cs">Submitted POs by type</div></div></div>';
		html += sr('Total POs', po.total_pos||0);
		html += sr('Total suppliers', po.total_suppliers||0);
		html += sr('Total PO value', fmt(po.total_value));
		html += sr('Amount received', fmt(po.total_received), 'sv-g');
		html += sr('Amount pending', fmt(po.total_pending), 'sv-r');
		if (pot.Joinery) html += sr('↳ Joinery (Material)', fmt(pot.Joinery.total_value), 'sv-b');
		if (pot.Fitout) html += sr('↳ Fitout (Subcontractor)', fmt(pot.Fitout.total_value), 'sv-b');
		if (pot.Logistics) html += sr('↳ Logistics', fmt(pot.Logistics.total_value), 'sv-b');
		html += sr('Expense claims', fmt(d.total_expenses||0));
		html += '</div>';
		html += '</div>';

		// Row 2: Phases + Dept Budget
		html += '<div class="g2">';

		// Phases
		html += '<div class="card">';
		html += '<div class="ch"><div class="ci ci-t">📋</div><div><div class="ct">Project Phases</div><div class="cs">Progress per phase</div></div></div>';
		if (hp && plan.phases && plan.phases.length) {
			plan.phases.forEach(function(s) {
				html += '<div style="margin-bottom:10px">';
				html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
				html += '<span style="font-size:12px;font-weight:600;color:#0f172a;display:flex;align-items:center;gap:6px">' + s.phase_name + ' ' + phase_badge(s.status) + '</span>';
				html += '<span style="font-size:11px;color:#64748b">' + (s.start_date||'') + ' → ' + (s.end_date||'') + ' <b style="color:#0f172a">' + (s.progress||0) + '%</b></span>';
				html += '</div>';
				html += '<div class="pbar"><div class="pfill" style="width:' + (s.progress||0) + '%;background:' + phase_color(s.status) + '"></div></div>';
				html += '</div>';
			});
		} else {
			html += '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">No phases added</div>';
		}
		html += '</div>';

		// Dept Budget
		html += '<div class="card">';
		html += '<div class="ch"><div class="ci ci-p">💼</div><div><div class="ct">Department Budget</div><div class="cs">Spent vs allocated</div></div></div>';
		if (hp && plan.department_budgets && plan.department_budgets.length) {
			plan.department_budgets.forEach(function(dep) {
				var bamt = dep.budget_amount || 0;
				var spent = dep.spent_amount || 0;
				var pct = bamt > 0 ? Math.min(Math.round(spent/bamt*100), 100) : 0;
				var over = bamt > 0 && spent > bamt;
				var col = dep.status === 'Exceeded' ? '#dc2626' : dep.status === 'Warning' ? '#d97706' : '#15803d';
				var dtype = dep.department_type || '';
				var src = dtype === 'Design' ? 'Hrs × Rate' :
						 dtype === 'Production' ? 'Labour + Overhead' :
						 dep.po_order_type ? dep.po_order_type : 'Manual';
				html += '<div style="margin-bottom:14px">';
				html += '<div style="display:flex;justify-content:space-between;margin-bottom:3px">';
				html += '<span style="font-size:12px;font-weight:600;color:#0f172a">' + dep.department_name + ' <span style="font-weight:400;color:#94a3b8;font-size:11px">(' + dep.allocation_percent + '%)</span></span>';
				html += '<span style="font-size:12px;font-weight:700;color:' + col + '">' + (over ? '⚠ ' : '') + pct + '% used</span>';
				html += '</div>';
				html += '<div class="dbar"><div class="dfill" style="width:' + pct + '%;background:' + col + '"></div></div>';
				html += '<div style="display:flex;justify-content:space-between;font-size:11px;margin-top:3px">';
				html += '<span style="color:#64748b">Spent: <b style="color:#0f172a">' + fmt(spent) + '</b> <span style="color:#94a3b8">(' + src + ')</span></span>';
				html += '<span style="color:#64748b">Budget: <b style="color:#0f172a">' + fmt(bamt) + '</b></span>';
				html += '</div>';
				if (dtype === 'Design' && (dep.estimated_hours || dep.actual_hours)) {
					html += '<div style="font-size:11px;color:#94a3b8;margin-top:2px">Est: <b style="color:#7c3aed">' + (dep.estimated_hours||0) + ' hrs</b> &nbsp;·&nbsp; Actual: <b style="color:#0d9488">' + (dep.actual_hours||0) + ' hrs</b></div>';
				}
				html += '</div>';
			});
		} else {
			html += '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">No budgets set</div>';
		}
		html += '</div>';
		html += '</div>';

		// Row 3: Subcontractors + Weekly Reports
		html += '<div class="g2">';

		// Subcontractors
		html += '<div class="card">';
		html += '<div class="ch"><div class="ci ci-a">🏗️</div><div><div class="ct">Subcontractors' + (hp && plan.subcontractors ? ' (' + plan.subcontractors.length + ')' : '') + '</div><div class="cs">Per project plan</div></div></div>';
		if (hp && plan.subcontractors && plan.subcontractors.length) {
			html += '<table><thead><tr><th>Supplier</th><th>Scope</th><th>Value</th><th>Status</th></tr></thead><tbody>';
			plan.subcontractors.forEach(function(s) {
				html += '<tr><td><b>' + (s.supplier_name||'') + '</b></td><td style="color:#64748b">' + (s.scope_of_work||'—') + '</td><td><b>' + fmt(s.contract_value) + '</b></td><td>' + badge(s.status, s.status==='Active'?'bg':s.status==='Completed'?'bb':'bo') + '</td></tr>';
			});
			html += '</tbody></table>';
		} else {
			html += '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">None added</div>';
		}
		html += '</div>';

		// Weekly Reports
		html += '<div class="card">';
		html += '<div class="ch"><div class="ci ci-g">📅</div><div><div class="ct">Weekly Reports</div><div class="cs">Client submission status</div></div></div>';
		if (d.weekly_reports && d.weekly_reports.length) {
			html += '<table><thead><tr><th>Week</th><th>Date</th><th>File</th><th>Client</th></tr></thead><tbody>';
			d.weekly_reports.forEach(function(r) {
				html += '<tr><td><b>Week ' + (r.week_number||'') + '</b></td><td style="color:#64748b">' + (r.report_date||'') + '</td>';
				html += '<td>' + (r.report_file ? '<a href="' + r.report_file + '" target="_blank" style="color:#2563eb">Download</a>' : '<span style="color:#94a3b8">—</span>') + '</td>';
				html += '<td>' + badge(r.sent_to_client ? 'Sent' : 'Pending', r.sent_to_client ? 'bg' : 'ba') + '</td></tr>';
			});
			html += '</tbody></table>';
		} else {
			html += '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">No reports yet</div>';
		}
		html += '</div>';
		html += '</div>';

		// Suppliers - full width
		var supp = (hp && plan.suppliers) ? plan.suppliers : [];
		html += '<div class="card">';
		html += '<div class="ch"><div class="ci ci-t">🏪</div><div><div class="ct">Suppliers' + (supp.length ? ' (' + supp.length + ')' : '') + '</div><div class="cs">Material suppliers per project plan</div></div></div>';
		if (supp.length) {
			html += '<table><thead><tr><th>Supplier</th><th>Scope</th><th>Value</th><th>Status</th></tr></thead><tbody>';
			supp.forEach(function(s) {
				var bc = s.status === 'Active' ? 'bg' : s.status === 'Completed' ? 'bb' : 'bo';
				html += '<tr><td><b>' + (s.supplier_name||'') + '</b></td><td style="color:#64748b">' + (s.scope_of_work||'—') + '</td><td><b>' + fmt(s.contract_value) + '</b></td><td>' + badge(s.status, bc) + '</td></tr>';
			});
			html += '</tbody></table>';
		} else {
			html += '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">No suppliers added</div>';
		}
		html += '</div>';

		// Labour Plan (full width)
		if (hp && plan.labour_plan && plan.labour_plan.length) {
			html += '<div class="card">';
			html += '<div class="ch"><div class="ci ci-b">📊</div><div><div class="ct">Labour Plan (Estimated)</div><div class="cs">Planned workforce</div></div></div>';
			html += '<table><thead><tr><th>Trade / Role</th><th>Headcount</th><th>Days</th><th>Working Hrs</th><th>OT Hrs</th><th>Total Hrs</th></tr></thead><tbody>';
			plan.labour_plan.forEach(function(l) {
				html += '<tr><td><b>' + l.trade_role + '</b></td><td>' + l.headcount + '</td><td>' + l.estimated_days + '</td><td>' + (l.estimated_working_hours||0) + '</td><td>' + (l.estimated_ot_hours||0) + '</td><td><b>' + (l.estimated_total_hours||0) + '</b></td></tr>';
			});
			html += '</tbody></table></div>';
		}

		// Joinery Material Tracking - full width
		var jt = d.joinery_tracking || [];
		var jtot = d.joinery_totals || {};
		html += '<div class="card">';
		html += '<div class="ch"><div class="ci ci-b">📦</div><div><div class="ct">Joinery — Material Ordered vs Issued</div><div class="cs">Joinery POs vs Stock Entries (Material Issue)</div></div></div>';
		if (jt.length) {
			html += '<div style="overflow-x:auto">';
			html += '<table><thead><tr>';
			html += '<th>Item</th><th>UOM</th>';
			html += '<th style="text-align:right;color:#1d4ed8">Ordered Qty</th>';
			html += '<th style="text-align:right;color:#1d4ed8">Ordered Value</th>';
			html += '<th style="text-align:right;color:#0f6e56">Issued Qty</th>';
			html += '<th style="text-align:right;color:#0f6e56">Issued Value</th>';
			html += '<th style="text-align:right">Variance Qty</th>';
			html += '</tr></thead><tbody>';
			jt.forEach(function(r) {
				var vqty = r.variance_qty || 0;
				var vcol = vqty < 0 ? '#b91c1c' : vqty === 0 ? '#15803d' : '#64748b';
				html += '<tr>';
				html += '<td><b>' + (r.item_name||r.item_code) + '</b><div style="font-size:10px;color:#94a3b8">' + r.item_code + '</div></td>';
				html += '<td style="color:#64748b">' + (r.uom||'') + '</td>';
				html += '<td style="text-align:right;font-weight:600;color:#1d4ed8">' + r.ordered_qty.toFixed(2) + '</td>';
				html += '<td style="text-align:right;font-weight:600;color:#1d4ed8">' + fmt(r.ordered_value) + '</td>';
				html += '<td style="text-align:right;font-weight:600;color:#0f6e56">' + r.issued_qty.toFixed(2) + '</td>';
				html += '<td style="text-align:right;font-weight:600;color:#0f6e56">' + fmt(r.issued_value) + '</td>';
				html += '<td style="text-align:right;font-weight:700;color:' + vcol + '">' + vqty.toFixed(2) + '</td>';
				html += '</tr>';
			});
			html += '<tr style="background:#f8fafc;border-top:2px solid #e2e8f0">';
			html += '<td colspan="3" style="font-weight:700;color:#0f172a">Total</td>';
			html += '<td style="text-align:right;font-weight:800;color:#1d4ed8">' + fmt(jtot.total_ordered_value||0) + '</td>';
			html += '<td></td>';
			html += '<td style="text-align:right;font-weight:800;color:#0f6e56">' + fmt(jtot.total_issued_value||0) + '</td>';
			html += '<td style="text-align:right;font-weight:800;color:#64748b">' + fmt(jtot.total_variance_value||0) + '</td>';
			html += '</tr></tbody></table></div>';
		} else {
			html += '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">No Joinery POs found for this project</div>';
		}
		html += '</div>';

		// Fitout POs - reference only
		var fp = d.fitout_pos || [];
		var ftot = d.fitout_totals || {};
		html += '<div class="card">';
		html += '<div class="ch"><div class="ci ci-a">🔧</div><div><div class="ct">Fitout / Subcontractor POs</div><div class="cs">Service POs — reference only, no stock comparison</div></div></div>';
		if (fp.length) {
			html += '<table><thead><tr>';
			html += '<th>Supplier</th><th>PO No.</th><th>Date</th>';
			html += '<th style="text-align:right;color:#1d4ed8">PO Value</th>';
			html += '<th style="text-align:right;color:#0f6e56">Received</th>';
			html += '<th style="text-align:right;color:#b91c1c">Pending</th>';
			html += '</tr></thead><tbody>';
			fp.forEach(function(r) {
				html += '<tr>';
				html += '<td><b>' + (r.supplier||'') + '</b></td>';
				html += '<td style="color:#64748b;font-size:11px">' + (r.po_name||'') + '</td>';
				html += '<td style="color:#64748b">' + (r.transaction_date||'') + '</td>';
				html += '<td style="text-align:right;font-weight:600;color:#1d4ed8">' + fmt(r.po_value) + '</td>';
				html += '<td style="text-align:right;font-weight:600;color:#0f6e56">' + fmt(r.received) + '</td>';
				html += '<td style="text-align:right;font-weight:600;color:#b91c1c">' + fmt(r.pending) + '</td>';
				html += '</tr>';
			});
			html += '<tr style="background:#f8fafc;border-top:2px solid #e2e8f0">';
			html += '<td colspan="3" style="font-weight:700;color:#0f172a">Total</td>';
			html += '<td style="text-align:right;font-weight:800;color:#1d4ed8">' + fmt(ftot.total_value||0) + '</td>';
			html += '<td style="text-align:right;font-weight:800;color:#0f6e56">' + fmt(ftot.total_received||0) + '</td>';
			html += '<td style="text-align:right;font-weight:800;color:#b91c1c">' + fmt(ftot.total_pending||0) + '</td>';
			html += '</tr></tbody></table>';
		} else {
			html += '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">No Fitout POs found for this project</div>';
		}
		html += '</div>';

		document.getElementById('pd-body').innerHTML = html;
	}
};
