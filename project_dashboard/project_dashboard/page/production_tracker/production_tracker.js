frappe.pages['production-tracker'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Production Tracker',
		single_column: true
	});

	var $container = $('<div class="pt-root"></div>').appendTo(page.body);
	inject_styles();

	var state = { company: '', project: '__ALL__', sort: 'issues' };

	function load() {
		$container.html('<div class="pt-loading">Loading production data…</div>');
		frappe.call({
			method: 'project_dashboard.project_dashboard.page.production_tracker.production_tracker.get_dashboard_data',
			args: { project: state.project, company: state.company },
			callback: function(r) {
				if (!r.message) { $container.html('<div class="pt-loading">No data.</div>'); return; }
				if (r.message.scope === 'all') render_all(r.message);
				else render_project(r.message);
			}
		});
	}

	// ============ AGGREGATE VIEW ============
	function render_all(d) {
		d = d || {}; var k = d.kpis || {};
		var companies = d.companies || [];
		var html = '';

		// ---- Header ----
		html += '<div class="pt-head">';
		html += '<div class="pt-head-title"><h1>Production tracker</h1>' +
			'<p>Full pipeline view — every stage, every date, every project</p></div>';
		html += '<div class="pt-filters">';
		html += '<div class="pt-company-tabs">';
		html += '<a class="' + (!state.company ? 'active' : '') + '" data-company="">All Companies</a>';
		companies.forEach(function(c) {
			html += '<a class="' + (state.company === c.name ? 'active' : '') + '" data-company="' + esc(c.name) + '">' + esc(c.name) + '</a>';
		});
		html += '</div>';
		html += '<input class="pt-search" placeholder="Search project...">';
		html += '</div></div>';

		// ---- KPI strip ----
		html += '<div class="pt-kpi-strip">' +
			kpi('Open Plans', k.open_plans || 0, '') +
			'<div class="pt-kpi-sep"></div>' +
			kpi('Drawing Pending', k.drawing_pending || 0, 'a') +
			kpi('Awaiting Material', k.awaiting_material || 0, 'r') +
			kpi('In Production', k.in_production || 0, '') +
			kpi('In QC', k.in_qc || 0, '') +
			kpi('Dispatched', k.dispatched || 0, 'g') +
			'<div class="pt-kpi-sep"></div>' +
			kpi('Overdue', k.overdue || 0, 'r') +
			kpi('Material <60%', k.material_below_60 || 0, 'r') +
			'</div>';

		// ---- Legend ----
		html += '<div class="pt-legend">' +
			legend('#dcfce7', '#16a34a', 'Done (100%)') +
			legend('#dbeafe', '#2563eb', 'In Progress') +
			legend('#fef3c7', '#d97706', 'Warning / behind') +
			legend('#fee2e2', '#dc2626', 'Blocked') +
			legend('#f1f5f9', '#e5e7eb', 'Not started') +
			'<span class="pt-legend-note">Fixed sections have grey left-border · custom production stages have no border</span>' +
			'</div>';

		// ---- List header ----
		html += '<div class="pt-list-head">' +
			'<div><h2>Active Projects <span class="dim">· ' + (d.active_plans || []).length + ' open plans</span></h2>' +
			'<p>Sorted by issues first · click any project to open its full plan</p></div>' +
			'<div class="pt-sort">' +
				'<span class="pt-sort-btn active">🚩 Issues first</span>' +
				'<span class="pt-sort-btn" data-sort="progress">Progress</span>' +
				'<span class="pt-sort-btn" data-sort="target">Target date</span>' +
			'</div>' +
			'</div>';

		// ---- Column headers ----
		html += '<div class="pt-col-headers">' +
			'<div>Project</div><div>Status</div><div style="text-align:center">Flags</div>' +
			'<div>Joinery</div><div>Material</div><div>Days Left</div><div></div>' +
			'</div>';

		// ---- Rows ----
		(d.active_plans || []).forEach(function(p) {
			html += render_row(p);
		});

		if (!(d.active_plans || []).length) {
			html += '<div class="pt-empty">No active production plans' + (state.company ? ' for ' + esc(state.company) : '') + '</div>';
		}

		$container.html(html);
		bind_aggregate_events();
	}

	function render_row(p) {
		var health = p.health || 'idle';
		var h = '<div class="pt-row ' + health + '" data-project="' + esc(p.project) + '">';

		// Summary strip
		h += '<div class="pt-summary">';

		// Project
		var comp_chip = company_chip(p.company);
		h += '<div class="pt-proj">' +
			'<a class="pt-proj-link" data-plan="' + esc(p.name) + '">' + esc(p.project) + '</a>' +
			'<div class="pt-proj-sub">' + comp_chip + ' ' +
			(p.kickoff_date ? 'Kickoff ' + fmt_date(p.kickoff_date) : 'Kickoff pending') +
			(p.production_manager ? ' · ' + esc(p.production_manager) : '') + '</div>' +
			'</div>';

		// Status
		h += '<div>' + status_badge(p.status) + '</div>';

		// Flags
		h += '<div style="text-align:center">' + flag_chip(p) + '</div>';

		// Joinery
		var jc = pct_color(p.joinery_pct, 'joinery');
		h += '<div><div class="pt-bignum ' + jc + '">' + Math.round(p.joinery_pct) + '%</div>' +
			'<div class="pt-subnum">joinery</div></div>';

		// Material (number + segmented bar)
		var mc = pct_color(p.material_available_pct, 'material');
		h += '<div><div class="pt-bignum ' + mc + '">' + Math.round(p.material_available_pct) + '%</div>' +
			'<div class="pt-matbar">' +
				seg(p.material_available_pct, 'avail') +
				seg(p.material_po_pct, 'po') +
				seg(p.material_mr_pct, 'mr') +
			'</div></div>';

		// Days left
		if (p.days_left === null || p.days_left === undefined) {
			h += '<div><div class="pt-bignum gray">—</div><div class="pt-subnum">not started</div></div>';
		} else {
			var dc = p.days_left < 0 ? 'r' : (p.days_left <= 7 ? 'a' : 'g');
			h += '<div><div class="pt-bignum ' + dc + '">' + p.days_left + '</div>' +
				'<div class="pt-subnum ' + (p.days_left < 0 ? 'r' : '') + '">' + esc(p.days_left_label) + '</div></div>';
		}

		// Open link
		h += '<div style="text-align:right"><a class="pt-open" data-plan="' + esc(p.name) + '">Open →</a></div>';

		h += '</div>'; // end summary

		// Pipeline strip
		if (p.status === 'Drawing Pending' || p.status === 'Awaiting Kickoff') {
			h += '<div class="pt-pipeline-empty">Waiting for drawings · pipeline not yet defined</div>';
		} else {
			h += '<div class="pt-pipeline">';
			(p.pipeline || []).forEach(function(t) {
				h += render_tile(t, p.name);
			});
			h += '</div>';
		}

		h += '</div>'; // end row
		return h;
	}

	function render_tile(t, plan_name) {
		var cls = 'pt-tile ' + (t.state || 'idle') + (t.is_fixed ? ' fixed' : '');
		var h = '<div class="' + cls + '" data-plan="' + esc(plan_name) + '" data-section="' + esc(t.key) + '">';

		// Name (with optional tag)
		h += '<div class="pt-tile-name">';
		if (t.tag) h += '<span class="pt-tile-tag">' + esc(t.tag) + '</span>';
		h += esc(t.label) + '</div>';

		// Value: date-based tiles show date, else %
		if (t.date_display) {
			h += '<div class="pt-tile-date">' + esc(t.date_display) + '</div>';
		} else if (t.pct !== null && t.pct !== undefined) {
			var pcls = t.state === 'done' ? 'done-t' : (t.state === 'progress' ? 'prog-t' : (t.state === 'warn' || t.state === 'blocked' ? 'warn-t' : 'gray-t'));
			h += '<div class="pt-tile-pct ' + pcls + '">' + Math.round(t.pct) + '%</div>';
			h += '<div class="pt-tile-bar"><div class="pt-tile-fill ' + tile_fill_class(t.state) + '" style="width:' + Math.max(0, Math.min(100, t.pct)) + '%"></div></div>';
		} else {
			h += '<div class="pt-tile-pct gray-t">—</div>';
		}

		// Meta line
		if (t.meta) {
			var meta_cls = (t.state === 'blocked') ? 'style="color:#dc2626"' : '';
			h += '<div class="pt-tile-meta" ' + meta_cls + '>' + esc(t.meta) + '</div>';
		}

		h += '</div>';
		return h;
	}

	function bind_aggregate_events() {
		// Company tabs
		$container.find('.pt-company-tabs a').on('click', function() {
			state.company = $(this).data('company') || '';
			load();
		});
		// Search
		$container.find('.pt-search').on('keyup', function() {
			var q = $(this).val().toLowerCase();
			$container.find('.pt-row').each(function() {
				var proj = ($(this).data('project') || '').toString().toLowerCase();
				$(this).toggle(proj.indexOf(q) !== -1);
			});
		});
		// Open plan (project link, open link, tiles)
		$container.find('.pt-proj-link, .pt-open').on('click', function() {
			var plan = $(this).data('plan');
			if (plan) frappe.set_route('Form', 'Project Production Plan', plan);
		});
		// Tile click → open plan (scroll handled by Frappe form)
		$container.find('.pt-tile').on('click', function() {
			var plan = $(this).data('plan');
			if (plan) frappe.set_route('Form', 'Project Production Plan', plan);
		});
		// Row click (but not on links) → open
		$container.find('.pt-row').on('click', function(e) {
			if ($(e.target).closest('a, .pt-tile').length) return;
			var proj = $(this).data('project');
			if (proj) frappe.set_route('Form', 'Project Production Plan', 'PPP-' + proj);
		});
	}

	// ============ DRILL-IN VIEW (simple, opens the form instead) ============
	function render_project(d) {
		// For the approved design, clicking a project opens the actual Frappe form.
		// This drill-in fallback just shows a link.
		var meta = d.project_meta || {};
		var html = '<div class="pt-head"><div class="pt-head-title"><h1>' + esc(meta.name || 'Project') + '</h1></div></div>';
		html += '<div style="padding:40px;text-align:center">';
		if (d.plan_exists && d.header) {
			html += '<a class="btn btn-primary" href="/app/project-production-plan/' + encodeURIComponent(d.header.plan_name) + '">Open Production Plan</a>';
		} else {
			html += '<p>No production plan for this project.</p>';
		}
		html += '<div style="margin-top:16px"><a href="#" class="pt-back">← Back to all projects</a></div></div>';
		$container.html(html);
		$container.find('.pt-back').on('click', function(e) { e.preventDefault(); state.project = '__ALL__'; load(); });
	}

	// ============ HELPERS ============
	function kpi(label, val, cls) {
		return '<div class="pt-kpi"><div class="lab">' + esc(label) + '</div>' +
			'<div class="val ' + (cls || '') + '">' + val + '</div></div>';
	}
	function legend(bg, border, label) {
		return '<span class="pt-legend-chip"><span class="box" style="background:' + bg + ';border:1px solid ' + border + '"></span>' + esc(label) + '</span>';
	}
	function seg(pct, cls) {
		if (!pct || pct <= 0) return '';
		return '<div class="pt-mat-seg ' + cls + '" style="width:' + Math.min(100, pct) + '%"></div>';
	}
	function status_badge(s) {
		s = s || '';
		var cls = 'drawing';
		if (s === 'In Production') cls = 'production';
		else if (s === 'In QC') cls = 'qc';
		else if (s === 'MR Raised' || s === 'Awaiting Material') cls = 'awaiting';
		else if (s === 'Ready to Dispatch') cls = 'dispatch';
		else if (s === 'Dispatched' || s === 'Installed' || s === 'Closed') cls = 'installed';
		return '<span class="pt-badge ' + cls + '">' + esc(s) + '</span>';
	}
	function flag_chip(p) {
		var flags = p.flags || [];
		if (!flags.length) {
			if (p.status === 'Drawing Pending' || p.status === 'Awaiting Kickoff')
				return '<span class="pt-flag-none">—</span>';
			return '<span class="pt-flag g">✓</span>';
		}
		var hasCrit = flags.some(function(f) { return f.level === 'critical'; });
		var cls = hasCrit ? 'r' : 'a';
		var icon = hasCrit ? '🚩' : '⚠';
		var tip = '<div class="pt-flag-tip"><div class="tip-head">' + flags.length + ' issue' + (flags.length > 1 ? 's' : '') + ' need attention</div><ul>';
		flags.forEach(function(f) {
			tip += '<li><span class="bullet">•</span>' + esc(f.text) + '</li>';
		});
		tip += '</ul><div class="tip-footer">Click to open the plan</div></div>';
		return '<span class="pt-flag ' + cls + '">' + icon + ' ' + flags.length + tip + '</span>';
	}
	function company_chip(company) {
		if (!company) return '';
		var lc = company.toLowerCase();
		var cls = 'uae', label = 'UAE';
		if (lc.indexOf('ksa') !== -1 || lc.indexOf('saudi') !== -1 || lc.indexOf('global') !== -1) {
			cls = 'ksa'; label = 'KSA';
		}
		return '<span class="pt-comp-chip ' + cls + '">' + label + '</span>';
	}
	function pct_color(pct, type) {
		if (type === 'material') {
			if (pct >= 90) return 'g';
			if (pct >= 60) return 'a';
			return 'r';
		}
		// joinery
		if (pct >= 70) return 'g';
		if (pct >= 30) return 'b';
		if (pct > 0) return 'a';
		return 'gray';
	}
	function tile_fill_class(state) {
		if (state === 'done') return 'g';
		if (state === 'progress') return 'b';
		if (state === 'warn') return 'a';
		if (state === 'blocked') return 'r';
		return 'gray';
	}
	function fmt_date(d) {
		if (!d) return '';
		try {
			var dt = new Date(d);
			return dt.getDate().toString().padStart(2,'0') + ' ' + dt.toLocaleString('en', {month:'short'});
		} catch(e) { return d; }
	}
	function esc(s) {
		if (s === null || s === undefined) return '';
		return (s + '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
	}

	// initial load
	load();
	page.set_primary_action('Refresh', function() { load(); }, 'refresh');
};

