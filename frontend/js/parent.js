let verifyingId = null;

window.addEventListener('load', async () => {
    await guardPage('parent');
    loadChildSummary();
    loadStats();
    loadPendingRequests();
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
    if (name === 'requests') loadAllRequests();
    if (name === 'child')    loadChildFull();
    if (name === 'dashboard') { loadStats(); loadPendingRequests(); }
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/';
}
async function loadChildSummary() {
    const res  = await fetch('/api/parent/child', { credentials: 'include' });
    const data = await res.json();
    if (!data.success) return;
    const s = data.student;
    document.getElementById('child-summary-body').innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            ${pf('Name', s.full_name)}
            ${pf('Roll No.', s.roll_number)}
            ${pf('Room', s.room_number)}
            ${pf('Hostel', s.hostel_name)}
            ${pf('Course', s.course + ' — Year ' + s.year)}
            ${pf('Phone', s.phone || '—')}
        </div>
    `;
}

async function loadChildFull() {
    const res  = await fetch('/api/parent/child', { credentials: 'include' });
    const data = await res.json();
    if (!data.success) return;
    const s = data.student;
    document.getElementById('child-full-body').innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            ${pf('Full Name', s.full_name)}
            ${pf('Roll Number', s.roll_number)}
            ${pf('Room Number', s.room_number)}
            ${pf('Hostel', s.hostel_name)}
            ${pf('Course', s.course)}
            ${pf('Year', 'Year ' + s.year)}
            ${pf('Phone', s.phone || '—')}
            ${pf('Email', s.email || '—')}
        </div>
    `;
}

async function loadStats() {
    const res  = await fetch('/api/parent/stats', { credentials: 'include' });
    const data = await res.json();
    if (!data.success) return;
    const s = data.stats;
    document.getElementById('stat-total').textContent    = s.total || 0;
    document.getElementById('stat-pending').textContent  = s.pending || 0;
    document.getElementById('stat-approved').textContent = s.approved || 0;
    document.getElementById('stat-verified').textContent = s.verified_by_parent || 0;
}
async function loadPendingRequests() {
    const res  = await fetch('/api/parent/requests', { credentials: 'include' });
    const data = await res.json();
    if (!data.success) return;

    const pending = data.requests.filter(r => r.status === 'pending');
    const wrap = document.getElementById('pending-wrap');

    if (!pending.length) {
        wrap.innerHTML = `<p class="empty-state"><span class="empty-icon">✅</span><br>No pending requests</p>`;
        return;
    }

    const rows = pending.map(r => `
        <tr>
            <td>#${r.request_id}</td>
            <td>${r.destination}</td>
            <td>${r.reason}</td>
            <td>${formatDate(r.outgoing_datetime)}</td>
            <td>${r.parent_verified
                ? '<span class="badge badge-verified">✅ Verified</span>'
                : `<button class="btn btn-success btn-sm" onclick="openVerifyModal(${r.request_id})">✅ Verify</button>`
            }</td>
        </tr>
    `).join('');

    wrap.innerHTML = `<table>
        <thead><tr><th>ID</th><th>Destination</th><th>Reason</th><th>Outgoing</th><th>Action</th></tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
}
async function loadAllRequests() {
    const status = document.getElementById('p-filter').value;
    let url = '/api/parent/requests';
    if (status) url += '?status=' + status;
    const res  = await fetch(url, { credentials: 'include' });
    const data = await res.json();
    if (!data.success) return;

    const wrap = document.getElementById('all-requests-wrap');
    if (!data.requests.length) {
        wrap.innerHTML = `<p class="empty-state"><span class="empty-icon">🔍</span><br>No requests found</p>`;
        return;
    }

    const rows = data.requests.map(r => `
        <tr>
            <td>#${r.request_id}</td>
            <td>${r.destination}</td>
            <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.reason}</td>
            <td>${formatDate(r.outgoing_datetime)}</td>
            <td>${formatDate(r.return_datetime)}</td>
            <td>${statusBadge(r.status)}</td>
            <td>${r.parent_verified
                ? '<span class="badge badge-verified">✅ Verified</span>'
                : r.status === 'pending'
                    ? `<button class="btn btn-success btn-sm" onclick="openVerifyModal(${r.request_id})">Verify</button>`
                    : '<span style="color:var(--muted);font-size:.8rem">Not verified</span>'
            }</td>
        </tr>
    `).join('');

    wrap.innerHTML = `<table>
        <thead><tr><th>ID</th><th>Destination</th><th>Reason</th><th>Outgoing</th><th>Return</th><th>Status</th><th>Verification</th></tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
}
async function submitParentRequest() {
    const reason      = document.getElementById('p-reason').value.trim();
    const destination = document.getElementById('p-destination').value.trim();
    const outgoing    = document.getElementById('p-outgoing').value;
    const ret         = document.getElementById('p-return').value;
    const note        = document.getElementById('p-note').value.trim();
    const alertEl     = document.getElementById('submit-alert');

    if (!reason || !destination || !outgoing || !ret) {
        showAlert(alertEl, 'error', '⚠ Please fill in all required fields.');
        return;
    }
    if (new Date(ret) <= new Date(outgoing)) {
        showAlert(alertEl, 'error', '⚠ Return time must be after outgoing time.');
        return;
    }

    const res = await fetch('/api/parent/requests', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            reason, destination,
            outgoing_datetime: outgoing,
            return_datetime: ret,
            parent_note: note
        })
    });
    const data = await res.json();

    if (data.success) {
        showAlert(alertEl, 'success', '✅ Parent-verified request submitted! The warden will review it shortly.');
        ['p-reason','p-destination','p-outgoing','p-return','p-note'].forEach(id => document.getElementById(id).value = '');
    } else {
        showAlert(alertEl, 'error', '⚠ ' + data.message);
    }
}

function openVerifyModal(id) {
    verifyingId = id;
    document.getElementById('verify-id').textContent = id;
    document.getElementById('verify-note').value = '';
    document.getElementById('verify-modal').classList.add('open');
}

async function submitVerify() {
    if (!verifyingId) return;
    const note = document.getElementById('verify-note').value.trim();

    const res = await fetch(`/api/parent/requests/${verifyingId}/verify`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_note: note })
    });
    const data = await res.json();

    closeModal('verify-modal');
    if (data.success) {
        loadPendingRequests();
        loadStats();
    } else {
        alert('Error: ' + data.message);
    }
}

function closeModal(id) {
    document.getElementById(id).classList.remove('open');
    verifyingId = null;
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

function showAlert(el, type, msg) {
    el.className = `alert alert-${type}`;
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 6000);
}
