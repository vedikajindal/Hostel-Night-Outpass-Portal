window.handleLogin = async function () {
    const userIdInput  = document.getElementById('user_id');
    const passwordInput = document.getElementById('password');
    const errorBanner  = document.getElementById('error-banner');
    const loginBtn     = document.getElementById('loginBtn');
    const btnText      = document.getElementById('btn-text');
    const btnSpinner   = document.getElementById('btn-spinner');

    const user_id  = userIdInput.value.trim().toUpperCase();
    const password = passwordInput.value;

    errorBanner.classList.add('hidden');

    if (!user_id)  { showError('Please enter your User ID.');  return; }
    if (!password) { showError('Please enter your password.'); return; }

    loginBtn.disabled = true;
    btnText.classList.add('hidden');
    btnSpinner.classList.remove('hidden');

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ user_id, password })
        });

        const data = await response.json();

        if (data.success) {
            redirectToDashboard(data.user.role);
        } else {
            showError(data.message || 'Invalid credentials. Please try again.');
            passwordInput.value = '';
            passwordInput.focus();
        }
    } catch (err) {
        showError('Cannot connect to server. Please check your connection.');
        console.error('Login error:', err);
    } finally {
        loginBtn.disabled = false;
        btnText.classList.remove('hidden');
        btnSpinner.classList.add('hidden');
    }
};

function showError(msg) {
    const errorBanner = document.getElementById('error-banner');
    document.getElementById('error-msg').textContent = msg;
    errorBanner.classList.remove('hidden');
    errorBanner.style.animation = 'none';
    errorBanner.offsetHeight;
    errorBanner.style.animation = '';
}

function redirectToDashboard(role) {
    const routes = {
        student: '/pages/student-dashboard.html',
        parent:  '/pages/parent-dashboard.html',
        warden:  '/pages/warden-dashboard.html'
    };
    window.location.href = routes[role] || '/';
}

document.addEventListener('DOMContentLoaded', function () {
    const toggleBtn = document.getElementById('togglePw');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function () {
            const pwInput = document.getElementById('password');
            pwInput.type = pwInput.type === 'password' ? 'text' : 'password';
            this.textContent = pwInput.type === 'password' ? '👁' : '🙈';
        });
    }

    const userIdInput = document.getElementById('user_id');
    const passwordInput = document.getElementById('password');

    if (userIdInput) {
        userIdInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') passwordInput && passwordInput.focus();
        });
    }
    if (passwordInput) {
        passwordInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') window.handleLogin();
        });
    }

    fetch('/api/auth/me', { credentials: 'include' })
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (data && data.success) redirectToDashboard(data.user.role); })
        .catch(() => {});
});