function inject_styles() {
	if (document.getElementById('pt-styles')) return;
	var css = `
	.pt-root { font-family: 'Inter', -apple-system, sans-serif; color: #0f172a; font-size: 13px; }
	.pt-loading, .pt-empty { padding: 40px; text-align: center; color: #94a3b8; }

	.pt-head { background: linear-gradient(180deg,#eff6ff,#f0f9ff); padding: 18px 22px; display: flex; justify-content: space-between; align-items: center; gap: 20px; border-bottom: 1px solid #dbeafe; border-radius: 8px 8px 0 0; }
	.pt-head-title h1 { margin: 0; font-size: 17px; font-weight: 600; color: #0f172a; letter-spacing: -0.015em; }
	.pt-head-title p { margin: 3px 0 0; font-size: 12px; color: #475569; }
	.pt-filters { display: flex; gap: 10px; align-items: center; }
	.pt-company-tabs { display: flex; background: #fff; border: 1px solid #dbeafe; border-radius: 6px; padding: 3px; gap: 2px; }
	.pt-company-tabs a { padding: 6px 14px; border-radius: 4px; font-size: 12px; color: #64748b; text-decoration: none; font-weight: 500; cursor: pointer; white-space: nowrap; }
	.pt-company-tabs a.active { background: #dbeafe; color: #0c4a6e; font-weight: 600; }
	.pt-search { padding: 7px 12px; border-radius: 5px; border: 1px solid #cbd5e1; background: #fff; font-size: 12px; width: 200px; }
	.pt-search:focus { outline: none; border-color: #93c5fd; box-shadow: 0 0 0 3px rgba(147,197,253,0.3); }

	.pt-kpi-strip { display: flex; padding: 12px 22px; gap: 24px; background: #fff; border-bottom: 1px solid #e5e7eb; overflow-x: auto; }
	.pt-kpi { display: flex; flex-direction: column; gap: 2px; min-width: 80px; }
	.pt-kpi .lab { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; font-weight: 500; }
	.pt-kpi .val { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
	.pt-kpi .val.r { color: #dc2626; } .pt-kpi .val.a { color: #d97706; } .pt-kpi .val.g { color: #16a34a; }
	.pt-kpi-sep { border-left: 1px solid #e5e7eb; }

	.pt-legend { display: flex; gap: 12px; padding: 8px 22px; font-size: 10px; color: #64748b; background: #fafbfc; align-items: center; }
	.pt-legend-chip { display: inline-flex; align-items: center; gap: 4px; }
	.pt-legend-chip .box { width: 10px; height: 10px; border-radius: 2px; }
	.pt-legend-note { margin-left: auto; color: #94a3b8; }

	.pt-list-head { display: flex; justify-content: space-between; align-items: baseline; padding: 14px 22px 4px; }
	.pt-list-head h2 { margin: 0; font-size: 13px; font-weight: 600; color: #0f172a; }
	.pt-list-head h2 .dim { color: #94a3b8; font-weight: 400; }
	.pt-list-head p { margin: 2px 0 0; font-size: 11px; color: #64748b; }
	.pt-sort { display: flex; gap: 6px; font-size: 11px; color: #64748b; }
	.pt-sort-btn { padding: 4px 10px; border-radius: 4px; cursor: pointer; border: 1px solid transparent; }
	.pt-sort-btn.active { background: #fff; border-color: #e5e7eb; color: #0f172a; font-weight: 600; }

	.pt-col-headers { display: grid; grid-template-columns: 260px 130px 60px 90px 130px 90px 80px; gap: 16px; padding: 6px 22px 8px; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; font-weight: 600; }

	.pt-row { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; margin: 0 22px 6px; overflow: hidden; cursor: pointer; transition: box-shadow 0.15s, border-color 0.15s; }
	.pt-row:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.05); border-color: #cbd5e1; }
	.pt-row.critical { border-left: 3px solid #dc2626; }
	.pt-row.warn { border-left: 3px solid #d97706; }
	.pt-row.healthy { border-left: 3px solid #16a34a; }
	.pt-row.idle { border-left: 3px solid #e5e7eb; }

	.pt-summary { display: grid; grid-template-columns: 260px 130px 60px 90px 130px 90px 80px; gap: 16px; padding: 12px 16px 8px; align-items: center; }
	.pt-proj-link { font-size: 13px; font-weight: 600; color: #0f172a; text-decoration: none; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.pt-proj-link:hover { color: #2563eb; }
	.pt-proj-sub { font-size: 10px; color: #64748b; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

	.pt-comp-chip { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 9.5px; font-weight: 600; }
	.pt-comp-chip.uae { background: #f0f9ff; color: #075985; }
	.pt-comp-chip.ksa { background: #fefce8; color: #854d0e; }

	.pt-badge { display: inline-block; padding: 3px 9px; border-radius: 4px; font-size: 10.5px; font-weight: 600; white-space: nowrap; }
	.pt-badge.drawing { background: #f5f3ff; color: #6d28d9; }
	.pt-badge.awaiting { background: #fef2f2; color: #b91c1c; }
	.pt-badge.production { background: #eff6ff; color: #1d4ed8; }
	.pt-badge.qc { background: #fffbeb; color: #92400e; }
	.pt-badge.dispatch { background: #f0fdf4; color: #15803d; }
	.pt-badge.installed { background: #ecfeff; color: #0e7490; }

	.pt-flag { display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: 600; font-family: 'SF Mono', monospace; cursor: pointer; position: relative; }
	.pt-flag.r { background: #fef2f2; color: #b91c1c; }
	.pt-flag.a { background: #fffbeb; color: #92400e; }
	.pt-flag.g { background: #f0fdf4; color: #15803d; }
	.pt-flag-none { color: #94a3b8; font-size: 11px; }
	.pt-flag-tip { position: absolute; top: calc(100% + 6px); left: 50%; transform: translateX(-50%); background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; min-width: 240px; box-shadow: 0 8px 20px rgba(0,0,0,0.1); z-index: 100; display: none; text-align: left; font-weight: 400; font-size: 11.5px; color: #0f172a; }
	.pt-flag:hover .pt-flag-tip { display: block; }
	.pt-flag-tip .tip-head { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 600; margin-bottom: 6px; padding-bottom: 5px; border-bottom: 1px solid #f1f5f9; }
	.pt-flag-tip ul { margin: 0; padding: 0; list-style: none; }
	.pt-flag-tip li { display: flex; gap: 6px; padding: 4px 0; color: #475569; }
	.pt-flag-tip li .bullet { color: #dc2626; font-weight: 700; }
	.pt-flag-tip .tip-footer { margin-top: 6px; padding-top: 6px; border-top: 1px solid #f1f5f9; font-size: 10px; color: #94a3b8; }

	.pt-bignum { font-family: 'SF Mono', monospace; font-size: 15px; font-weight: 700; letter-spacing: -0.02em; line-height: 1; }
	.pt-bignum.g { color: #16a34a; } .pt-bignum.a { color: #d97706; } .pt-bignum.r { color: #dc2626; } .pt-bignum.b { color: #2563eb; } .pt-bignum.gray { color: #94a3b8; }
	.pt-subnum { font-size: 9.5px; color: #64748b; margin-top: 2px; }
	.pt-subnum.r { color: #dc2626; }

	.pt-matbar { height: 6px; background: #f1f5f9; border-radius: 2px; overflow: hidden; display: flex; margin-top: 4px; }
	.pt-mat-seg { height: 100%; } .pt-mat-seg.avail { background: #16a34a; } .pt-mat-seg.po { background: #2563eb; } .pt-mat-seg.mr { background: #d97706; }

	.pt-open { color: #64748b; font-size: 11px; font-weight: 500; text-decoration: none; }
	.pt-open:hover { color: #2563eb; }

	.pt-pipeline { display: flex; gap: 4px; padding: 4px 16px 12px; overflow-x: auto; }
	.pt-pipeline-empty { padding: 8px 16px 14px; font-size: 11px; color: #64748b; font-style: italic; }

	.pt-tile { min-width: 105px; flex: 1 1 105px; background: #f1f5f9; border: 1px solid #e5e7eb; border-radius: 5px; padding: 6px 8px; display: flex; flex-direction: column; gap: 2px; cursor: pointer; }
	.pt-tile.done { background: #dcfce7; border-color: #16a34a; }
	.pt-tile.progress { background: #dbeafe; border-color: #2563eb; }
	.pt-tile.warn { background: #fef3c7; border-color: #d97706; }
	.pt-tile.blocked { background: #fee2e2; border-color: #dc2626; }
	.pt-tile.fixed { border-left: 3px solid #64748b; }
	.pt-tile-name { font-size: 10px; font-weight: 600; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.pt-tile-tag { font-size: 8px; font-weight: 700; padding: 0 4px; background: #94a3b8; color: #fff; border-radius: 2px; margin-right: 4px; letter-spacing: 0.05em; }
	.pt-tile.done .pt-tile-tag { background: #16a34a; } .pt-tile.progress .pt-tile-tag { background: #2563eb; } .pt-tile.warn .pt-tile-tag { background: #d97706; }
	.pt-tile-pct { font-family: 'SF Mono', monospace; font-size: 12px; font-weight: 700; line-height: 1; }
	.pt-tile-pct.done-t { color: #16a34a; } .pt-tile-pct.prog-t { color: #2563eb; } .pt-tile-pct.warn-t { color: #d97706; } .pt-tile-pct.gray-t { color: #94a3b8; }
	.pt-tile-date { font-family: 'SF Mono', monospace; font-size: 11px; font-weight: 600; color: #0f172a; }
	.pt-tile-bar { height: 3px; background: rgba(0,0,0,0.06); border-radius: 2px; overflow: hidden; margin-top: 2px; }
	.pt-tile-fill { height: 100%; } .pt-tile-fill.g { background: #16a34a; } .pt-tile-fill.b { background: #2563eb; } .pt-tile-fill.a { background: #d97706; } .pt-tile-fill.r { background: #dc2626; } .pt-tile-fill.gray { background: #94a3b8; }
	.pt-tile-meta { font-size: 9px; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px; }
	`;
	var style = document.createElement('style');
	style.id = 'pt-styles';
	style.textContent = css;
	document.head.appendChild(style);
}
