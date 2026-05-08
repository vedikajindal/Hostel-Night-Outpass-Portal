let pendingAction = { id: null, type: null };

window.addEventListener('load', async () => {
    await guardPage('warden');
    loadStats();
    loadPendingQuick();
});

async function guardPage(expectedRole) {
    try {
        const res  = await fetch('/api/auth/me', { credentials: 'include' });
        const data = await res.json();
        if (!data.success || data.user.role !== expectedRole) {
            window.location.href = '/';
        } else {
            document.getElementById('nav-username').textContent = data.user.user_id;
        }
    } catch { window.location.href = '/'; }
}

function showSection(name) {
    document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
    document.getElementById('section-' + name).classList.remove('hidden');
    document.getElementById('nav-' + name).classList.add('active');
    if (name === 'requests') loadRequests();
    if (name === 'logs')     loadLogs();
    if (name === 'profile')  loadProfile();
    if (name === 'dashboard') { loadStats(); loadPendingQuick(); }
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/';
}

async function loadStats() {
    const res  = await fetch('/api/warden/stats', { credentials: 'include' });
    const data = await res.json();
    if (!data.success) return;
    const s = data.stats;
    document.getElementById('stat-total').textContent     = s.total         || 0;
    document.getElementById('stat-pending').textContent   = s.pending        || 0;
    document.getElementById('stat-approved').textContent  = s.approved       || 0;
    document.getElementById('stat-rejected').textContent  = s.rejected       || 0;
    document.getElementById('stat-pverified').textContent = s.parent_verified || 0;
    document.getElementById('stat-today').textContent     = s.total_today     || 0;
}

async function loadPendingQuick() {
    const res  = await fetch('/api/warden/requests?status=pending', { credentials: 'include' });
    const data = await res.json();
    if (!data.success) return;

    const wrap = document.getElementById('pending-quick-wrap');
    if (!data.requests.length) {
        wrap.innerHTML = `<p class="empty-state"><span class="empty-icon">✅</span><br>All clear! No pending requests</p>`;
        return;
    }
    wrap.innerHTML = buildRequestTable(data.requests, true);
}
async function loadRequests() {
    const status   = document.getElementById('f-status').value;
    const verified = document.getElementById('f-verified').value;
    const date     = document.getElementById('f-date').value;

    let url = '/api/warden/requests?';
    if (status)   url += `status=${status}&`;
    if (verified !== '') url += `verified=${verified}&`;
    if (date)     url += `date=${date}&`;

    const res  = await fetch(url, { credentials: 'include' });
    const data = await res.json();
    if (!data.success) return;

    const wrap = document.getElementById('all-requests-wrap');
    if (!data.requests.length) {
        wrap.innerHTML = `<p class="empty-state"><span class="empty-icon">🔍</span><br>No requests match your filters</p>`;
        return;
    }
    wrap.innerHTML = buildRequestTable(data.requests, false);
}

function clearFilters() {
    document.getElementById('f-status').value   = '';
    document.getElementById('f-verified').value = '';
    document.getElementById('f-date').value     = '';
    loadRequests();
}
function buildRequestTable(requests, compact) {
    const rows = requests.map(r => {
        // Color-coding: green=parent verified, yellow=student only, red=rejected
        let rowClass = '';
        if (r.status === 'rejected') rowClass = 'row-red';
        else if (r.parent_verified) rowClass = 'row-green';
        else                        rowClass = 'row-yellow';

        const actions = r.status === 'pending'
            ? `<div class="action-btns">
                <button class="btn btn-success btn-sm" onclick="openApprove(${r.request_id})">✅ Approve</button>
                <button class="btn btn-danger  btn-sm" onclick="openReject(${r.request_id})">❌ Reject</button>
               </div>`
            : statusBadge(r.status);

        return `<tr class="${rowClass}">
            <td>#${r.request_id}</td>
            <td>
                <div style="font-weight:500">${r.full_name}</div>
                <div style="font-size:.78rem;color:var(--muted)">${r.roll_number} · ${r.room_number}</div>
            </td>
            <td>${r.destination}</td>
            <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.reason}</td>
            <td>${formatDate(r.outgoing_datetime)}</td>
            ${compact ? '' : `<td>${formatDate(r.return_datetime)}</td>`}
            <td>${r.parent_verified
                ? '<span class="badge badge-verified">✅ Parent Verified</span>'
                : '<span style="color:var(--warn);font-size:.8rem">⚠ Student Only</span>'
            }</td>
            <td>${actions}</td>
        </tr>`;
    }).join('');

    return `<table>
        <thead>
            <tr>
                <th>ID</th><th>Student</th><th>Destination</th><th>Reason</th>
                <th>Outgoing</th>${compact ? '' : '<th>Return</th>'}
                <th>Parent</th><th>Action</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>`;
}
function openApprove(id) {
    pendingAction = { id, type: 'approve' };
    document.getElementById('approve-id').textContent = id;
    document.getElementById('approve-note').value = '';
    document.getElementById('approve-modal').classList.add('open');
}

