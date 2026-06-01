frappe.pages['project-status'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Project Status Overview',
		single_column: true
	});

	page.add_inner_button('Refresh', function() { load_data(); });

	if (!document.getElementById('ps-style')) {
		var s = document.createElement('style');
		s.id = 'ps-style';
		s.textContent =
			'.ps{padding:16px;background:#f0f4f8;min-height:100vh;margin:-15px}' +
			'.ps .hdr{background:#0f1623;border-radius:10px;padding:16px 22px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px}' +
			'.ps .hdr h2{font-size:16px;font-weight:800;color:#fff;margin:0}.ps .hdr h2 span{color:#60a5fa}' +
			'.ps .hdr-filters{display:flex;gap:10px;align-items:center;flex-wrap:wrap}' +
			'.ps .hdr-filters select,.ps .hdr-filters input{background:#1e2a3b;border:1px solid #334155;color:#e2e8f0;padding:6px 10px;border-radius:6px;font-size:12px;outline:none}' +
			'.ps .hdr-filters button{background:#2563eb;border:none;color:#fff;padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer;font-weight:600}' +
			'.ps .k4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}' +
			'.ps .kc{background:#fff;border-radius:10px;padding:16px;border:1px solid #e2e8f0;border-top:4px solid #ccc}' +
			'.ps .kc .t{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#64748b;font-weight:600;margin-bottom:8px}' +
			'.ps .kc .v{font-size:22px;font-weight:800;color:#0f172a}.ps .kc .s{font-size:11px;color:#94a3b8;margin-top:4px}' +
			'.ps .chart-box{background:#fff;border-radius:10px;padding:18px;margin-bottom:14px;border:1px solid #e2e8f0}' +
			'.ps .chart-title{font-size:13px;font-weight:700;color:#0f172a;margin-bottom:14px}' +
			'.ps .bar-wrap{display:flex;align-items:flex-end;gap:24px;height:120px;border-bottom:2px solid #f1f5f9;padding-bottom:8px}' +
			'.ps .bar-col{display:flex;flex-direction:column;align-items:center;gap:5px;flex:1;max-width:120px}' +
			'.ps .bar-val{font-size:12px;font-weight:700;color:#0f172a}' +
			'.ps .bar{width:100%;border-radius:6px 6px 0 0}' +
			'.ps .bar-lbl{font-size:12px;color:#64748b;font-weight:500}' +
			'.ps .bar-legend{display:flex;gap:16px;margin-top:10px}' +
			'.ps .leg{display:flex;align-items:center;gap:6px;font-size:12px;color:#64748b}' +
			'.ps .leg-dot{width:12px;height:12px;border-radius:3px}' +
			'.ps .tbl-box{background:#fff;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden}' +
			'.ps .tbl-hdr{padding:14px 18px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center}' +
			'.ps .tbl-title{font-size:14px;font-weight:700;color:#0f172a}' +
			'.ps .tbl-sub{font-size:11px;color:#94a3b8}' +
			'.ps table{width:100%;border-collapse:collapse}' +
			'.ps th{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;font-weight:600;padding:10px 12px;text-align:left;border-bottom:2px solid #f1f5f9;background:#fafafa;white-space:nowrap}' +
			'.ps td{font-size:12px;padding:10px 12px;border-bottom:1px solid #f8fafc;color:#0f172a}' +
			'.ps tr.on-hold td{background:#fff5f5}' +
			'.ps tr:last-child td{border-bottom:none}' +
			'.ps .badge{display:inline-flex;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;white-space:nowrap}' +
			'.ps .b-red{background:#fee2e2;color:#b91c1c}.ps .b-green{background:#dcfce7;color:#15803d}' +
			'.ps .b-blue{background:#dbeafe;color:#1d4ed8}.ps .b-orange{background:#fff7ed;color:#c2410c}' +
			'.ps .b-yellow{background:#fef3c7;color:#92400e}.ps .b-gray{background:#f1f5f9;color:#475569}' +
			'.ps .num{text-align:right;font-weight:600}.ps .proj-id{color:#2563eb;font-size:11px;font-weight:600}';
		document.head.appendChild(s);
	}

	$(wrapper).find('.page-content').html(
		'<div class="ps">' +
		'<div class="hdr">' +
		'<div><h2>TRIPOD MENA | <span>Project Status Overview</span></h2></div>' +
		'<div class="hdr-filters">' +
		'<select id="ps-status"><option value="Open">Open</option><option value="On Hold">On Hold</option><option value="All">All</option><option value="Completed">Completed</option></select>' +
		'<input id="ps-company" placeholder="Company..." style="width:150px">' +
		'<select id="ps-type"><option value="">All Types</option><option value="Fitout">Fitout</option><option value="Joinery">Joinery</option><option value="Both">Both</option></select>' +
		'<button onclick="window._ps_load()">Run</button>' +
		'</div></div>' +
		'<div id="ps-body"><div style="text-align:center;padding:60px;color:#64748b">Loading...</div></div>' +
		'</div>'
	);

	function fmt(v) {
		v = parseFloat(v) || 0;
		if (v >= 1000000) return 'AED ' + (v/1000000).toFixed(2) + 'M';
		if (v >= 1000) return 'AED ' + Math.round(v/1000) + 'K';
		if (v > 0) return 'AED ' + v.toLocaleString('en-AE', {minimumFractionDigits:0});
		return '\u2014';
	}

	function sbadge(s) {
		var c = s==='On Hold'?'b-red':s==='Open'?'b-green':s==='Completed'?'b-blue':'b-gray';
		return '<span class="badge '+c+'">'+s+'</span>';
	}

	function tbadge(t) {
		if (!t) return '<span style="color:#94a3b8">\u2014</span>';
		var c = t==='Fitout'?'b-blue':t==='Joinery'?'b-gray':'b-orange';
		return '<span class="badge '+c+'">'+t+'</span>';
	}

	function dbadge(s) {
		if (!s) return '<span style="color:#94a3b8">\u2014</span>';
		var c = s==='Dispatched'?'b-green':s==='Pending'?'b-orange':s==='Partial'?'b-yellow':'b-red';
		return '<span class="badge '+c+'">'+s+'</span>';
	}

	function load_data() {
		var filters = {
			status: document.getElementById('ps-status').value,
			company: document.getElementById('ps-company').value,
			project_type: document.getElementById('ps-type').value
		};
		document.getElementById('ps-body').innerHTML = '<div style="text-align:center;padding:60px;color:#64748b">Loading...</div>';
		frappe.call({
			method: 'project_dashboard.project_dashboard.page.project_status.project_status.get_status_data',
			args: {filters: filters},
			callback: function(r) { if (r.message) render(r.message); }
		});
	}

	window._ps_load = load_data;

	function render(d) {
		var projects = d.projects || [];
		var s = d.summary || {};
		var tf = s.fitout_value || 0;
		var tj = s.joinery_value || 0;
		var mx = Math.max(tf, tj, 1);
		var oh = s.on_hold || 0;
		var html = '';

		// Cards
		html += '<div class="k4">';
		html += '<div class="kc" style="border-top-color:#2563eb"><div class="t">Total Projects</div><div class="v" style="color:#2563eb">'+s.total+'</div><div class="s">Filtered results</div></div>';
		html += '<div class="kc" style="border-top-color:#0d9488"><div class="t">Fitout Value</div><div class="v" style="color:#0d9488">'+fmt(tf)+'</div><div class="s">Subcontractor allocations</div></div>';
		html += '<div class="kc" style="border-top-color:#7c3aed"><div class="t">Joinery Value</div><div class="v" style="color:#7c3aed">'+fmt(tj)+'</div><div class="s">From BOQ joinery section</div></div>';
		html += '<div class="kc" style="border-top-color:'+(oh>0?'#dc2626':'#15803d')+'"><div class="t">On Hold</div><div class="v" style="color:'+(oh>0?'#dc2626':'#15803d')+'">'+oh+'</div><div class="s">Requires attention</div></div>';
		html += '</div>';

		// Chart
		var fh = Math.round((tf/mx)*100);
		var jh = Math.round((tj/mx)*100);
		var fp = (tf+tj)>0 ? Math.round(tf/(tf+tj)*100) : 0;
		html += '<div class="chart-box"><div class="chart-title">Fitout vs Joinery value comparison</div>';
		html += '<div class="bar-wrap">';
		html += '<div class="bar-col"><div class="bar-val">'+fmt(tf)+'</div><div class="bar" style="height:'+fh+'px;background:#0d9488"></div><div class="bar-lbl">Fitout</div></div>';
		html += '<div class="bar-col"><div class="bar-val">'+fmt(tj)+'</div><div class="bar" style="height:'+jh+'px;background:#7c3aed"></div><div class="bar-lbl">Joinery</div></div>';
		html += '</div>';
		html += '<div class="bar-legend"><div class="leg"><div class="leg-dot" style="background:#0d9488"></div>Fitout \u2014 '+fp+'%</div><div class="leg"><div class="leg-dot" style="background:#7c3aed"></div>Joinery \u2014 '+(100-fp)+'%</div></div></div>';

		// Table
		html += '<div class="tbl-box"><div class="tbl-hdr"><div><div class="tbl-title">All Projects</div><div class="tbl-sub">On Hold shown first \u2014 highlighted red</div></div>';
		if (oh>0) html += '<span class="badge b-red">'+oh+' On Hold</span>';
		html += '</div><div style="overflow-x:auto"><table><thead><tr>';
		html += '<th>Project</th><th>Project Name</th><th>Customer</th><th>Type</th><th>Status</th><th>Start</th><th>End</th>';
		html += '<th style="text-align:right">Total Value</th><th style="text-align:right">Fitout Value</th><th style="text-align:right">Joinery Value</th>';
		html += '<th>Dispatch Date</th><th>Dispatch Status</th><th>Hold Reason</th></tr></thead><tbody>';

		projects.forEach(function(p) {
			var ih = p.status === 'On Hold';
			html += '<tr'+(ih?' class="on-hold"':'')+'>'; 
			html += '<td><span class="proj-id">'+p.project+'</span></td>';
			html += '<td><b>'+(p.project_name||'')+'</b></td>';
			html += '<td style="color:#64748b">'+(p.customer||'\u2014')+'</td>';
			html += '<td>'+tbadge(p.project_type)+'</td>';
			html += '<td>'+sbadge(p.status)+'</td>';
			html += '<td style="color:#64748b;font-size:11px">'+(p.start_date||'\u2014')+'</td>';
			html += '<td style="color:#64748b;font-size:11px">'+(p.end_date||'\u2014')+'</td>';
			html += '<td class="num">'+(p.total_value>0?fmt(p.total_value):'\u2014')+'</td>';
			html += '<td class="num" style="color:#0d9488">'+(p.fitout_value>0?fmt(p.fitout_value):'\u2014')+'</td>';
			html += '<td class="num" style="color:#7c3aed">'+(p.joinery_value>0?fmt(p.joinery_value):'\u2014')+'</td>';
			html += '<td style="font-size:11px;color:#64748b">'+(p.dispatch_date||'\u2014')+'</td>';
			html += '<td>'+dbadge(p.dispatch_status)+'</td>';
			html += '<td style="font-size:11px;color:#b91c1c;font-style:italic">'+(p.hold_reason||'')+'</td>';
			html += '</tr>';
		});

		html += '</tbody></table></div></div>';
		document.getElementById('ps-body').innerHTML = html;
	}

	load_data();
};
