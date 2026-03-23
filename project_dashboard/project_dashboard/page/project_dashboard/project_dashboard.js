frappe.pages['project-dashboard'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Project Dashboard',
		single_column: true
	});

	page.add_inner_button('Refresh', function() { render_dummy(); });

	$('<style>').text(
		'.pd{padding:20px;background:#f0f4f8;min-height:100vh}' +
		'.pd .hdr{background:#0f1623;border-radius:8px;padding:16px 22px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px}' +
		'.pd .hdr h2{font-size:16px;font-weight:800;color:#fff;margin:0}' +
		'.pd .hdr h2 span{color:#60a5fa}' +
		'.pd .hdr p{font-size:11px;color:#94a3b8;margin-top:3px}' +
		'.pd .hdr-r select{background:#1e2a3b;border:1px solid #2d3748;color:#e2e8f0;padding:6px 10px;border-radius:6px;font-size:12px}' +
		'.pd .sec{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin:18px 0 10px 0}' +
		'.pd .krow{display:grid;gap:12px;margin-bottom:16px}' +
		'.pd .k4{grid-template-columns:repeat(4,1fr)}' +
		'.pd .k3{grid-template-columns:repeat(3,1fr)}' +
		'.pd .k2{grid-template-columns:repeat(2,1fr)}' +
		'.pd .kc{background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.08);border-top:4px solid #2563eb}' +
		'.pd .kc .t{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;margin-bottom:8px}' +
		'.pd .kc .v{font-size:24px;font-weight:800;color:#1e293b;line-height:1}' +
		'.pd .kc .s{font-size:10px;color:#64748b;margin-top:5px}' +
		'.pd .pn{background:#fff;border-radius:8px;padding:18px;box-shadow:0 1px 3px rgba(0,0,0,0.08);margin-bottom:0}' +
		'.pd .pt{font-size:13px;font-weight:700;color:#1e293b;margin-bottom:3px}' +
		'.pd .ps{font-size:11px;color:#64748b;margin-bottom:14px}' +
		'.pd .g2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px}' +
		'.pd .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:16px}' +
		'.pd .dv{height:1px;background:#e2e8f0;margin:12px 0}' +
		'.pd .badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600}' +
		'.pd .badge.green{background:#f0fdf4;color:#16a34a}' +
		'.pd .badge.blue{background:#eff6ff;color:#2563eb}' +
		'.pd .badge.orange{background:#fffbeb;color:#d97706}' +
		'.pd .badge.red{background:#fef2f2;color:#dc2626}' +
		'.pd .badge.gray{background:#f8fafc;color:#64748b}' +
		'.pd .prog-row{margin-bottom:14px}' +
		'.pd .prog-label{display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px}' +
		'.pd .prog-label span:first-child{font-weight:600;color:#1e293b}' +
		'.pd .prog-label span:last-child{color:#64748b}' +
		'.pd .prog-track{background:#f1f5f9;border-radius:5px;height:10px}' +
		'.pd .prog-fill{height:10px;border-radius:5px}' +
		'.pd .prog-meta{font-size:10px;color:#64748b;margin-top:3px}' +
		'.pd table{width:100%;border-collapse:collapse}' +
		'.pd th{font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;font-weight:600;padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0}' +
		'.pd td{font-size:12px;padding:9px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle;color:#1e293b}' +
		'.pd tr:last-child td{border-bottom:none}' +
		'.pd tr:hover td{background:#f8fafc}' +
		'.pd .stat-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:12px}' +
		'.pd .stat-row:last-child{border-bottom:none}' +
		'.pd .stat-row .lbl{color:#64748b}' +
		'.pd .stat-row .val{font-weight:700;color:#1e293b}' +
		'.pd .stat-row .val.red{color:#dc2626}' +
		'.pd .stat-row .val.green{color:#16a34a}'
	).appendTo('head');

	$(wrapper).find('.page-content').html(
		'<div class="pd">' +
		'<div class="hdr">' +
		'<div><h2>TRIPOD MENA | <span>Project Dashboard</span></h2><p>Select a project to view full details</p></div>' +
		'<div class="hdr-r"><select id="pd-proj"><option value="">-- Select Project --</option></select></div>' +
		'</div>' +
		'<div id="pd-body"><div style="text-align:center;padding:60px;color:#64748b;font-size:14px;">Select a project from the dropdown above to load dashboard</div></div>' +
		'</div>'
	);

	// Load project list
	frappe.db.get_list('Project', {fields: ['name','project_name'], limit: 200, filters: {status: ['!=','Cancelled']}}).then(function(projects) {
		var sel = document.getElementById('pd-proj');
		projects.forEach(function(p) {
			var opt = document.createElement('option');
			opt.value = p.name;
			opt.textContent = p.name + ' — ' + p.project_name;
			sel.appendChild(opt);
		});
	});

	document.getElementById('pd-proj').addEventListener('change', function() {
		if (this.value) render_dummy(this.value);
	});

	function fmt(v) {
		if (!v) return 'AED 0';
		if (v >= 1000000) return 'AED ' + (v/1000000).toFixed(1) + 'M';
		if (v >= 1000) return 'AED ' + Math.round(v/1000) + 'K';
		return 'AED ' + parseInt(v).toLocaleString();
	}

	function stage_color(status) {
		var map = {'Completed':'#16a34a','In Progress':'#2563eb','Delayed':'#dc2626','On Hold':'#d97706','Not Started':'#94a3b8'};
		return map[status] || '#2563eb';
	}

	function render_dummy(project) {
		// --- DUMMY DATA --- will be replaced with real API calls later
		var d = {
			project_name: 'Service Plan - Dubai Office Renovation',
			project_no: project || 'PROJ-SE-0146',
			customer: 'Al Futtaim Group',
			status: 'Open',
			start_date: '01-Jan-2026',
			end_date: '30-Jun-2026',
			overall_progress: 45,

			manpower: {
				employees: 18,
				working_hours: 1240,
				overtime_hours: 186,
				manhours: 1426
			},

			po: {
				total: 12,
				suppliers: 6,
				value: 450000,
				received: 380000,
				pending: 70000
			},

			invoices: {
				total: 5,
				invoiced: 600000,
				outstanding: 120000,
				expenses: 45000
			},

			plan: [
				{stage: 'Drawing & Design',   start: '01 Jan', end: '15 Feb', progress: 100, status: 'Completed'},
				{stage: 'Material Procurement', start: '10 Feb', end: '28 Feb', progress: 80,  status: 'In Progress'},
				{stage: 'Production',           start: '01 Mar', end: '31 Mar', progress: 50,  status: 'In Progress'},
				{stage: 'Fitout',               start: '01 Apr', end: '30 Apr', progress: 20,  status: 'In Progress'},
				{stage: 'Finishing',            start: '01 May', end: '20 May', progress: 0,   status: 'Not Started'},
				{stage: 'Handover',             start: '21 May', end: '30 Jun', progress: 0,   status: 'Not Started'}
			],

			subcontractors: [
				{name: 'Al Noor MEP', scope: 'Electrical & Plumbing', value: 85000, status: 'Active'},
				{name: 'Gulf Ceiling Works', scope: 'Ceiling & Partition', value: 62000, status: 'Active'},
				{name: 'Emirates Flooring', scope: 'Flooring Works', value: 48000, status: 'Completed'}
			],

			weekly_reports: [
				{week: 12, date: '22 Mar 2026', uploaded: true, sent: true},
				{week: 11, date: '15 Mar 2026', uploaded: true, sent: true},
				{week: 10, date: '08 Mar 2026', uploaded: true, sent: false},
				{week: 9,  date: '01 Mar 2026', uploaded: false, sent: false}
			]
		};

		var html =

		// --- PROJECT HEADER ---
		'<div class="pn" style="margin-bottom:16px;border-left:4px solid #2563eb;">' +
		'<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
		'<div>' +
		'<div style="font-size:18px;font-weight:800;color:#1e293b">' + d.project_no + '</div>' +
		'<div style="font-size:14px;color:#64748b;margin-top:2px">' + d.project_name + '</div>' +
		'<div style="font-size:12px;color:#94a3b8;margin-top:4px">Customer: ' + d.customer + ' &nbsp;|&nbsp; ' + d.start_date + ' → ' + d.end_date + '</div>' +
		'</div>' +
		'<span class="badge blue">' + d.status + '</span>' +
		'</div>' +
		'<div style="margin-top:14px">' +
		'<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="color:#64748b">Overall Progress</span><span style="font-weight:700">' + d.overall_progress + '%</span></div>' +
		'<div class="prog-track"><div class="prog-fill" style="width:' + d.overall_progress + '%;background:#2563eb"></div></div>' +
		'</div>' +
		'</div>' +

		// --- ROW 1: MANPOWER + PO ---
		'<div class="g2">' +

		// Manpower
		'<div class="pn">' +
		'<div class="pt">👷 Manpower & Hours</div><div class="ps">From Project Timesheets</div>' +
		'<div class="stat-row"><span class="lbl">Employees Worked</span><span class="val">' + d.manpower.employees + '</span></div>' +
		'<div class="stat-row"><span class="lbl">Total Working Hours</span><span class="val">' + d.manpower.working_hours + ' hrs</span></div>' +
		'<div class="stat-row"><span class="lbl">Total Overtime Hours</span><span class="val orange" style="color:#d97706">' + d.manpower.overtime_hours + ' hrs</span></div>' +
		'<div class="stat-row"><span class="lbl">Total Manhours</span><span class="val green">' + d.manpower.manhours + ' hrs</span></div>' +
		'<div class="stat-row"><span class="lbl">Manhour Cost</span><span class="val" style="color:#94a3b8">— (to be configured)</span></div>' +
		'</div>' +

		// Purchase Orders
		'<div class="pn">' +
		'<div class="pt">🛒 Purchase Orders & Suppliers</div><div class="ps">From ERPNext Purchase Orders</div>' +
		'<div class="stat-row"><span class="lbl">POs Raised</span><span class="val">' + d.po.total + '</span></div>' +
		'<div class="stat-row"><span class="lbl">Suppliers Involved</span><span class="val">' + d.po.suppliers + '</span></div>' +
		'<div class="stat-row"><span class="lbl">Total PO Value</span><span class="val">' + fmt(d.po.value) + '</span></div>' +
		'<div class="stat-row"><span class="lbl">Amount Received</span><span class="val green">' + fmt(d.po.received) + '</span></div>' +
		'<div class="stat-row"><span class="lbl">Amount Pending</span><span class="val red">' + fmt(d.po.pending) + '</span></div>' +
		'</div>' +
		'</div>' +

		// --- ROW 2: INVOICES + SUBCONTRACTORS ---
		'<div class="g2">' +

		// Invoices
		'<div class="pn">' +
		'<div class="pt">🧾 Invoices & Expenses</div><div class="ps">From ERPNext Sales Invoices & Expenses</div>' +
		'<div class="stat-row"><span class="lbl">Sales Invoices Raised</span><span class="val">' + d.invoices.total + '</span></div>' +
		'<div class="stat-row"><span class="lbl">Total Invoiced</span><span class="val">' + fmt(d.invoices.invoiced) + '</span></div>' +
		'<div class="stat-row"><span class="lbl">Outstanding Amount</span><span class="val red">' + fmt(d.invoices.outstanding) + '</span></div>' +
		'<div class="stat-row"><span class="lbl">Total Expenses</span><span class="val">' + fmt(d.invoices.expenses) + '</span></div>' +
		'</div>' +

		// Subcontractors
		'<div class="pn">' +
		'<div class="pt">🏗️ Subcontractors</div><div class="ps">Vendors working on this project</div>' +
		d.subcontractors.map(function(s) {
			var bc = s.status === 'Active' ? 'green' : s.status === 'Completed' ? 'blue' : 'gray';
			return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9">' +
				'<div><div style="font-size:12px;font-weight:600;color:#1e293b">' + s.name + '</div><div style="font-size:11px;color:#64748b">' + s.scope + '</div></div>' +
				'<div style="text-align:right"><div style="font-size:12px;font-weight:700">' + fmt(s.value) + '</div><span class="badge ' + bc + '">' + s.status + '</span></div>' +
				'</div>';
		}).join('') +
		'</div>' +
		'</div>' +

		// --- PROJECT PLAN ---
		'<div class="pn" style="margin-bottom:16px">' +
		'<div class="pt">📋 Project Plan & Stages</div><div class="ps">Progress per stage</div>' +
		d.plan.map(function(s) {
			var col = stage_color(s.status);
			var bc = s.status === 'Completed' ? 'green' : s.status === 'In Progress' ? 'blue' : s.status === 'Delayed' ? 'red' : 'gray';
			return '<div class="prog-row">' +
				'<div class="prog-label">' +
				'<span>' + s.stage + ' <span class="badge ' + bc + '">' + s.status + '</span></span>' +
				'<span>' + s.start + ' → ' + s.end + ' &nbsp; <strong>' + s.progress + '%</strong></span>' +
				'</div>' +
				'<div class="prog-track"><div class="prog-fill" style="width:' + s.progress + '%;background:' + col + '"></div></div>' +
				'</div>';
		}).join('') +
		'</div>' +

		// --- WEEKLY REPORTS ---
		'<div class="pn">' +
		'<div class="pt">📅 Weekly Reports</div><div class="ps">Reports sent to client</div>' +
		'<table><thead><tr><th>Week</th><th>Report Date</th><th>File Uploaded</th><th>Sent to Client</th></tr></thead><tbody>' +
		d.weekly_reports.map(function(r) {
			return '<tr>' +
				'<td><strong>Week ' + r.week + '</strong></td>' +
				'<td style="color:#64748b">' + r.date + '</td>' +
				'<td>' + (r.uploaded ? '<span class="badge green">✅ Uploaded</span>' : '<span class="badge red">⚠️ Missing</span>') + '</td>' +
				'<td>' + (r.sent ? '<span class="badge green">✅ Sent</span>' : '<span class="badge orange">⏳ Pending</span>') + '</td>' +
				'</tr>';
		}).join('') +
		'</tbody></table>' +
		'</div>';

		document.getElementById('pd-body').innerHTML = html;
	}
};
