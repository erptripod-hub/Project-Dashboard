// Copyright (c) 2026, Tripod Mena and contributors
// For license information, please see license.txt

frappe.ui.form.on('Project Production Plan', {
	refresh: function(frm) {
		// Employee dropdowns show ALL employees (no company filter — staff work
		// across all companies). Only QC Inspection / Logistics Request / MR are
		// filtered by project.
		apply_project_filters(frm);

		// Material drill-in buttons
		add_material_drill_buttons(frm);

		// Render the top visuals (alert bar + material bar + days counter)
		render_top_visuals(frm);
	},

	project: function(frm) {
		apply_project_filters(frm);
	},

	// Re-render visuals when key fields change (after save these refresh)
	overall_status: function(frm) { render_top_visuals(frm); },
	material_available_pct: function(frm) { render_top_visuals(frm); },
	days_remaining: function(frm) { render_top_visuals(frm); },
});

function apply_project_filters(frm) {
	// Only project-scoped links get filtered. Employee fields stay unfiltered.
	if (frm.doc.project) {
		frm.set_query('linked_qc_inspection', () => ({ filters: { project: frm.doc.project } }));
		frm.set_query('linked_logistics_request', () => ({ filters: { project: frm.doc.project } }));
		frm.set_query('approved_mr_link', () => ({ filters: { project: frm.doc.project } }));
		for (let n = 1; n <= 5; n++) {
			frm.set_query('mr_' + n, () => ({ filters: { project: frm.doc.project } }));
		}
	}
}

function add_material_drill_buttons(frm) {
	if (!frm.doc.project || frm.doc.__islocal) return;
	frm.add_custom_button(__('View MRs'), () => frappe.set_route('List', 'Material Request', { project: frm.doc.project }), __('Material'));
	frm.add_custom_button(__('View POs'), () => frappe.set_route('List', 'Purchase Order', { project: frm.doc.project }), __('Material'));
	frm.add_custom_button(__('View GRNs'), () => frappe.set_route('List', 'Purchase Receipt', { project: frm.doc.project }), __('Material'));
	frm.add_custom_button(__('View Stock Entries'), () => frappe.set_route('List', 'Stock Entry', { project: frm.doc.project }), __('Material'));
}

function render_top_visuals(frm) {
	if (frm.doc.__islocal) return;

	var d = frm.doc;
	var html = '';

	// ---- Alert bar (only shows if there are issues) ----
	var alerts = build_alerts(d);
	alerts.forEach(function(a) {
		html += '<div class="ppp-alert ' + a.level + '">' +
			'<span class="ppp-alert-icon">' + a.icon + '</span>' +
			'<div class="ppp-alert-body"><div class="ppp-alert-title">' + frappe.utils.escape_html(a.title) + '</div>' +
			(a.detail ? '<div class="ppp-alert-detail">' + frappe.utils.escape_html(a.detail) + '</div>' : '') +
			'</div></div>';
	});

	// ---- Material bar (2 segments: Received green / Pending grey) ----
	var received = flt(d.material_available_pct);
	var pending = Math.max(0, 100 - received);
	html += '<div class="ppp-matbar-wrap">' +
		'<div class="ppp-matbar-label">Material</div>' +
		'<div class="ppp-matbar">' +
			(received > 0 ? '<div class="ppp-seg avail" style="width:' + received + '%">' + (received >= 10 ? 'Received ' + Math.round(received) + '%' : '') + '</div>' : '') +
			(pending > 0 ? '<div class="ppp-seg pending-lbl" style="width:' + pending + '%">' + (pending >= 10 ? 'Pending ' + Math.round(pending) + '%' : '') + '</div>' : '') +
		'</div>' +
		'<div class="ppp-matbar-summary">' + frappe.utils.escape_html(d.material_summary_text || 'No MRs raised yet') + '</div>' +
	'</div>';

	// ---- Days counter ----
	var total = cint(d.total_duration_days);
	if (total > 0) {
		var elapsed = cint(d.days_elapsed);
		var remaining = cint(d.days_remaining);
		var pct = cint(d.days_progress_pct);
		var rem_cls = remaining <= 3 ? 'r' : (remaining <= 7 ? 'a' : 'g');
		html += '<div class="ppp-days">' +
			'<div class="ppp-days-box"><div class="lab">Total Duration</div><div class="val">' + total + '<span>days</span></div></div>' +
			'<div class="ppp-days-box"><div class="lab">Days Elapsed</div><div class="val a">' + elapsed + '<span>days</span></div></div>' +
			'<div class="ppp-days-box"><div class="lab">Days Remaining</div><div class="val ' + rem_cls + '">' + remaining + '<span>days</span></div></div>' +
			'<div class="ppp-days-progress">' +
				'<div class="ppp-days-bar"><div class="ppp-days-fill" style="width:' + Math.min(100, pct) + '%;background:' + (pct > 80 ? '#dc2626' : (pct > 50 ? '#d97706' : '#16a34a')) + '"></div></div>' +
				'<div class="ppp-days-labels"><span>Prod Start</span><span>' + pct + '% elapsed</span><span>Est. End</span></div>' +
			'</div>' +
		'</div>';
	}

	inject_ppp_styles();

	// Insert above the form layout
	var $wrap = frm.$wrapper.find('.ppp-top-visuals');
	if (!$wrap.length) {
		$wrap = $('<div class="ppp-top-visuals"></div>');
		frm.$wrapper.find('.form-layout').prepend($wrap);
	}
	$wrap.html(html);
}

