/**
 * CCM Login Page — Authentication, form validation, token management.
 */

const API_BASE = '';

const LoginPage = {
    init() {
        // Handle Google OAuth redirect with tokens in URL fragment.
        const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search);
        const tokenParam = params.get('token');
        if (tokenParam) {
            this.setToken(tokenParam);
            this.setRefreshToken(params.get('refresh'));
            const userParam = params.get('user');
            if (userParam) {
                try { this.setUser(JSON.parse(decodeURIComponent(userParam))); } catch {}
            }
            window.location.replace('/');
            return;
        }

        this.checkSession();
        this.showCorrectView();
        this.bindEvents();
    },

    /* ── View Routing ── */

    showCorrectView() {
        const path = window.location.pathname;

        document.getElementById('login-form-view').style.display = 'none';
        document.getElementById('forgot-password-view').style.display = 'none';
        document.getElementById('reset-password-view').style.display = 'none';

        if (path === '/forgot-password') {
            document.getElementById('forgot-password-view').style.display = 'block';
        } else if (path === '/reset-password') {
            const params = new URLSearchParams(window.location.search);
            const token = params.get('token');
            if (!token) {
                document.getElementById('reset-error-banner').style.display = 'flex';
                document.getElementById('reset-error-text').textContent = 'Missing reset token.';
            }
            document.getElementById('reset-password-view').style.display = 'block';
        } else {
            document.getElementById('login-form-view').style.display = 'block';
        }
    },

    /* ── Session Check ── */

    checkSession() {
        const token = this.getToken();
        if (token && window.location.pathname !== '/reset-password') {
            this.verifyToken(token);
        }
    },

    async verifyToken(token) {
        try {
            const res = await fetch(`${API_BASE}/api/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                window.location.replace('/');
            } else {
                this.removeToken();
            }
        } catch {
            // offline — let them try to log in
        }
    },

    /* ── Token Management ── */

    getToken() {
        return localStorage.getItem('ccm_access_token');
    },

    setToken(token) {
        localStorage.setItem('ccm_access_token', token);
    },

    getRefreshToken() {
        return localStorage.getItem('ccm_refresh_token');
    },

    setRefreshToken(token) {
        if (token) localStorage.setItem('ccm_refresh_token', token);
    },

    removeToken() {
        localStorage.removeItem('ccm_access_token');
        localStorage.removeItem('ccm_refresh_token');
        localStorage.removeItem('ccm_user');
    },

    setUser(user) {
        localStorage.setItem('ccm_user', JSON.stringify(user));
    },

    getUser() {
        try {
            return JSON.parse(localStorage.getItem('ccm_user'));
        } catch {
            return null;
        }
    },

    isAuthenticated() {
        return !!this.getToken();
    },

    /* ── Event Binding ── */

    bindEvents() {
        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Forgot password form
        const forgotForm = document.getElementById('forgot-form');
        if (forgotForm) {
            forgotForm.addEventListener('submit', (e) => this.handleForgotPassword(e));
        }

        // Reset password form
        const resetForm = document.getElementById('reset-form');
        if (resetForm) {
            resetForm.addEventListener('submit', (e) => this.handleResetPassword(e));
        }

        // Password toggle
        const pwToggle = document.getElementById('password-toggle');
        if (pwToggle) {
            pwToggle.addEventListener('click', () => this.togglePassword('login-password', 'password-toggle-icon'));
        }

        const resetPwToggle = document.getElementById('reset-password-toggle');
        if (resetPwToggle) {
            resetPwToggle.addEventListener('click', () => this.togglePassword('reset-password', 'reset-password-toggle-icon'));
        }
    },

    togglePassword(inputId, iconId) {
        const input = document.getElementById(inputId);
        const icon = document.getElementById(iconId);
        if (!input || !icon) return;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        icon.className = `ti ${isPassword ? 'ti-eye' : 'ti-eye-off'}`;
    },

    /* ── Login ── */

    async handleLogin(e) {
        e.preventDefault();
        this.clearErrors();

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        // Client-side validation
        let valid = true;
        if (!email) {
            this.showFieldError('login-email-error', 'Email is required.');
            valid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            this.showFieldError('login-email-error', 'Enter a valid email address.');
            valid = false;
        }

        if (!password) {
            this.showFieldError('login-password-error', 'Password is required.');
            valid = false;
        } else if (password.length < 8) {
            this.showFieldError('login-password-error', 'Password must be at least 8 characters.');
            valid = false;
        }

        if (!valid) return;

        this.setLoading(true);

        try {
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);

            const response = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData.toString(),
            });

            if (response.status === 423) {
                this.showErrorBanner('Account is locked due to too many failed attempts. Try again later.');
                this.setLoading(false);
                return;
            }

            if (!response.ok) {
                this.showErrorBanner('Invalid email or password. Please try again.');
                this.setLoading(false);
                return;
            }

            const data = await response.json();
            this.setToken(data.access_token);
            this.setRefreshToken(data.refresh_token);
            this.setUser(data.user);

            window.location.replace('/');
        } catch (error) {
            this.showErrorBanner('Cannot connect to server. Is the backend running?');
            this.setLoading(false);
        }
    },

    /* ── Forgot Password ── */

    async handleForgotPassword(e) {
        e.preventDefault();

        const email = document.getElementById('forgot-email').value.trim();
        document.getElementById('forgot-email-error').textContent = '';
        document.getElementById('forgot-error-banner').style.display = 'none';
        document.getElementById('forgot-success-banner').style.display = 'none';

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            document.getElementById('forgot-email-error').textContent = 'Enter a valid email address.';
            return;
        }

        const btn = document.getElementById('forgot-submit-btn');
        const spinner = document.getElementById('forgot-btn-spinner');
        const btnText = document.getElementById('forgot-btn-text');
        btn.disabled = true;
        spinner.style.display = 'inline-block';
        btnText.textContent = 'Sending…';

        try {
            const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            if (!response.ok) {
                const err = await response.json();
                document.getElementById('forgot-error-banner').style.display = 'flex';
                document.getElementById('forgot-error-text').textContent = err.detail || 'Something went wrong.';
            } else {
                document.getElementById('forgot-success-banner').style.display = 'flex';
            }
        } catch {
            document.getElementById('forgot-error-banner').style.display = 'flex';
            document.getElementById('forgot-error-text').textContent = 'Cannot connect to server.';
        }

        btn.disabled = false;
        spinner.style.display = 'none';
        btnText.textContent = 'Send Reset Link';
    },

    /* ── Reset Password ── */

    async handleResetPassword(e) {
        e.preventDefault();

        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        const password = document.getElementById('reset-password').value;
        document.getElementById('reset-password-error').textContent = '';
        document.getElementById('reset-error-banner').style.display = 'none';

        if (!token) {
            document.getElementById('reset-error-banner').style.display = 'flex';
            document.getElementById('reset-error-text').textContent = 'Missing reset token.';
            return;
        }

        if (!password || password.length < 8) {
            document.getElementById('reset-password-error').textContent = 'Password must be at least 8 characters.';
            return;
        }

        const btn = document.getElementById('reset-submit-btn');
        const spinner = document.getElementById('reset-btn-spinner');
        const btnText = document.getElementById('reset-btn-text');
        btn.disabled = true;
        spinner.style.display = 'inline-block';
        btnText.textContent = 'Resetting…';

        try {
            const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword: password }),
            });

            if (!response.ok) {
                const err = await response.json();
                document.getElementById('reset-error-banner').style.display = 'flex';
                document.getElementById('reset-error-text').textContent = err.detail || 'Invalid or expired reset token.';
            } else {
                document.getElementById('reset-password').value = '';
                document.getElementById('reset-success-banner').style.display = 'flex';
                document.getElementById('reset-submit-btn').style.display = 'none';
            }
        } catch {
            document.getElementById('reset-error-banner').style.display = 'flex';
            document.getElementById('reset-error-text').textContent = 'Cannot connect to server.';
        }

        btn.disabled = false;
        spinner.style.display = 'none';
        btnText.textContent = 'Reset Password';
    },

    /* ── Google OAuth ── */

    googleLogin() {
        window.location.href = `${API_BASE}/api/auth/google`;
    },

    /* ── Helpers ── */

    showFieldError(id, message) {
        const el = document.getElementById(id);
        if (el) el.textContent = message;
    },

    showErrorBanner(message) {
        const banner = document.getElementById('login-error-banner');
        const text = document.getElementById('login-error-text');
        if (banner && text) {
            text.textContent = message;
            banner.style.display = 'flex';
        }
    },

    clearErrors() {
        document.querySelectorAll('.login-field-error').forEach(el => el.textContent = '');
        document.getElementById('login-error-banner').style.display = 'none';
    },

    setLoading(isLoading) {
        const btn = document.getElementById('login-submit-btn');
        const spinner = document.getElementById('login-btn-spinner');
        const btnText = document.getElementById('login-btn-text');

        if (isLoading) {
            btn.disabled = true;
            spinner.style.display = 'inline-block';
            btnText.textContent = 'Signing in…';
        } else {
            btn.disabled = false;
            spinner.style.display = 'none';
            btnText.textContent = 'Sign in';
        }
    },

    /* ── Public auth helper for SPA pages ── */

    logout() {
        const refreshToken = this.getRefreshToken();
        this.removeToken();
        if (refreshToken) {
            // Revoke server-side; fire-and-forget so logout isn't blocked by it.
            fetch(`${API_BASE}/api/auth/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken }),
            }).catch(() => {});
        }
        window.location.replace('/login');
    },
};

document.addEventListener('DOMContentLoaded', () => LoginPage.init());
