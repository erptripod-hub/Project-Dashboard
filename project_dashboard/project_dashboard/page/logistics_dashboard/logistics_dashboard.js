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
            '.lt .k4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}' +
            '.lt .g2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;align-items:start}' +
            '.lt .card{background:#fff;border-radius:10px;padding:16px;border:1px solid #e2e8f0;margin-bottom:12px}' +
            '.lt .kc{background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #e2e8f0;border-top:4px solid #2563eb}' +
            '.lt .kc .t{font-size:10px;text-transform:uppercase;color:#64748b;font-weight:600;margin-bottom:6px}' +
            '.lt .kc .v{font-size:20px;font-weight:800;color:#0f172a}' +
            '.lt .kc .s{font-size:10px;color:#94a3b8;margin-top:4px}' +
            '.lt .ch{display:flex;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #f1f5f9}' +
            '.lt .ct{font-size:13px;font-weight:700;color:#0f172a}.lt .cs{font-size:11px;color:#94a3b8}' +
            '.lt table{width:100%;border-collapse:collapse}' +
            '.lt th{font-size:10px;text-transform:uppercase;color:#94a3b8;font-weight:600;padding:6px 8px;text-align:left;border-bottom:2px solid #f1f5f9}' +
            '.lt td{font-size:12px;padding:8px;border-bottom:1px solid #f8fafc;color:#0f172a;vertical-align:top}' +
            '.lt .badge{display:inline-flex;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600}' +
            '.lt .bg{background:#dcfce7;color:#15803d}.lt .bb{background:#dbeafe;color:#1d4ed8}' +
            '.lt .bo{background:#fff7ed;color:#c2410c}.lt .br{background:#fee2e2;color:#b91c1c}' +
            '.lt .by{background:#fef9c3;color:#854d0e}.lt .bv{background:#ede9fe;color:#6d28d9}' +
            '.lt .spark{display:flex;align-items:flex-end;gap:3px;height:60px;padding:6px 0}' +
            '.lt .spark .b{flex:1;background:#3b82f6;border-radius:2px 2px 0 0;min-height:2px}' +
            '.lt .spark .b:hover{background:#1d4ed8}';
        document.head.appendChild(s);
    }

    $(wrapper).find('.page-content').html(
        '<div class="lt">' +
        '<div style="background:#0f1623;border-radius:10px;padding:16px 22px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">' +
        '<div><h2 style="font-size:16px;font-weight:800;color:#fff;margin:0">TRIPOD MENA | <span style="color:#60a5fa">Logistics Tracker</span></h2>' +
        '<p style="font-size:11px;color:#94a3b8;margin-top:2px">Daily logs submitted by the team — view by project or all shipments</p></div>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
        '<input id="lt-inp" list="lt-dl" placeholder="Type project name or pick All Shipments..." autocomplete="off" ' +
        'style="background:#1e2a3b;border:1px solid #334155;color:#e2e8f0;padding:8px 14px;border-radius:8px;font-size:12px;min-width:280px;outline:none">' +
        '<datalist id="lt-dl"></datalist>' +
        '<a id="lt-new" href="/app/logistics-daily-log/new?log_date=' + frappe.datetime.get_today() + '" ' +
        'style="background:#2563eb;color:#fff;padding:8px 14px;border-radius:8px;font-size:12px;text-decoration:none;font-weight:600">+ New Daily Log</a>' +
        '</div>' +
        '</div>' +
        '<div id="lt-body" style="text-align:center;padding:60px;color:#64748b;font-size:13px">Select a project above, or pick "All Shipments" to view everything</div>' +
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

    function status_badge(s) {
        s = s || '';
        var cls = 'bb';
        if (s === 'Delivered') cls = 'bg';
        else if (s === 'In Transit') cls = 'bb';
        else if (s === 'On Hold' || s === 'Pending Documents') cls = 'br';
        else if (s === 'Customs Clearance') cls = 'bo';
        else if (s === 'Booked') cls = 'bv';
        else if (s === 'Planned') cls = 'by';
        return '<span class="badge ' + cls + '">' + esc(s || '—') + '</span>';
    }

    function mode_badge(m) {
        m = m || '';
        var cls = 'bb';
        if (m === 'Air') cls = 'bb';
        else if (m === 'Sea') cls = 'bv';
        else if (m === 'Land') cls = 'bo';
        else if (m === 'Courier') cls = 'bg';
        else if (m === 'Client Arrange') cls = 'by';
        return '<span class="badge ' + cls + '">' + esc(m || '—') + '</span>';
    }

    function kc(title, value, sub, color) {
        return '<div class="kc" style="border-top-color:' + color + '">' +
            '<div class="t">' + esc(title) + '</div>' +
            '<div class="v">' + esc(value) + '</div>' +
            '<div class="s">' + esc(sub) + '</div></div>';
    }

    function open_log(name) {
        return '<a href="/app/logistics-daily-log/' + encodeURIComponent(name) + '" target="_blank">' + esc(name) + '</a>';
    }

    function bar_chart(items) {
        items = items || [];
        if (!items.length) return '<div style="color:#94a3b8;font-size:12px;padding:8px 0">No data yet</div>';
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

    function spark(series) {
        series = series || [];
        if (!series.length) return '<div style="color:#94a3b8;font-size:12px;padding:8px 0">No activity yet</div>';
        var max = 0;
        series.forEach(function(p) { if ((p.value || 0) > max) max = p.value; });
        max = max || 1;
        var bars = series.map(function(p) {
            var h = Math.round(((p.value || 0) / max) * 56) + 2;
            return '<div class="b" title="' + esc(p.label) + ': ' + esc(p.value) + '" style="height:' + h + 'px"></div>';
        }).join('');
        return '<div class="spark">' + bars + '</div>' +
            '<div style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;margin-top:4px">' +
            '<span>' + esc((series[0] || {}).label || '') + '</span>' +
            '<span>' + esc((series[series.length - 1] || {}).label || '') + '</span></div>';
    }

    function render(d) {
        d = d || {};
        var k = d.kpis || {};
        var meta = d.project_meta || {};
        var html = '';

        if (d.scope === 'project' && meta.name) {
            html += '<div class="card">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
                '<div><div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:600">Project</div>' +
                '<div style="font-size:16px;font-weight:800;color:#0f172a">' + esc(meta.name) +
                (meta.project_name ? ' <span style="color:#64748b;font-weight:500">— ' + esc(meta.project_name) + '</span>' : '') +
                '</div></div>' +
                '<div style="display:flex;gap:18px;font-size:12px">' +
                '<div><div style="color:#94a3b8;text-transform:uppercase;font-size:10px">Status</div>' +
                '<div style="font-weight:700;color:#0f172a">' + esc(meta.status || '—') + '</div></div>' +
                '<div><div style="color:#94a3b8;text-transform:uppercase;font-size:10px">Start</div>' +
                '<div style="font-weight:700;color:#0f172a">' + esc(meta.expected_start_date || '—') + '</div></div>' +
                '<div><div style="color:#94a3b8;text-transform:uppercase;font-size:10px">End</div>' +
                '<div style="font-weight:700;color:#0f172a">' + esc(meta.expected_end_date || '—') + '</div></div>' +
                '</div></div></div>';
        } else {
            html += '<div class="card" style="background:#0f1623;color:#e2e8f0;border:none">' +
                '<div style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600">Scope</div>' +
                '<div style="font-size:16px;font-weight:800;color:#fff">All Shipments — Global View</div>' +
                '<div style="font-size:11px;color:#94a3b8;margin-top:2px">Aggregates submitted daily logs across every project</div>' +
                '</div>';
        }

        html += '<div class="k4">' +
            kc('Active Shipments', k.active || 0, 'Not yet delivered', '#2563eb') +
            kc('In Transit', k.in_transit || 0, 'On the move', '#0ea5e9') +
            kc('Pending Action', k.pending || 0, 'On Hold / Docs', '#dc2626') +
            kc('Updates This Week', k.rows_week || 0, 'Submitted in last 7 days', '#16a34a') +
            '</div>';

        html += '<div class="g2">' +
            '<div class="card"><div class="ch"><div><div class="ct">Shipments by Status</div>' +
            '<div class="cs">Latest status of each shipment</div></div></div>' +
            bar_chart(d.by_status) + '</div>' +
            '<div class="card"><div class="ch"><div><div class="ct">Shipments by Mode</div>' +
            '<div class="cs">How they\'re moving</div></div></div>' +
            bar_chart(d.by_mode) + '</div>' +
            '</div>';

        html += '<div class="g2">' +
            '<div class="card"><div class="ch"><div><div class="ct">Workload by Project Manager</div>' +
            '<div class="cs">Shipments currently owned</div></div></div>' +
            bar_chart(d.by_pm) + '</div>' +
            '<div class="card"><div class="ch"><div><div class="ct">Daily Activity</div>' +
            '<div class="cs">Updates submitted in last 14 days</div></div></div>' +
            spark(d.daily_series) + '</div>' +
            '</div>';

        var latest = d.latest_per_shipment || [];
        var latest_html = '';
        if (latest.length) {
            latest_html = '<table><thead><tr>' +
                '<th>Shipment</th><th>PM</th><th>Route</th><th>Mode</th><th>Agent</th>' +
                '<th>Status</th><th>ETA</th><th>Last Log</th><th>Update</th>' +
                '</tr></thead><tbody>';
            latest.forEach(function(r) {
                var route = esc(r.loading_place || '—') + ' → ' + esc(r.delivery_place || '—');
                var update_short = (r.status_update || '').substring(0, 120);
                if ((r.status_update || '').length > 120) update_short += '…';
                latest_html += '<tr>' +
                    '<td><div style="font-weight:600">' + esc(r.shipment_reference || '—') + '</div>' +
                    '<div style="font-size:10px;color:#94a3b8">' + open_log(r.daily_log) + '</div></td>' +
                    '<td>' + esc(r.project_manager || '—') + '</td>' +
                    '<td style="font-size:11px">' + route + '</td>' +
                    '<td>' + mode_badge(r.shipping_mode) + '</td>' +
                    '<td>' + esc(r.agent || '—') + '</td>' +
                    '<td>' + status_badge(r.current_status) + '</td>' +
                    '<td>' + esc(r.eta || '—') + '</td>' +
                    '<td>' + esc(r.log_date || '—') + '</td>' +
                    '<td style="max-width:280px">' + esc(update_short) + '</td>' +
                    '</tr>';
            });
            latest_html += '</tbody></table>';
        } else {
            latest_html = '<div style="color:#94a3b8;font-size:12px;padding:20px;text-align:center">No submitted entries yet. Click "+ New Daily Log" above to file today\'s log.</div>';
        }
        html += '<div class="card"><div class="ch"><div><div class="ct">Latest Status per Shipment</div>' +
            '<div class="cs">One row per shipment — most recent submitted update</div></div></div>' +
            latest_html + '</div>';

        var recent = d.recent || [];
        var recent_html = '';
        if (recent.length) {
            recent_html = '<table><thead><tr>' +
                '<th>Date</th><th>Shipment</th><th>Status</th><th>By</th><th>Update</th>' +
                '</tr></thead><tbody>';
            recent.forEach(function(r) {
                var update_short = (r.status_update || '').substring(0, 160);
                if ((r.status_update || '').length > 160) update_short += '…';
                recent_html += '<tr>' +
                    '<td>' + esc(r.log_date || '—') + '</td>' +
                    '<td>' + esc(r.shipment_reference || '—') + ' <span style="font-size:10px;color:#94a3b8">' + open_log(r.daily_log) + '</span></td>' +
                    '<td>' + status_badge(r.current_status) + '</td>' +
                    '<td>' + esc(r.logged_by || '—') + '</td>' +
                    '<td style="max-width:340px">' + esc(update_short) + '</td>' +
                    '</tr>';
            });
            recent_html += '</tbody></table>';
        } else {
            recent_html = '<div style="color:#94a3b8;font-size:12px;padding:20px;text-align:center">No recent updates.</div>';
        }
        html += '<div class="card"><div class="ch"><div><div class="ct">Recent Updates</div>' +
            '<div class="cs">Last 15 shipment-row updates</div></div></div>' +
            recent_html + '</div>';

        document.getElementById('lt-body').innerHTML = html;
    }
};
