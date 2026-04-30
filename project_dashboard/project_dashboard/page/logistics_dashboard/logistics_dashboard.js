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
            '.lt .head{background:#0f1623;border-radius:10px;padding:14px 18px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}' +
            '.lt .head h2{font-size:15px;font-weight:600;color:#fff;margin:0}' +
            '.lt .head h2 .accent{color:#60a5fa}' +
            '.lt .head p{font-size:11px;color:#94a3b8;margin:2px 0 0}' +
            '.lt .ctrls input{background:#1e2a3b;border:1px solid #334155;color:#e2e8f0;padding:6px 12px;border-radius:6px;font-size:12px;min-width:240px}' +
            '.lt .ctrls a{background:#2563eb;color:#fff;padding:6px 12px;border-radius:6px;font-size:12px;text-decoration:none;font-weight:500;margin-left:6px}' +
            '.lt .k4{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px}' +
            '.lt .kc{background:#fff;border:1px solid #e4e4e7;border-top:3px solid #2563eb;border-radius:8px;padding:12px;cursor:pointer;transition:transform .1s}' +
            '.lt .kc:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.05)}' +
            '.lt .kc .t{font-size:9px;text-transform:uppercase;color:#71717a;font-weight:600;margin-bottom:4px}' +
            '.lt .kc .v{font-size:22px;font-weight:700;color:#0f172a;line-height:1}' +
            '.lt .kc .s{font-size:10px;color:#94a3b8;margin-top:4px}' +
            '.lt .g2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}' +
            '.lt .card{background:#fff;border:1px solid #e4e4e7;border-radius:8px;padding:14px;margin-bottom:10px}' +
            '.lt .card .ch{display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #f1f5f9}' +
            '.lt .card .ct{font-size:13px;font-weight:600;color:#0f172a}' +
            '.lt .card .cs{font-size:11px;color:#94a3b8}' +
            '.lt .funnel-row{display:flex;align-items:center;gap:8px;margin-bottom:5px}' +
            '.lt .funnel-row .lab{width:140px;color:#475569;font-size:11px}' +
            '.lt .funnel-row .bar{flex:1;height:18px;background:#f1f5f9;border-radius:4px;overflow:hidden}' +
            '.lt .funnel-row .bar .fill{height:100%;background:#3b82f6;display:flex;align-items:center;justify-content:flex-end;padding-right:6px;color:#fff;font-weight:600;font-size:10px}' +
            '.lt .funnel-row .num{width:30px;text-align:right;font-weight:700;font-size:12px}' +
            '.lt .pending-row{display:flex;justify-content:space-between;padding:6px 10px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:4px;margin-bottom:4px;font-size:11px}' +
            '.lt .alert-row{display:flex;justify-content:space-between;padding:6px 10px;background:#fef2f2;border-left:3px solid #dc2626;border-radius:4px;margin-bottom:4px;font-size:11px}' +
            '.lt table{width:100%;border-collapse:collapse;font-size:11px}' +
            '.lt th{font-size:9px;text-transform:uppercase;color:#94a3b8;font-weight:600;padding:5px 6px;text-align:left;border-bottom:1px solid #f4f4f5}' +
            '.lt td{padding:6px;border-bottom:1px solid #fafaf9;vertical-align:top;font-size:11px}' +
            '.lt .badge{display:inline-flex;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600}' +
            '.lt .b-transit{background:#ede9fe;color:#6d28d9}' +
            '.lt .b-po{background:#dbeafe;color:#1d4ed8}' +
            '.lt .b-hold{background:#fee2e2;color:#b91c1c}' +
            '.lt .b-deliv{background:#dcfce7;color:#15803d}' +
            '.lt .b-await{background:#fff7ed;color:#c2410c}';
        document.head.appendChild(s);
    }

    $(wrapper).find('.page-content').html(
        '<div class="lt">' +
        '<div class="head">' +
        '<div><h2>TRIPOD MENA · <span class="accent">Logistics dashboard</span></h2>' +
        '<p>Live status across all shipments — share this URL with the team weekly</p></div>' +
        '<div class="ctrls"><input id="lt-inp" list="lt-dl" placeholder="Filter by project (or pick All)..." autocomplete="off">' +
        '<datalist id="lt-dl"></datalist>' +
        '<a href="/app/logistics-daily-board">Daily board</a>' +
        '<a href="/app/logistics-request/new">+ New</a></div>' +
        '</div>' +
        '<div id="lt-body" style="text-align:center;padding:40px;color:#94a3b8;font-size:13px">Type a project name above or pick "All shipments"</div>' +
        '</div>'
    );

    var ALL = '★ All shipments';
    window._lt_map = {}; window._lt_map[ALL] = '__ALL__';
    var dl = document.getElementById('lt-dl');
    var allOpt = document.createElement('option'); allOpt.value = ALL; dl.appendChild(allOpt);
    frappe.db.get_list('Project', {fields: ['name', 'project_name'], limit: 500, filters: {status: ['!=', 'Cancelled']}, order_by: 'modified desc'}).then(function(ps) {
        ps.forEach(function(p) {
            var o = document.createElement('option');
            o.value = p.name + ' — ' + (p.project_name || '');
            dl.appendChild(o);
            window._lt_map[o.value] = p.name;
        });
    });
    document.getElementById('lt-inp').addEventListener('change', function() {
        var v = window._lt_map[this.value];
        if (v) load(v);
    });

    function load(project) {
        document.getElementById('lt-body').innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8">Loading...</div>';
        frappe.call({
            method: 'project_dashboard.project_dashboard.page.logistics_dashboard.logistics_dashboard.get_dashboard_data',
            args: {project: project},
            callback: function(r) { if (r.message) render(r.message); }
        });
    }

    function esc(v) { if (v === null || v === undefined) return ''; return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

    function status_badge(s) {
        s = s || '';
        var cls = 'b-await';
        if (s === 'Delivered') cls = 'b-deliv';
        else if (s === 'In Transit' || s === 'Dispatched') cls = 'b-transit';
        else if (s === 'PO Issued') cls = 'b-po';
        else if (s === 'On Hold' || s === 'Pending Documents') cls = 'b-hold';
        return '<span class="badge ' + cls + '">' + esc(s) + '</span>';
    }

    function bar_chart(items, color) {
        items = items || [];
        if (!items.length) return '<div style="color:#94a3b8;font-size:11px;padding:6px 0">No data</div>';
        var max = Math.max.apply(null, items.map(function(i) { return i.value || 0; })) || 1;
        return items.map(function(i) {
            var pct = Math.max(2, Math.round((i.value / max) * 100));
            return '<div class="funnel-row"><div class="lab">' + esc(i.label) + '</div>' +
                '<div class="bar"><div class="fill" style="width:' + pct + '%' + (color ? ';background:' + color : '') + '">' + esc(i.value) + '</div></div>' +
                '<div class="num">' + esc(i.value) + '</div></div>';
        }).join('');
    }

    function open_lr(name) { return '<a href="/app/logistics-request/' + encodeURIComponent(name) + '" target="_blank" style="color:#2563eb">' + esc(name) + '</a>'; }

    function kc(t, v, s, color, href) {
        var click = href ? ' onclick="window.location=\'' + href + '\'"' : '';
        return '<div class="kc" style="border-top-color:' + color + '"' + click + '>' +
            '<div class="t">' + esc(t) + '</div><div class="v">' + esc(v) + '</div><div class="s">' + esc(s) + '</div></div>';
    }

    function render(d) {
        d = d || {}; var k = d.kpis || {}; var meta = d.project_meta || {};
        var html = '';

        if (d.scope === 'project' && meta.name) {
            html += '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
                '<div><div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:600">Project</div>' +
                '<div style="font-size:15px;font-weight:600;color:#0f172a">' + esc(meta.name) +
                (meta.project_name ? ' <span style="color:#64748b;font-weight:400">— ' + esc(meta.project_name) + '</span>' : '') +
                '</div></div></div></div>';
        } else {
            html += '<div class="card" style="background:#0f1623;color:#e2e8f0;border:none">' +
                '<div style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600">Scope</div>' +
                '<div style="font-size:15px;font-weight:600;color:#fff">All shipments — global view</div></div>';
        }

        html += '<div class="k4">' +
            kc('Active', k.active || 0, 'In progress', '#2563eb') +
            kc('Awaiting GM', k.awaiting_gm || 0, 'Action queue', '#f59e0b', '/app/logistics-request?status=Awaiting%20GM%20Approval') +
            kc('In transit', k.in_transit || 0, 'On the move', '#8b5cf6') +
            kc('On hold', k.on_hold || 0, 'Stuck — needs attention', '#dc2626', '/app/logistics-request?status=On%20Hold') +
            kc('Delivered (7d)', k.delivered_week || 0, 'Last 7 days', '#16a34a') +
            '</div>';

        html += '<div class="g2">' +
            '<div class="card"><div class="ch"><div><div class="ct">Shipments by status</div><div class="cs">From the free Status field</div></div></div>' + bar_chart(d.by_status) + '</div>' +
            '<div class="card"><div class="ch"><div><div class="ct">Active by project</div><div class="cs">Excludes delivered/cancelled</div></div></div>' + bar_chart(d.by_project) + '</div>' +
            '</div>';

        html += '<div class="g2">' +
            '<div class="card"><div class="ch"><div><div class="ct">Awaiting GM approval</div><div class="cs">Action queue</div></div></div>';
        var ag = d.awaiting_gm || [];
        if (!ag.length) html += '<div style="color:#16a34a;font-size:11px;padding:6px 0;font-weight:500">✓ Nothing pending</div>';
        else ag.forEach(function(r) {
            html += '<div class="pending-row"><div><b>' + open_lr(r.name) + '</b> — ' + esc(r.shipment_reference || '—') + '</div>' +
                '<div style="font-size:10px;color:#64748b">' + esc(r.selected_supplier || '—') + '</div></div>';
        });
        html += '</div>';

        html += '<div class="card"><div class="ch"><div><div class="ct">On hold</div><div class="cs">Needs attention</div></div></div>';
        var oh = d.on_hold || [];
        if (!oh.length) html += '<div style="color:#16a34a;font-size:11px;padding:6px 0;font-weight:500">✓ Nothing on hold</div>';
        else oh.forEach(function(r) {
            html += '<div class="alert-row"><div><b>' + open_lr(r.name) + '</b> — ' + esc(r.shipment_reference || '—') + '</div>' +
                '<div style="font-size:10px;color:#64748b">' + esc(r.tracking_number || '—') + '</div></div>';
        });
        html += '</div></div>';

        var it = d.in_transit || [];
        var it_html = '';
        if (it.length) {
            it_html = '<table><thead><tr><th>Request</th><th>Shipment</th><th>Status</th><th>Tracking</th><th>Agent / driver</th><th>Dispatched</th><th>ETA</th></tr></thead><tbody>';
            it.forEach(function(r) {
                var driver = r.driver_name ? (esc(r.driver_name) + (r.driver_phone ? ' · ' + esc(r.driver_phone) : '')) : '';
                var ad_combined = [esc(r.agent || ''), driver].filter(Boolean).join('<br>') || '—';
                var trk = r.tracking_number
                    ? '<div style="font-weight:600">' + esc(r.tracking_number) + '</div><div style="font-size:9px;color:#94a3b8">' + esc(r.tracking_type || '') + '</div>'
                    : '—';
                it_html += '<tr><td>' + open_lr(r.name) + '</td><td>' + esc(r.shipment_reference || '—') + '</td>' +
                    '<td>' + status_badge(r.status) + '</td><td>' + trk + '</td>' +
                    '<td style="font-size:11px">' + ad_combined + '</td>' +
                    '<td>' + esc(r.dispatch_date || '—') + '</td><td>' + esc(r.expected_delivery_date || '—') + '</td></tr>';
            });
            it_html += '</tbody></table>';
        } else it_html = '<div style="color:#94a3b8;font-size:11px;padding:14px;text-align:center">No active tracking</div>';
        html += '<div class="card"><div class="ch"><div><div class="ct">Active tracking</div><div class="cs">In-flight shipments — copy-paste ready for client updates</div></div></div>' + it_html + '</div>';

        var dw = d.delivered_week || [];
        var dw_html = '';
        if (dw.length) {
            dw_html = '<table><thead><tr><th>Request</th><th>Shipment</th><th>Project</th><th>Delivered</th><th>Supplier</th><th>Signed DO</th></tr></thead><tbody>';
            dw.forEach(function(r) {
                var doc = r.signed_do_attachment ? '<a href="' + esc(r.signed_do_attachment) + '" target="_blank" style="color:#2563eb">View</a>' : '<span style="color:#dc2626">Missing</span>';
                dw_html += '<tr><td>' + open_lr(r.name) + '</td><td>' + esc(r.shipment_reference || '—') + '</td>' +
                    '<td>' + esc(r.project || '—') + '</td><td>' + esc(r.delivered_on || '—') + '</td>' +
                    '<td>' + esc(r.selected_supplier || '—') + '</td><td>' + doc + '</td></tr>';
            });
            dw_html += '</tbody></table>';
        } else dw_html = '<div style="color:#94a3b8;font-size:11px;padding:14px;text-align:center">No deliveries in last 7 days</div>';
        html += '<div class="card"><div class="ch"><div><div class="ct">Delivered this week</div><div class="cs">Closed shipments with signed DO copies</div></div></div>' + dw_html + '</div>';

        document.getElementById('lt-body').innerHTML = html;
    }

    // Auto-load All on first render
    setTimeout(function() { load('__ALL__'); }, 100);
};