function build_alerts(d) {
	var alerts = [];

	// Dispatch slippage
	if (d.revised_dispatch_date && d.target_dispatch_date && d.revised_dispatch_date > d.target_dispatch_date) {
		var slip = frappe.datetime.get_day_diff(d.revised_dispatch_date, d.target_dispatch_date);
		alerts.push({ level: 'critical', icon: '🚨', title: 'Dispatch is ' + slip + ' days behind schedule',
			detail: 'Original target ' + frappe.datetime.str_to_user(d.target_dispatch_date) + ' → revised to ' + frappe.datetime.str_to_user(d.revised_dispatch_date) + '.' });
	}

	// Low material
	if (flt(d.material_available_pct) < 60) {
		alerts.push({ level: 'warn', icon: '⚠️', title: 'Material below 60% available',
			detail: 'Only ' + Math.round(flt(d.material_available_pct)) + '% of material is available. Production may be blocked.' });
	}

	// Material delay flag (from server)
	if (d.material_delay_flag) {
		alerts.push({ level: 'critical', icon: '🚩', title: 'Material delay may impact installation', detail: d.material_delay_flag });
	}

	return alerts;
}

function flt(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
function cint(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }

function inject_ppp_styles() {
	if (document.getElementById('ppp-top-styles')) return;
	var css = `
	.ppp-top-visuals { margin: 0 0 16px; }
	.ppp-alert { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; border-radius: 8px; margin-bottom: 8px; font-size: 12.5px; }
	.ppp-alert.critical { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
	.ppp-alert.warn { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
	.ppp-alert-icon { font-size: 16px; line-height: 1.2; flex-shrink: 0; }
	.ppp-alert-title { font-weight: 600; margin-bottom: 2px; }
	.ppp-alert-detail { font-size: 11.5px; opacity: 0.85; }
	.ppp-matbar-wrap { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
	.ppp-matbar-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; flex-shrink: 0; min-width: 70px; }
	.ppp-matbar { flex: 1; display: flex; height: 22px; border-radius: 4px; overflow: hidden; background: #f1f5f9; border: 1px solid #e5e7eb; }
	.ppp-seg { display: flex; align-items: center; justify-content: center; color: #fff; font-size: 11px; font-weight: 600; white-space: nowrap; }
	.ppp-seg.avail { background: #16a34a; } .ppp-seg.po { background: #2563eb; } .ppp-seg.mr { background: #d97706; }
	.ppp-seg.pending { background: #e5e7eb; } .ppp-seg.pending-lbl { background: #e5e7eb; color: #475569; }
	.ppp-matbar-summary { font-size: 12.5px; color: #0f172a; font-weight: 600; flex-shrink: 0; text-align: right; }
	.ppp-days { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; padding: 14px; background: linear-gradient(135deg,#f8fafc,#f1f5f9); border: 1px solid #e5e7eb; border-radius: 8px; }
	.ppp-days-box { text-align: center; }
	.ppp-days-box .lab { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 600; margin-bottom: 4px; }
	.ppp-days-box .val { font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1; }
	.ppp-days-box .val span { font-size: 11px; color: #64748b; font-weight: 500; margin-left: 2px; }
	.ppp-days-box .val.a { color: #d97706; } .ppp-days-box .val.r { color: #dc2626; } .ppp-days-box .val.g { color: #16a34a; }
	.ppp-days-progress { grid-column: 1 / -1; margin-top: 4px; }
	.ppp-days-bar { height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden; }
	.ppp-days-fill { height: 100%; border-radius: 3px; }
	.ppp-days-labels { display: flex; justify-content: space-between; margin-top: 4px; font-size: 10px; color: #64748b; }
	`;
	var s = document.createElement('style'); s.id = 'ppp-top-styles'; s.textContent = css; document.head.appendChild(s);
}
