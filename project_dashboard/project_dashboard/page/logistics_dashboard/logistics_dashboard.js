frappe.pages['logistics-dashboard'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Logistics Tracker Dashboard',
        single_column: true
    });

    if (!document.getElementById('lt-style')) {
        var s = document.createElement('style');
        s.id = 'lt-style';
        s.textContent =
            '.lt{padding:16px;background:#f0f4f8;min-height:100vh;margin:-15px}' +
            '.lt .k5{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px}' +
            '.lt .g2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;align-items:start}' +
            '.lt .card{background:#fff;border-radius:10px;padding:16px;border:1px solid #e2e8f0;margin-bottom:12px}' +
            '.lt .kc{background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #e2e8f0;border-top:4px solid #2563eb;cursor:pointer;transition:transform .1s}' +
            '.lt .kc:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.05)}' +
            '.lt .kc .t{font-size:10px;text-transform:uppercase;color:#64748b;font-weight:600;margin-bottom:6px}' +
            '.lt .kc .v{font-size:22px;font-weight:800;color:#0f172a}' +
            '.lt .kc .s{font-size:10px;color:#94a3b8;margin-top:4px}' +
            '.lt .ch{display:flex;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #f1f5f9}' +
            '.lt .ct{font-size:13px;font-weight:700;color:#0f172a}.lt .cs{font-size:11px;color:#94a3b8}' +
            '.lt table{width:100%;border-collapse:collapse}' +
            '.lt th{font-size:10px;text-transform:uppercase;color:#94a3b8;font-weight:600;padding:6px 8px;text-align:left;border-bottom:2px solid #f1f5f9}' +
            '.lt td{font-size:12px;padding:8px;border-bottom:1px solid #f8fafc;color:#0f172a;vertical-align:top}' +
            '.lt .badge{display:inline-flex;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;white-space:nowrap}' +
            '.lt .bg{background:#dcfce7;color:#15803d}.lt .bb{background:#dbeafe;color:#1d4ed8}' +
            '.lt .bo{background:#fff7ed;color:#c2410c}.lt .br{background:#fee2e2;color:#b91c1c}' +
            '.lt .by{background:#fef9c3;color:#854d0e}.lt .bv{background:#ede9fe;color:#6d28d9}' +
            '.lt .bgray{background:#f1f5f9;color:#475569}' +
            '.lt .funnel-row{display:flex;align-items:center;gap:10px;margin-bottom:6px;font-size:12px}' +
            '.lt .funnel-row .lab{width:140px;color:#475569}' +
            '.lt .funnel-row .bar{flex:1;height:24px;background:#f1f5f9;border-radius:4px;overflow:hidden;position:relative}' +
            '.lt .funnel-row .bar .fill{height:100%;background:linear-gradient(90deg,#3b82f6,#1d4ed8);display:flex;align-items:center;justify-content:flex-end;padding-right:8px;color:#fff;font-weight:700;font-size:11px}' +
            '.lt .funnel-row .num{width:36px;text-align:right;font-weight:800;color:#0f172a}' +
            '.lt .alert-row{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#fef2f2;border-left:3px solid #dc2626;border-radius:4px;margin-bottom:6px;font-size:12px}' +
            '.lt .pending-row{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:4px;margin-bottom:6px;font-size:12px}';
        document.head.appendChild(s);
    }

    $(wrapper).find('.page-content').html(
        '<div class="lt">' +
        '<div style="background:#0f1623;border-radius:10px;padding:16px 22px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">' +
        '<div><h2 style="font-size:16px;font-weight:800;color:#fff;margin:0">TRIPOD MENA | <span style="color:#60a5fa">Logistics Tracker</span></h2>' +
        '<p style="font-size:11px;color:#94a3b8;margin-top:2px">Process pipeline view — request to delivery</p></div>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
        '<input id="lt-inp" list="lt-dl" placeholder="Type project name or pick All Shipments..." autocomplete="off" ' +
        'style="background:#1e2a3b;border:1px solid #334155;color:#e2e8f0;padding:8px 14px;border-radius:8px;font-size:12px;min-width:280px;outline:none">' +
        '<datalist id="lt-dl"></datalist>' +
        '<a id="lt-new" href="/app/logistics-request/new" ' +
        'style="background:#2563eb;color:#fff;padding:8px 14px;border-radius:8px;font-size:12px;text-decoration:none;font-weight:600">+ New Request</a>' +
        '</div>' +
        '</div>' +
        '<div id="lt-body" style="text-align:center;padding:60px;color:#64748b;font-size:13px">Select a project above, or pick "All Shipments"</div>' +
        '</div>'
    );

    var ALL_LABEL = '★ All Shipments (no project filter)';
    window._lt_map = {};
    window._lt_map[ALL_LABEL] = '__ALL__';

    var dl = document.getElementById('lt-dl');
    var allOpt = document.createElement('option');
    allOpt.value = ALL_LABEL;
    dl.appendChild(allOpt);

    frappe.db.get_list('Project', {
        fields: ['name', 'project_name'],
        limit: 500,
        filters: {status: ['!=', 'Cancelled']},
        order_by: 'modified desc'
    }).then(function(projects) {
        projects.forEach(function(p) {
            var opt = document.createElement('option');
            var label = p.name + ' — ' + (p.project_name || '');
            opt.value = label;
            dl.appendChild(opt);
            window._lt_map[label] = p.name;
        });
    });

    document.getElementById('lt-inp').addEventListener('change', function() {
        var map = window._lt_map || {};
        if (map[this.value]) load_dashboard(map[this.value]);
    });

    function load_dashboard(project) {
        document.getElementById('lt-body').innerHTML =
            '<div style="text-align:center;padding:60px;color:#64748b">Loading...</div>';
        frappe.call({
            method: 'project_dashboard.project_dashboard.page.logistics_dashboard.logistics_dashboard.get_dashboard_data',
            args: {project: project},
            callback: function(r) {
                if (r && r.message) render(r.message);
            }
        });
    }

    function esc(v) {
        if (v === null || v === undefined) return '';
        return String(v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function stage_badge(s) {
        s = s || 'Draft';
        var cls = 'bgray';
        if (s === 'Draft') cls = 'br';
        else if (s === 'Rates Submitted') cls = 'by';
        else if (s === 'Rates Approved') cls = 'bo';
        else if (s === 'PO Issued') cls = 'bb';
        else if (s === 'Dispatched') cls = 'bv';
        else if (s === 'Delivered') cls = 'bg';
        else if (s === 'Rejected') cls = 'br';
        return '<span class="badge ' + cls + '">' + esc(s) + '</span>';
    }

    function urgency_badge(u) {
        u = u || 'Normal';
        var cls = 'bgray';
        if (u === 'Critical') cls = 'br';
        else if (u === 'Urgent') cls = 'bo';
        return '<span class="badge ' + cls + '">' + esc(u) + '</span>';
    }

    function kc(title, value, sub, color, click_url) {
        var click = click_url ? ' onclick="window.location.href=\'' + click_url + '\'"' : '';
        return '<div class="kc" style="border-top-color:' + color + '"' + click + '>' +
            '<div class="t">' + esc(title) + '</div>' +
            '<div class="v">' + esc(value) + '</div>' +
            '<div class="s">' + esc(sub) + '</div></div>';
    }

    function open_lr(name) {
        return '<a href="/app/logistics-request/' + encodeURIComponent(name) + '" target="_blank">' + esc(name) + '</a>';
    }

    function bar_chart(items) {
        items = items || [];
        if (!items.length) return '<div style="color:#94a3b8;font-size:12px;padding:8px 0">No data</div>';
        var max = 0;
        items.forEach(function(i) { if ((i.value || 0) > max) max = i.value; });
        max = max || 1;
        return items.map(function(i) {
            var pct = Math.round(((i.value || 0) / max) * 100);
            return '<div style="margin-bottom:8px">' +
                '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">' +
                '<span style="color:#475569">' + esc(i.label) + '</span>' +
                '<span style="color:#0f172a;font-weight:700">' + esc(i.value) + '</span></div>' +
                '<div style="background:#f1f5f9;border-radius:3px;height:8px;overflow:hidden">' +
                '<div style="background:#3b82f6;height:100%;width:' + pct + '%"></div></div></div>';
        }).join('');
    }

    function funnel(stages) {
        stages = stages || [];
        if (!stages.length) return '<div style="color:#94a3b8;font-size:12px;padding:8px 0">No requests yet</div>';
        var max = 0;
        stages.forEach(function(s) { if ((s.value || 0) > max) max = s.value; });
        max = max || 1;
        return stages.map(function(s) {
            var pct = Math.max(2, Math.round(((s.value || 0) / max) * 100));
            return '<div class="funnel-row">' +
                '<div class="lab">' + esc(s.label) + '</div>' +
                '<div class="bar"><div class="fill" style="width:' + pct + '%">' +
                ((s.value || 0) > 0 ? esc(s.value) : '') + '</div></div>' +
                '<div class="num">' + esc(s.value || 0) + '</div></div>';
        }).join('');
    }

    function render(d) {
        d = d || {};
        var k = d.kpis || {};
        var meta = d.project_meta || {};
        var html = '';

        // Project / scope header
        if (d.scope === 'project' && meta.name) {
            html += '<div class="card">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
                '<div><div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:600">Project</div>' +
                '<div style="font-size:16px;font-weight:800;color:#0f172a">' + esc(meta.name) +
                (meta.project_name ? ' <span style="color:#64748b;font-weight:500">— ' + esc(meta.project_name) + '</span>' : '') +
                '</div></div>' +
                '<div style="font-size:12px;color:#64748b">Status: <b>' + esc(meta.status || '—') + '</b></div>' +
                '</div></div>';
        } else {
            html += '<div class="card" style="background:#0f1623;color:#e2e8f0;border:none">' +
                '<div style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600">Scope</div>' +
                '<div style="font-size:16px;font-weight:800;color:#fff">All Shipments — Global View</div>' +
                '<div style="font-size:11px;color:#94a3b8;margin-top:2px">All Logistics Requests across every project</div>' +
                '</div>';
        }

        // KPIs (5)
        html += '<div class="k5">' +
            kc('Active', k.active_total || 0, 'In progress', '#2563eb',
               '/app/logistics-request?workflow_state=%5B%22not%20in%22%2C%5B%22Delivered%22%2C%22Rejected%22%5D%5D') +
            kc('Pending Rate Approval', k.pending_rate_approval || 0, 'Awaiting GM/Ops', '#f59e0b',
               '/app/logistics-request?workflow_state=Rates%20Submitted') +
            kc('Pending PO', k.pending_po_approval || 0, 'Rates approved, no PO yet', '#8b5cf6',
               '/app/logistics-request?workflow_state=Rates%20Approved') +
            kc('Aging Alerts', k.aging_count || 0, 'Stuck >3 days', '#dc2626') +
            kc('Delivered This Week', k.delivered_week || 0, 'Last 7 days', '#16a34a',
               '/app/logistics-request?workflow_state=Delivered') +
            '</div>';

        // Stage funnel + Aging alerts
        html += '<div class="g2">' +
            '<div class="card"><div class="ch"><div><div class="ct">Pipeline Funnel</div>' +
            '<div class="cs">Active requests at each stage</div></div></div>' +
            funnel(d.stage_funnel) + '</div>' +
            '<div class="card"><div class="ch"><div><div class="ct">Aging Alerts</div>' +
            '<div class="cs">Requests stuck at current stage &gt;3 days</div></div></div>';
        var alerts = d.aging_alerts || [];
        if (!alerts.length) {
            html += '<div style="color:#16a34a;font-size:12px;padding:8px 0;font-weight:600">✓ No aging alerts — all stages moving</div>';
        } else {
            alerts.forEach(function(a) {
                html += '<div class="alert-row">' +
                    '<div><b>' + open_lr(a.name) + '</b> — ' + esc(a.shipment_reference || '—') +
                    ' <span style="color:#64748b">@ ' + esc(a.stage) + '</span></div>' +
                    '<div style="font-weight:700;color:#b91c1c">' + esc(a.days_at_stage) + ' days</div></div>';
            });
        }
        html += '</div></div>';

        // Pending Rate Approval + Pending PO Approval
        html += '<div class="g2">';
        html += '<div class="card"><div class="ch"><div><div class="ct">Pending Rate Approval</div>' +
            '<div class="cs">Awaiting GM/Ops — ticked quote required</div></div></div>';
        var pra = d.pending_rate_approval || [];
        if (!pra.length) html += '<div style="color:#94a3b8;font-size:12px;padding:8px 0">Nothing pending</div>';
        else {
            pra.forEach(function(r) {
                html += '<div class="pending-row">' +
                    '<div><b>' + open_lr(r.name) + '</b> — ' + esc(r.shipment_reference || '—') +
                    ' ' + urgency_badge(r.urgency) + '</div>' +
                    '<div style="font-size:11px;color:#64748b">' + esc(r.requested_by || '—') + '</div></div>';
            });
        }
        html += '</div>';

        html += '<div class="card"><div class="ch"><div><div class="ct">Pending PO</div>' +
            '<div class="cs">Rates approved, PO not yet raised</div></div></div>';
        var ppa = d.pending_po_approval || [];
        if (!ppa.length) html += '<div style="color:#94a3b8;font-size:12px;padding:8px 0">Nothing pending</div>';
        else {
            ppa.forEach(function(r) {
                html += '<div class="pending-row">' +
                    '<div><b>' + open_lr(r.name) + '</b> — ' + esc(r.shipment_reference || '—') +
                    ' ' + urgency_badge(r.urgency) + '</div>' +
                    '<div style="font-size:11px;color:#64748b">' + esc(r.selected_supplier || '—') + '</div></div>';
            });
        }
        html += '</div>';
        html += '</div>';

        // Mode + Urgency
        html += '<div class="g2">' +
            '<div class="card"><div class="ch"><div><div class="ct">Active by Mode</div></div></div>' +
            bar_chart(d.by_mode) + '</div>' +
            '<div class="card"><div class="ch"><div><div class="ct">Active by Urgency</div></div></div>' +
            bar_chart(d.by_urgency) + '</div>' +
            '</div>';

        // Active Tracking table
        var at = d.active_tracking || [];
        var at_html = '';
        if (at.length) {
            at_html = '<table><thead><tr>' +
                '<th>Request</th><th>Shipment</th><th>Stage</th><th>Tracking</th>' +
                '<th>Agent / Driver</th><th>Dispatched</th><th>ETA</th>' +
                '</tr></thead><tbody>';
            at.forEach(function(r) {
                var driver = r.driver_name ? (esc(r.driver_name) + (r.driver_phone ? ' · ' + esc(r.driver_phone) : '')) : '';
                var ad = r.agent ? esc(r.agent) : '';
                var ad_combined = [ad, driver].filter(Boolean).join('<br>') || '—';
                var trk = r.tracking_number ? (
                    '<div style="font-weight:600">' + esc(r.tracking_number) + '</div>' +
                    '<div style="font-size:10px;color:#94a3b8">' + esc(r.tracking_type || '') + '</div>'
                ) : '—';
                at_html += '<tr>' +
                    '<td>' + open_lr(r.name) + '</td>' +
                    '<td>' + esc(r.shipment_reference || '—') + '</td>' +
                    '<td>' + stage_badge(r.workflow_state) + '</td>' +
                    '<td>' + trk + '</td>' +
                    '<td style="font-size:11px">' + ad_combined + '</td>' +
                    '<td>' + esc(r.dispatch_date || '—') + '</td>' +
                    '<td>' + esc(r.expected_delivery_date || '—') + '</td>' +
                    '</tr>';
            });
            at_html += '</tbody></table>';
        } else {
            at_html = '<div style="color:#94a3b8;font-size:12px;padding:20px;text-align:center">No active tracking yet — requests appear here once PO is issued and tracking number entered.</div>';
        }
        html += '<div class="card"><div class="ch"><div><div class="ct">Active Tracking</div>' +
            '<div class="cs">In-flight shipments with container/AWB/waybill numbers</div></div></div>' +
            at_html + '</div>';

        // Delivered this week
        var dw = d.delivered_week || [];
        var dw_html = '';
        if (dw.length) {
            dw_html = '<table><thead><tr>' +
                '<th>Request</th><th>Shipment</th><th>Project</th><th>Delivered</th>' +
                '<th>Supplier</th><th>Signed DO</th>' +
                '</tr></thead><tbody>';
            dw.forEach(function(r) {
                var do_link = r.signed_do_attachment
                    ? '<a href="' + esc(r.signed_do_attachment) + '" target="_blank">View</a>'
                    : '<span style="color:#dc2626">Missing</span>';
                dw_html += '<tr>' +
                    '<td>' + open_lr(r.name) + '</td>' +
                    '<td>' + esc(r.shipment_reference || '—') + '</td>' +
                    '<td>' + esc(r.project || '—') + '</td>' +
                    '<td>' + esc(r.delivered_on || '—') + '</td>' +
                    '<td>' + esc(r.selected_supplier || '—') + '</td>' +
                    '<td>' + do_link + '</td>' +
                    '</tr>';
            });
            dw_html += '</tbody></table>';
        } else {
            dw_html = '<div style="color:#94a3b8;font-size:12px;padding:20px;text-align:center">No deliveries in the last 7 days.</div>';
        }
        html += '<div class="card"><div class="ch"><div><div class="ct">Delivered This Week</div>' +
            '<div class="cs">Closed shipments with signed DO copies</div></div></div>' +
            dw_html + '</div>';

        document.getElementById('lt-body').innerHTML = html;
    }
};
