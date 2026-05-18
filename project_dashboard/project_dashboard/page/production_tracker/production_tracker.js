frappe.pages['production-tracker'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Production Tracker Dashboard',
        single_column: true
    });

    if (!document.getElementById('pt-style')) {
        var s = document.createElement('style');
        s.id = 'pt-style';
        s.textContent =
            '.pt{padding:16px;background:#f0f4f8;min-height:100vh;margin:-15px}' +
            '.pt .head{background:#0f1623;border-radius:10px;padding:14px 18px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}' +
            '.pt .head h2{font-size:15px;font-weight:600;color:#fff;margin:0}' +
            '.pt .head h2 .accent{color:#fbbf24}' +
            '.pt .head p{font-size:11px;color:#94a3b8;margin:2px 0 0}' +
            '.pt .ctrls input{background:#1e2a3b;border:1px solid #334155;color:#e2e8f0;padding:6px 12px;border-radius:6px;font-size:12px;min-width:240px}' +
            '.pt .ctrls a{background:#2563eb;color:#fff;padding:6px 12px;border-radius:6px;font-size:12px;text-decoration:none;font-weight:500;margin-left:6px}' +
            '.pt .k7{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:10px}' +
            '.pt .kc{background:#fff;border:1px solid #e4e4e7;border-top:3px solid #2563eb;border-radius:8px;padding:10px;cursor:pointer;transition:transform .1s}' +
            '.pt .kc:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.05)}' +
            '.pt .kc .t{font-size:8px;text-transform:uppercase;color:#71717a;font-weight:600;margin-bottom:4px}' +
            '.pt .kc .v{font-size:18px;font-weight:700;color:#0f172a;line-height:1}' +
            '.pt .kc .s{font-size:9px;color:#94a3b8;margin-top:3px}' +
            '.pt .g2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}' +
            '.pt .g3{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:10px;margin-bottom:12px}' +
            '.pt .card{background:#fff;border:1px solid #e4e4e7;border-radius:8px;padding:14px;margin-bottom:10px}' +
            '.pt .card .ch{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #f1f5f9}' +
            '.pt .card .ct{font-size:13px;font-weight:600;color:#0f172a}' +
            '.pt .card .cs{font-size:11px;color:#94a3b8}' +
            '.pt .completion-banner{background:linear-gradient(135deg,#1e3a8a,#1e40af);color:#fff;border-radius:10px;padding:18px 22px;margin-bottom:10px;display:grid;grid-template-columns:1fr auto;gap:22px;align-items:center}' +
            '.pt .completion-banner .lab{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:rgba(255,255,255,.7);font-weight:500;margin-bottom:4px}' +
            '.pt .completion-banner .pct{font-size:36px;font-weight:700;line-height:1;letter-spacing:-.02em}' +
            '.pt .completion-banner .bar{width:100%;margin-top:12px;height:6px;background:rgba(255,255,255,.18);border-radius:3px;overflow:hidden}' +
            '.pt .completion-banner .fill{height:100%;background:#fbbf24;border-radius:3px}' +
            '.pt .completion-banner .meta{text-align:right;font-size:12px;color:rgba(255,255,255,.85);line-height:1.7}' +
            '.pt .completion-banner .meta strong{color:#fff;font-weight:600}' +
            '.pt .stage-row{display:flex;align-items:center;gap:10px;margin-bottom:6px;padding:6px 0}' +
            '.pt .stage-row .lab{width:120px;font-size:12px;color:#475569;font-weight:500}' +
            '.pt .stage-row .bar{flex:1;height:18px;background:#f1f5f9;border-radius:4px;overflow:hidden}' +
            '.pt .stage-row .bar .fill{height:100%;display:flex;align-items:center;justify-content:flex-end;padding-right:6px;color:#fff;font-weight:600;font-size:10px}' +
            '.pt .stage-row .bar .fill.lo{background:#94a3b8}' +
            '.pt .stage-row .bar .fill.mid{background:#3b82f6}' +
            '.pt .stage-row .bar .fill.hi{background:#16a34a}' +
            '.pt .stage-row .num{width:42px;text-align:right;font-weight:700;font-size:12px;font-family:monospace}' +
            '.pt .stage-row .dept{font-size:10px;color:#94a3b8;width:120px}' +
            '.pt .insp-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}' +
            '.pt .insp{border:1px solid #e4e4e7;border-radius:6px;padding:10px 12px;background:#fff}' +
            '.pt .insp.pass{border-color:#16a34a;background:#f0fdf4}' +
            '.pt .insp.sched{border-color:#d97706;background:#fffbeb}' +
            '.pt .insp.fail{border-color:#dc2626;background:#fef2f2}' +
            '.pt .insp.pend{background:#f3f4f6}' +
            '.pt .insp .ititle{font-size:10px;font-weight:600;text-transform:uppercase;color:#64748b;margin-bottom:4px}' +
            '.pt .insp .istat{font-size:13px;font-weight:600;margin-bottom:2px}' +
            '.pt .insp.pass .istat{color:#16a34a}' +
            '.pt .insp.sched .istat{color:#d97706}' +
            '.pt .insp.fail .istat{color:#dc2626}' +
            '.pt .insp.pend .istat{color:#94a3b8}' +
            '.pt .insp .imeta{font-size:10px;color:#94a3b8}' +
            '.pt .alert-row{display:flex;justify-content:space-between;padding:8px 10px;background:#fef2f2;border-left:3px solid #dc2626;border-radius:4px;margin-bottom:4px;font-size:11px}' +
            '.pt .alert-row.warn{background:#fffbeb;border-left-color:#d97706}' +
            '.pt .alert-row.info{background:#eff6ff;border-left-color:#3b82f6}' +
            '.pt .feed-item{padding:10px 0;border-bottom:1px solid #f1f5f9;display:grid;grid-template-columns:80px 1fr;gap:12px}' +
            '.pt .feed-item:last-child{border-bottom:none}' +
            '.pt .feed-date{font-size:10px;color:#94a3b8;font-weight:500}' +
            '.pt .feed-date strong{display:block;font-size:11px;color:#0f172a;font-weight:600}' +
            '.pt .feed-content{font-size:12px;color:#334155;line-height:1.5}' +
            '.pt .feed-author{font-size:10px;color:#94a3b8;margin-top:3px}' +
            '.pt table{width:100%;border-collapse:collapse;font-size:11px}' +
            '.pt th{font-size:9px;text-transform:uppercase;color:#94a3b8;font-weight:600;padding:5px 6px;text-align:left;border-bottom:1px solid #f4f4f5}' +
            '.pt td{padding:6px;border-bottom:1px solid #fafaf9;vertical-align:top;font-size:11px}' +
            '.pt .progress-mini{display:inline-block;width:80px;height:8px;background:#f1f5f9;border-radius:4px;overflow:hidden;vertical-align:middle;margin-right:6px}' +
            '.pt .progress-mini .fill{height:100%;background:#3b82f6;border-radius:4px}' +
            '.pt .badge{display:inline-flex;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600}' +
            '.pt .b-prod{background:#dbeafe;color:#1d4ed8}' +
            '.pt .b-qc{background:#fef3c7;color:#92400e}' +
            '.pt .b-block{background:#fee2e2;color:#b91c1c}' +
            '.pt .b-dwg{background:#ede9fe;color:#6d28d9}' +
            '.pt .b-rdy{background:#dcfce7;color:#15803d}' +
            '.pt .b-pend{background:#f3f4f6;color:#64748b}' +
            '.pt .b-disp{background:#cffafe;color:#0e7490}';
        document.head.appendChild(s);
    }

    $(wrapper).find('.page-content').html(
        '<div class="pt">' +
        '<div class="head">' +
        '<div><h2>TRIPOD MENA · <span class="accent">Production tracker</span></h2>' +
        '<p>Live joinery production progress across all projects</p></div>' +
        '<div class="ctrls"><input id="pt-inp" list="pt-dl" placeholder="Filter by project (or pick All)..." autocomplete="off">' +
        '<datalist id="pt-dl"></datalist>' +
        '<a href="/app/project-production-plan/new">+ New Plan</a></div>' +
        '</div>' +
        '<div id="pt-body" style="text-align:center;padding:40px;color:#94a3b8;font-size:13px">Loading...</div>' +
        '</div>'
    );

    var ALL = '★ All projects';
    window._pt_map = {}; window._pt_map[ALL] = '__ALL__';
    var dl = document.getElementById('pt-dl');
    var allOpt = document.createElement('option'); allOpt.value = ALL; dl.appendChild(allOpt);
    frappe.db.get_list('Project', {fields: ['name', 'project_name'], limit: 500, filters: {status: ['!=', 'Cancelled']}, order_by: 'modified desc'}).then(function(ps) {
        ps.forEach(function(p) {
            var o = document.createElement('option');
            o.value = p.name + ' — ' + (p.project_name || '');
            dl.appendChild(o);
            window._pt_map[o.value] = p.name;
        });
    });
    document.getElementById('pt-inp').addEventListener('change', function() {
        var v = window._pt_map[this.value];
        if (v) load(v);
    });

    function load(project) {
        document.getElementById('pt-body').innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8">Loading...</div>';
        frappe.call({
            method: 'project_dashboard.project_dashboard.page.production_tracker.production_tracker.get_dashboard_data',
            args: {project: project},
            callback: function(r) { if (r.message) render(r.message); }
        });
    }

    function esc(v) {
        if (v === null || v === undefined) return '';
        return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function status_badge(s) {
        s = s || '';
        var cls = 'b-pend';
        if (s === 'In Production') cls = 'b-prod';
        else if (s === 'In QC') cls = 'b-qc';
        else if (s === 'Drawing Pending' || s === 'Awaiting Kickoff') cls = 'b-dwg';
        else if (s === 'Ready to Dispatch') cls = 'b-rdy';
        else if (s === 'Dispatched' || s === 'Installed' || s === 'Closed') cls = 'b-disp';
        return '<span class="badge ' + cls + '">' + esc(s) + '</span>';
    }

    function pct_class(pct) {
        if (pct >= 70) return 'hi';
        if (pct >= 30) return 'mid';
        return 'lo';
    }

    function kc(t, v, sub, color, href) {
        var click = href ? ' onclick="window.location=\'' + href + '\'"' : '';
        return '<div class="kc" style="border-top-color:' + color + '"' + click + '>' +
            '<div class="t">' + esc(t) + '</div><div class="v">' + esc(v) + '</div><div class="s">' + esc(sub) + '</div></div>';
    }

    function open_pp(name) {
        return '<a href="/app/project-production-plan/' + encodeURIComponent(name) + '" target="_blank" style="color:#2563eb">' + esc(name) + '</a>';
    }

    function open_project(name) {
        return '<a href="/app/project/' + encodeURIComponent(name) + '" target="_blank" style="color:#2563eb">' + esc(name) + '</a>';
    }

    function render(d) {
        if (d.scope === 'all') return render_all(d);
        return render_project(d);
    }

    // ----- ALL-PROJECTS VIEW -----
    function render_all(d) {
        d = d || {}; var k = d.kpis || {};
        var html = '';

        // 7 KPIs
        html += '<div class="k7">' +
            kc('Open Plans', k.open_plans || 0, 'Active production', '#2563eb') +
            kc('Drawing Pending', k.drawing_pending || 0, 'Waiting for drawings', '#7c3aed') +
            kc('In Production', k.in_production || 0, 'On the floor', '#3b82f6') +
            kc('In QC', k.in_qc || 0, 'Under inspection', '#d97706') +
            kc('Ready to Dispatch', k.ready_dispatch || 0, 'Packed', '#16a34a') +
            kc('Blocked', k.blocked || 0, 'Material/rework issues', '#dc2626') +
            kc('Avg Completion', (k.avg_completion || 0) + '%', 'Across active plans', '#0ea5e9') +
            '</div>';

        // Two-column layout: left = active plans table, right = alerts + inspections
        html += '<div class="g3">' +
            '<div>' +
                '<div class="card">' +
                    '<div class="ch"><div><div class="ct">Active Projects</div><div class="cs">' + (d.active_plans || []).length + ' open plans · sorted by progress</div></div></div>' +
                    render_active_plans_table(d.active_plans || []) +
                '</div>' +
            '</div>' +

            '<div>' +
                '<div class="card">' +
                    '<div class="ch"><div><div class="ct">Inspections Due</div><div class="cs">' + (d.inspections_due || []).length + ' upcoming or overdue</div></div></div>' +
                    render_inspections_due(d.inspections_due || []) +
                '</div>' +
                '<div class="card">' +
                    '<div class="ch"><div><div class="ct">Recent Drawing Changes</div><div class="cs">Last 14 days</div></div></div>' +
                    render_drawing_changes(d.drawing_changes_recent || []) +
                '</div>' +
            '</div>' +

            '<div>' +
                '<div class="card">' +
                    '<div class="ch"><div><div class="ct">Recent Updates</div><div class="cs">Last 7 days · all projects</div></div></div>' +
                    render_recent_updates(d.recent_updates || []) +
                '</div>' +
            '</div>' +
        '</div>';

        document.getElementById('pt-body').innerHTML = html;
    }

    function render_active_plans_table(plans) {
        if (!plans.length) return '<div style="padding:20px;text-align:center;color:#94a3b8">No active production plans</div>';
        var rows = plans.map(function(p) {
            var pct = parseFloat(p.overall_joinery_completion_pct || 0);
            return '<tr>' +
                '<td>' + open_project(p.project) + '</td>' +
                '<td>' + status_badge(p.overall_status) + '</td>' +
                '<td><span class="progress-mini"><span class="fill" style="width:' + pct + '%;background:' + (pct >= 70 ? '#16a34a' : (pct >= 30 ? '#3b82f6' : '#94a3b8')) + '"></span></span>' + pct.toFixed(0) + '%</td>' +
                '<td>' + esc(p.production_manager || '—') + '</td>' +
                '<td>' + esc(p.target_dispatch_date || '—') + '</td>' +
                '<td>' + open_pp(p.name) + '</td>' +
            '</tr>';
        }).join('');
        return '<table><thead><tr><th>Project</th><th>Status</th><th>Completion</th><th>Prod Mgr</th><th>Target</th><th>Plan</th></tr></thead><tbody>' + rows + '</tbody></table>';
    }

    function render_inspections_due(items) {
        if (!items.length) return '<div style="padding:10px;text-align:center;color:#94a3b8;font-size:11px">No upcoming inspections</div>';
        return items.map(function(i) {
            var sd = i.scheduled_date || '';
            var overdue = sd && sd < (new Date().toISOString().slice(0,10));
            return '<div class="alert-row ' + (overdue ? '' : 'warn') + '">' +
                '<span><strong>' + esc(i.inspection_type) + '</strong> · ' + esc(i.project || '—') + '</span>' +
                '<span style="color:' + (overdue ? '#b91c1c' : '#92400e') + ';font-weight:600">' + esc(sd) + (overdue ? ' · OVERDUE' : '') + '</span>' +
            '</div>';
        }).join('');
    }

    function render_drawing_changes(items) {
        if (!items.length) return '<div style="padding:10px;text-align:center;color:#94a3b8;font-size:11px">No recent drawing changes</div>';
        return items.map(function(c) {
            return '<div class="alert-row info">' +
                '<span><strong>' + esc(c.item_changed || 'Drawing') + '</strong> · ' + esc(c.project || '—') + ' · ' + esc(c.what_changed || '') + '</span>' +
                '<span style="color:#1d4ed8;font-weight:600">' + esc(c.change_date) + '</span>' +
            '</div>';
        }).join('');
    }

    function render_recent_updates(items) {
        if (!items.length) return '<div style="padding:10px;text-align:center;color:#94a3b8;font-size:11px">No recent updates</div>';
        return items.map(function(u) {
            var type_cls = 'b-prod';
            if (u.update_type === 'QC') type_cls = 'b-qc';
            else if (u.update_type === 'Blocker') type_cls = 'b-block';
            else if (u.update_type === 'Drawing Change') type_cls = 'b-dwg';
            return '<div class="feed-item">' +
                '<div class="feed-date"><strong>' + esc(u.update_date) + '</strong>' + esc(u.project || '—') + '</div>' +
                '<div class="feed-content">' +
                    '<span class="badge ' + type_cls + '">' + esc(u.update_type) + '</span> ' +
                    esc(u.update_text) +
                    '<div class="feed-author">— ' + esc(u.updated_by || 'system') + '</div>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    // ----- PROJECT DRILL-IN VIEW -----
    function render_project(d) {
        d = d || {}; var meta = d.project_meta || {};
        var html = '';

        if (!d.plan_exists) {
            html += '<div class="card" style="text-align:center;padding:40px">' +
                '<div style="font-size:14px;color:#0f172a;font-weight:600;margin-bottom:8px">No Production Plan for this project yet</div>' +
                '<div style="font-size:12px;color:#64748b;margin-bottom:14px">A plan should auto-create on Project insert. If you don\'t see one, create manually.</div>' +
                '<a href="/app/project-production-plan/new?project=' + encodeURIComponent(meta.name) + '" style="background:#2563eb;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none;font-size:12px">+ Create Plan</a>' +
            '</div>';
            document.getElementById('pt-body').innerHTML = html;
            return;
        }

        var h = d.header || {};

        // Project header card
        html += '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px">' +
            '<div><div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:600">Project</div>' +
            '<div style="font-size:16px;font-weight:600;color:#0f172a">' + esc(meta.name) +
            (meta.project_name ? ' <span style="color:#64748b;font-weight:400">— ' + esc(meta.project_name) + '</span>' : '') +
            '</div><div style="margin-top:6px">' + status_badge(h.overall_status) + '</div></div>' +
            '<div style="font-size:11px;color:#64748b">' +
                'PM: <strong style="color:#0f172a">' + esc(h.project_manager || '—') + '</strong> · ' +
                'Prod Mgr: <strong style="color:#0f172a">' + esc(h.production_manager || '—') + '</strong> · ' +
                'QC: <strong style="color:#0f172a">' + esc(h.qc_lead || '—') + '</strong>' +
            '</div>' +
            '<div style="font-size:11px;color:#64748b;text-align:right">' +
                'Kickoff: <strong style="color:#0f172a">' + esc(h.kickoff_date || '—') + '</strong><br>' +
                'Target: <strong style="color:#0f172a">' + esc(h.target_dispatch_date || '—') + '</strong>' +
                (h.revised_dispatch_date ? ' · <strong style="color:#d97706">Revised: ' + esc(h.revised_dispatch_date) + '</strong>' : '') +
            '</div>' +
            '<div><a href="/app/project-production-plan/' + encodeURIComponent(h.plan_name) + '" target="_blank" style="background:#2563eb;color:#fff;padding:6px 12px;border-radius:6px;text-decoration:none;font-size:11px">Open Plan</a></div>' +
        '</div></div>';

        // Overall completion banner
        var pct = parseFloat(h.overall_joinery_completion_pct || 0);
        html += '<div class="completion-banner">' +
            '<div>' +
                '<div class="lab">Overall Joinery Completion</div>' +
                '<div class="pct">' + pct.toFixed(0) + '%</div>' +
                '<div class="bar"><div class="fill" style="width:' + pct + '%"></div></div>' +
            '</div>' +
            '<div class="meta">' +
                '<div><strong>' + (d.stages || []).length + '</strong> stages defined</div>' +
                '<div><strong>' + (d.fixtures || []).length + '</strong> fixtures tracked</div>' +
                '<div><strong>' + (d.alerts || []).length + '</strong> alerts</div>' +
            '</div>' +
        '</div>';

        // Stages + Inspections (two columns)
        html += '<div class="g2">' +
            '<div class="card">' +
                '<div class="ch"><div><div class="ct">Production Stages</div><div class="cs">' + (d.stages || []).length + ' stages · % manually entered</div></div></div>' +
                render_stages(d.stages || []) +
            '</div>' +
            '<div class="card">' +
                '<div class="ch"><div><div class="ct">Stage Inspections</div><div class="cs">SOP — 4 checkpoints</div></div></div>' +
                render_inspections(d.inspections || []) +
            '</div>' +
        '</div>';

        // Alerts (if any)
        if ((d.alerts || []).length) {
            html += '<div class="card">' +
                '<div class="ch"><div><div class="ct">Alerts &amp; Blockers</div><div class="cs">Auto-detected from fixtures and inspections</div></div></div>' +
                (d.alerts || []).map(function(a) {
                    var cls = a.type === 'inspection_overdue' || a.type === 'rework' ? '' : 'warn';
                    return '<div class="alert-row ' + cls + '">' +
                        '<span><strong>' + esc(a.title) + '</strong></span>' +
                        '<span style="color:#64748b">' + esc(a.sub) + '</span>' +
                    '</div>';
                }).join('') +
            '</div>';
        }

        // Two columns: Daily Updates + Drawing Changes
        html += '<div class="g2">' +
            '<div class="card">' +
                '<div class="ch"><div><div class="ct">Daily Updates</div><div class="cs">Last 30 days</div></div></div>' +
                render_daily_updates(d.daily_updates || []) +
            '</div>' +
            '<div class="card">' +
                '<div class="ch"><div><div class="ct">Drawing Changes</div><div class="cs">All revisions logged</div></div></div>' +
                render_drawing_change_log(d.drawing_changes || []) +
            '</div>' +
        '</div>';

        // Fixtures table
        if ((d.fixtures || []).length) {
            html += '<div class="card">' +
                '<div class="ch"><div><div class="ct">Fixtures</div><div class="cs">' + (d.fixtures || []).length + ' items being produced</div></div></div>' +
                render_fixtures(d.fixtures || []) +
            '</div>';
        }

        document.getElementById('pt-body').innerHTML = html;
    }

    function render_stages(stages) {
        if (!stages.length) return '<div style="padding:10px;text-align:center;color:#94a3b8;font-size:11px">No stages defined yet. Open the plan and add stages.</div>';
        return stages.map(function(s) {
            var pct = parseFloat(s.completion_percentage || 0);
            return '<div class="stage-row">' +
                '<div class="lab">' + esc(s.stage_name) + '</div>' +
                '<div class="bar"><div class="fill ' + pct_class(pct) + '" style="width:' + Math.max(pct, 1) + '%">' + (pct > 8 ? pct.toFixed(0) + '%' : '') + '</div></div>' +
                '<div class="num">' + pct.toFixed(0) + '%</div>' +
            '</div>';
        }).join('');
    }

    function render_inspections(items) {
        // Order them by SOP sequence regardless of input order
        var order = {'1st - Joinery': 1, '2nd - Paint': 2, 'Pre-Final (Internal)': 3, 'Final (with Client)': 4};
        items = items.slice().sort(function(a, b) {
            return (order[a.inspection_type] || 99) - (order[b.inspection_type] || 99);
        });
        // Fill missing SOP slots so user always sees 4 boxes
        var by_type = {};
        items.forEach(function(i) { by_type[i.inspection_type] = i; });
        var slots = ['1st - Joinery', '2nd - Paint', 'Pre-Final (Internal)', 'Final (with Client)'];
        var html = '<div class="insp-grid">';
        slots.forEach(function(t) {
            var i = by_type[t];
            var cls = 'pend';
            var stat = 'Pending';
            if (i) {
                if (i.result === 'Pass') { cls = 'pass'; stat = 'Passed'; }
                else if (i.result === 'Pass with Issues') { cls = 'pass'; stat = 'Pass w/ Issues'; }
                else if (i.result === 'Fail') { cls = 'fail'; stat = 'Failed'; }
                else if (i.result === 'Scheduled') { cls = 'sched'; stat = 'Scheduled'; }
            }
            html += '<div class="insp ' + cls + '">' +
                '<div class="ititle">' + esc(t) + '</div>' +
                '<div class="istat">' + esc(stat) + '</div>' +
                '<div class="imeta">' + (i ? (esc(i.scheduled_date || '—') + ' · ' + esc(i.inspector || '—')) : 'Not scheduled') + '</div>' +
            '</div>';
        });
        html += '</div>';
        return html;
    }

    function render_daily_updates(items) {
        if (!items.length) return '<div style="padding:10px;text-align:center;color:#94a3b8;font-size:11px">No updates yet</div>';
        return items.map(function(u) {
            var type_cls = 'b-prod';
            if (u.update_type === 'QC') type_cls = 'b-qc';
            else if (u.update_type === 'Blocker') type_cls = 'b-block';
            else if (u.update_type === 'Drawing Change') type_cls = 'b-dwg';
            return '<div class="feed-item">' +
                '<div class="feed-date"><strong>' + esc(u.update_date) + '</strong></div>' +
                '<div class="feed-content">' +
                    '<span class="badge ' + type_cls + '">' + esc(u.update_type) + '</span> ' +
                    esc(u.update_text) +
                    (u.affected_fixtures ? '<div style="font-size:10px;color:#94a3b8;margin-top:2px">Fixtures: ' + esc(u.affected_fixtures) + '</div>' : '') +
                    '<div class="feed-author">— ' + esc(u.updated_by || 'system') + '</div>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    function render_drawing_change_log(items) {
        if (!items.length) return '<div style="padding:10px;text-align:center;color:#94a3b8;font-size:11px">No drawing changes logged</div>';
        return items.map(function(c) {
            return '<div class="feed-item">' +
                '<div class="feed-date"><strong>' + esc(c.change_date) + '</strong>' + (c.pm_notified ? '<span style="color:#16a34a">✓ PM</span>' : '<span style="color:#dc2626">PM not notified</span>') + '</div>' +
                '<div class="feed-content">' +
                    '<strong>' + esc(c.item_changed || '—') + '</strong>: ' + esc(c.what_changed || '') +
                    (c.revised_completion_date ? '<div style="font-size:10px;color:#d97706;margin-top:2px">→ Revised completion: ' + esc(c.revised_completion_date) + '</div>' : '') +
                '</div>' +
            '</div>';
        }).join('');
    }

    function render_fixtures(fixtures) {
        var rows = fixtures.map(function(f) {
            var mat_badge = '';
            if (f.material_status === 'Blocked') mat_badge = '<span class="badge b-block">Blocked</span>';
            else if (f.material_status === 'Pending') mat_badge = '<span class="badge b-qc">Pending</span>';
            else mat_badge = '<span class="badge b-rdy">OK</span>';
            return '<tr>' +
                '<td><strong>' + esc(f.fixture_name) + '</strong></td>' +
                '<td>' + esc(f.quantity_required || 0) + '</td>' +
                '<td>' + esc(f.quantity_completed || 0) + '</td>' +
                '<td>' + esc(f.current_stage || '—') + '</td>' +
                '<td>' + mat_badge + '</td>' +
                '<td>' + esc(f.drawing_revision || '—') + '</td>' +
                '<td>' + (f.rework_required ? '<span class="badge b-block">Yes</span>' : '<span style="color:#94a3b8">—</span>') + '</td>' +
                '<td style="color:#64748b">' + esc(f.notes || '') + '</td>' +
            '</tr>';
        }).join('');
        return '<table><thead><tr><th>Fixture</th><th>Qty Req</th><th>Qty Done</th><th>Stage</th><th>Material</th><th>Drawing</th><th>Rework</th><th>Notes</th></tr></thead><tbody>' + rows + '</tbody></table>';
    }

    // Initial load - all projects
    load('__ALL__');
};