async function submitApprove() {
    const note = document.getElementById('approve-note').value.trim();
    const res = await fetch(`/api/warden/requests/${pendingAction.id}/approve`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warden_note: note })
    });
    const data = await res.json();
    closeModal('approve-modal');
    if (data.success) { loadStats(); loadPendingQuick(); }
    else alert('Error: ' + data.message);
}

function openReject(id) {
    pendingAction = { id, type: 'reject' };
    document.getElementById('reject-id').textContent = id;
    document.getElementById('reject-reason').value = '';
    document.getElementById('reject-modal').classList.add('open');
}

async function submitReject() {
    const reason = document.getElementById('reject-reason').value.trim();
    if (!reason) {
        alert('Rejection reason is required.');
        return;
    }
    const res = await fetch(`/api/warden/requests/${pendingAction.id}/reject`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warden_note: reason })
    });
    const data = await res.json();
    closeModal('reject-modal');
    if (data.success) { loadStats(); loadPendingQuick(); }
    else alert('Error: ' + data.message);
}

function closeModal(id) {
    document.getElementById(id).classList.remove('open');
    pendingAction = { id: null, type: null };
}
async function loadLogs() {
    const res  = await fetch('/api/warden/logs', { credentials: 'include' });
    const data = await res.json();
    if (!data.success) return;

    const wrap = document.getElementById('logs-wrap');
    if (!data.logs.length) {
        wrap.innerHTML = `<p class="empty-state">No logs yet</p>`;
        return;
    }

    const actionIcon = {
        LOGIN_SUCCESS:           '🔐',
        LOGIN_FAIL:              '❌',
        LOGOUT:                  '🚪',
        OUTPASS_APPLIED:         '📝',
        PARENT_OUTPASS_SUBMITTED:'👨‍👩‍👦',
        PARENT_VERIFIED:         '✅',
        APPROVED:                '✅',
        REJECTED:                '❌'
    };

    const rows = data.logs.map(log => `
        <tr>
            <td style="font-size:.78rem;color:var(--muted)">${formatDate(log.created_at)}</td>
            <td><code style="background:var(--surface2);padding:2px 6px;border-radius:4px;font-size:.8rem">${log.actor_id}</code></td>
            <td>${actionIcon[log.action] || '📌'} ${log.action}</td>
            <td style="font-size:.82rem;color:var(--muted)">${log.target_id || '—'}</td>
            <td style="font-size:.78rem;color:var(--muted)">${log.ip_address || '—'}</td>
        </tr>
    `).join('');

    wrap.innerHTML = `<table>
        <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>IP</th></tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
}

async function loadProfile() {
    const res  = await fetch('/api/warden/profile', { credentials: 'include' });
    const data = await res.json();
    if (!data.success) return;
    const w = data.warden;
    document.getElementById('warden-profile-body').innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            ${pf('Full Name', w.full_name)}
            ${pf('Warden ID', w.warden_id)}
            ${pf('Hostel', w.hostel_name)}
            ${pf('Phone', w.phone || '—')}
            ${pf('Email', w.email || '—')}
        </div>
    `;
}

function pf(label, value) {
    return `<div>
        <div style="font-size:.78rem;color:var(--muted);margin-bottom:4px">${label}</div>
        <div style="font-weight:500">${value}</div>
    </div>`;
}

function statusBadge(status) {
    const map = {
        pending:  '<span class="badge badge-pending">⏳ Pending</span>',
        approved: '<span class="badge badge-approved">✅ Approved</span>',
        rejected: '<span class="badge badge-rejected">❌ Rejected</span>'
    };
    return map[status] || status;
}

function formatDate(dt) {
    if (!dt) return '—';
    return new Date(dt).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}
