let currentSection = 'dashboard';
let studentProfile = null;


window.addEventListener('load', async () => {
    await guardPage('student');
    loadProfile();
    loadStats();
    loadRecentRequests();
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const localNow = now.toISOString().slice(0, 16);
    document.getElementById('f-outgoing').min = localNow;
    document.getElementById('f-return').min   = localNow;
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
    } catch {
        window.location.href = '/';
    }
}
function showSection(name) {
    document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
    document.getElementById('section-' + name).classList.remove('hidden');
    document.getElementById('nav-' + name).classList.add('active');
    currentSection = name;
    if (name === 'history') loadHistory();
    if (name === 'profile') loadFullProfile();
    if (name === 'dashboard') { loadStats(); loadRecentRequests(); }
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/';
}
async function loadProfile() {
    const res  = await fetch('/api/student/profile', { credentials: 'include' });
    const data = await res.json();
    if (!data.success) return;
    studentProfile = data.student;

    document.getElementById('profile-card-body').innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            ${profileField('Full Name', data.student.full_name)}
            ${profileField('Roll Number', data.student.roll_number)}
            ${profileField('Room', data.student.room_number)}
            ${profileField('Hostel', data.student.hostel_name)}
            ${profileField('Course', data.student.course + ' — Year ' + data.student.year)}
            ${profileField('Parent', data.student.parent_name || 'N/A')}
        </div>
    `;
}

async function loadFullProfile() {
    if (!studentProfile) await loadProfile();
    const s = studentProfile;
    document.getElementById('profile-full-body').innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            ${profileField('Full Name', s.full_name)}
            ${profileField('Roll Number', s.roll_number)}
            ${profileField('Room Number', s.room_number)}
            ${profileField('Hostel', s.hostel_name)}
            ${profileField('Course', s.course)}
            ${profileField('Year', 'Year ' + s.year)}
            ${profileField('Phone', s.phone || '—')}
            ${profileField('Email', s.email || '—')}
            ${profileField("Parent's Name", s.parent_name || '—')}
            ${profileField("Parent's Phone", s.parent_phone || '—')}
            ${profileField("Parent's Email", s.parent_email || '—')}
        </div>
    `;
}

function profileField(label, value) {
    return `<div>
        <div style="font-size:.78rem;color:var(--muted);margin-bottom:4px">${label}</div>
        <div style="font-weight:500">${value}</div>
    </div>`;
}
async function loadStats() {
    const res  = await fetch('/api/student/stats', { credentials: 'include' });
    const data = await res.json();
    if (!data.success) return;
    const s = data.stats;
    document.getElementById('stat-total').textContent    = s.total    || 0;
    document.getElementById('stat-pending').textContent  = s.pending  || 0;
    document.getElementById('stat-approved').textContent = s.approved || 0;
    document.getElementById('stat-rejected').textContent = s.rejected || 0;

  
    if (s.parent_verified > 0) {
        document.getElementById('profile-card').style.borderColor = 'var(--student)';
        document.getElementById('parent-verified-badge').classList.remove('hidden');
    }
}

async function loadRecentRequests() {
    const res  = await fetch('/api/student/requests', { credentials: 'include' });
    const data = await res.json();
    if (!data.success) return;

    const wrap = document.getElementById('recent-table-wrap');
    const recent = data.requests.slice(0, 5);
    if (!recent.length) {
        wrap.innerHTML = `<p class="empty-state"><span class="empty-icon">📭</span><br>No requests yet. <a onclick="showSection('apply')" style="color:var(--accent);cursor:pointer">Apply now →</a></p>`;
        return;
    }
    wrap.innerHTML = buildTable(recent);
}

async function loadHistory() {
    const status = document.getElementById('filter-status').value;
    let url = '/api/student/requests';
    if (status) url += '?status=' + status;

    const res  = await fetch(url, { credentials: 'include' });
    const data = await res.json();
    if (!data.success) return;

    const wrap = document.getElementById('history-table-wrap');
    if (!data.requests.length) {
        wrap.innerHTML = `<p class="empty-state"><span class="empty-icon">🔍</span><br>No requests found</p>`;
        return;
    }
    wrap.innerHTML = buildTable(data.requests);
}

function buildTable(requests) {
    const rows = requests.map(r => `
        <tr onclick="viewDetail(${r.request_id})" style="cursor:pointer">
            <td>#${r.request_id}</td>
            <td>${r.destination}</td>
            <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.reason}</td>
            <td>${formatDate(r.outgoing_datetime)}</td>
            <td>${formatDate(r.return_datetime)}</td>
            <td>${statusBadge(r.status)}</td>
            <td>${r.parent_verified ? '<span class="badge badge-verified">✅ Verified</span>' : '<span style="color:var(--muted);font-size:.8rem">Student only</span>'}</td>
        </tr>
    `).join('');
    return `<table>
        <thead>
            <tr>
                <th>ID</th><th>Destination</th><th>Reason</th>
                <th>Outgoing</th><th>Return</th><th>Status</th><th>Parent</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>`;
}
async function submitOutpass() {
    const reason      = document.getElementById('f-reason').value.trim();
    const destination = document.getElementById('f-destination').value.trim();
    const outgoing    = document.getElementById('f-outgoing').value;
    const ret         = document.getElementById('f-return').value;
    const alertEl     = document.getElementById('apply-alert');

    if (!reason || !destination || !outgoing || !ret) {
        showAlert(alertEl, 'error', '⚠ Please fill in all fields.');
        return;
    }
    if (new Date(ret) <= new Date(outgoing)) {
        showAlert(alertEl, 'error', '⚠ Return time must be after outgoing time.');
        return;
    }

    const res = await fetch('/api/student/requests', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, destination, outgoing_datetime: outgoing, return_datetime: ret })
    });
    const data = await res.json();

    if (data.success) {
        showAlert(alertEl, 'success', '✅ Outpass request submitted successfully!');
        document.getElementById('f-reason').value      = '';
        document.getElementById('f-destination').value = '';
        document.getElementById('f-outgoing').value    = '';
        document.getElementById('f-return').value      = '';
    } else {
        showAlert(alertEl, 'error', '⚠ ' + data.message);
    }
}

async function viewDetail(id) {
    const res  = await fetch(`/api/student/requests/${id}`, { credentials: 'include' });
    const data = await res.json();
    if (!data.success) return;
    const r = data.request;

    document.getElementById('modal-content').innerHTML = `
        <div style="display:grid;gap:12px">
            ${profileField('Request ID', '#' + r.request_id)}
            ${profileField('Status', statusBadge(r.status))}
            ${profileField('Destination', r.destination)}
            ${profileField('Reason', r.reason)}
            ${profileField('Outgoing', formatDate(r.outgoing_datetime))}
            ${profileField('Return', formatDate(r.return_datetime))}
            ${profileField('Parent Verified', r.parent_verified ? '✅ Yes' : '❌ No')}
            ${r.parent_note ? profileField("Parent's Note", r.parent_note) : ''}
            ${r.warden_note ? profileField("Warden's Note", r.warden_note) : ''}
            ${profileField('Submitted', formatDate(r.created_at))}
        </div>
    `;
    document.getElementById('detail-modal').classList.add('open');
}

function closeModal() {
    document.getElementById('detail-modal').classList.remove('open');
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
    setTimeout(() => el.classList.add('hidden'), 5000);
}
