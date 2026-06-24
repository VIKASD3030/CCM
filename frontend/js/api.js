/**
 * CCM API Client
 * Centralized fetch wrapper for all backend API calls.
 */

const API = {
    BASE_URL: '',

    /**
     * Generic fetch wrapper with error handling.
     */
    async request(url, options = {}) {
        try {
            const token = localStorage.getItem('ccm_access_token');
            const headers = { ...options.headers };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            const response = await fetch(`${this.BASE_URL}${url}`, {
                ...options,
                headers,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Cannot connect to server. Is the backend running?');
            }
            throw error;
        }
    },

    /**
     * Upload a file with optional form fields.
     */
    async upload(url, file, extraFields = {}) {
        const formData = new FormData();
        formData.append('file', file);
        for (const [key, value] of Object.entries(extraFields)) {
            if (value !== null && value !== undefined) {
                formData.append(key, value);
            }
        }
        return this.request(url, { method: 'POST', body: formData });
    },

    /**
     * POST with form-encoded data.
     */
    async postForm(url, data = {}) {
        const formData = new FormData();
        for (const [key, value] of Object.entries(data)) {
            if (value !== null && value !== undefined) {
                formData.append(key, String(value));
            }
        }
        return this.request(url, { method: 'POST', body: formData });
    },

    /**
     * PUT with form-encoded data.
     */
    async putForm(url, data = {}) {
        const formData = new FormData();
        for (const [key, value] of Object.entries(data)) {
            if (value !== null && value !== undefined) {
                formData.append(key, String(value));
            }
        }
        return this.request(url, { method: 'PUT', body: formData });
    },

    // ─── Knowledge Base ───────────────────────────────
    knowledge: {
        upload(file, category) {
            return API.upload('/api/knowledge/upload', file, { category });
        },
        list() {
            return API.request('/api/knowledge/documents');
        },
        delete(id) {
            return API.request(`/api/knowledge/documents/${id}`, { method: 'DELETE' });
        },
        stats() {
            return API.request('/api/knowledge/stats');
        },
        search(query, topK = 5, category = null) {
            const data = { query, top_k: topK };
            if (category) data.category = category;
            return API.postForm('/api/knowledge/search', data);
        },
    },

    // ─── Letters ──────────────────────────────────────
    letters: {
        upload(file) {
            return API.upload('/api/letters/upload', file);
        },
        list(status = null, category = null) {
            const params = new URLSearchParams();
            if (status) params.set('status', status);
            if (category) params.set('category', category);
            const qs = params.toString();
            return API.request(`/api/letters${qs ? '?' + qs : ''}`);
        },
        get(id) {
            return API.request(`/api/letters/${id}`);
        },
        reclassify(id, category, urgency) {
            return API.putForm(`/api/letters/${id}/reclassify`, { category, urgency });
        },
    },

    // ─── Drafts ───────────────────────────────────────
    drafts: {
        generate(letterId, instructions = '') {
            return API.postForm(`/api/drafts/generate/${letterId}`, { instructions });
        },
        get(id) {
            return API.request(`/api/drafts/${id}`);
        },
        update(id, draftText) {
            return API.putForm(`/api/drafts/${id}`, { draft_text: draftText });
        },
        regenerate(id, feedback) {
            return API.postForm(`/api/drafts/${id}/regenerate`, { feedback });
        },
        forLetter(letterId) {
            return API.request(`/api/drafts/letter/${letterId}`);
        },
    },

    // ─── Review ───────────────────────────────────────
    review: {
        approve(draftId, reviewerNotes = '') {
            return API.postForm(`/api/review/${draftId}/approve`, { reviewer_notes: reviewerNotes });
        },
        reject(draftId, feedback) {
            return API.postForm(`/api/review/${draftId}/reject`, { feedback });
        },
        send(draftId) {
            return API.postForm(`/api/review/${draftId}/send`);
        },
        archive(letterId) {
            return API.postForm(`/api/review/archive/${letterId}`);
        },
        audit(entityType = null, entityId = null) {
            const params = new URLSearchParams();
            if (entityType) params.set('entity_type', entityType);
            if (entityId) params.set('entity_id', entityId);
            const qs = params.toString();
            return API.request(`/api/review/audit${qs ? '?' + qs : ''}`);
        },
        dashboardStats() {
            return API.request('/api/review/dashboard/stats');
        },
    },

    // ─── Webhooks ──────────────────────────────────────
    webhooks: {
        list() {
            return API.request('/api/webhooks');
        },
        create(data) {
            return API.request('/api/webhooks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
        },
        delete(id) {
            return API.request(`/api/webhooks/${id}`, { method: 'DELETE' });
        },
        getDeliveries(id, page = 1) {
            return API.request(`/api/webhooks/${id}/deliveries?page=${page}&per_page=20`);
        },
        test(id) {
            return API.request(`/api/webhooks/${id}/test`, { method: 'POST' });
        },
    },

    // ─── Auth / Users ──────────────────────────────────
    auth: {
        login(email, password) {
            return API.request('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ username: email, password }).toString(),
            });
        },
        loginJson(email, password) {
            return API.request('/api/auth/login/json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
        },
        me() {
            return API.request('/api/auth/me');
        },
        refresh(refreshToken) {
            return API.request('/api/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ refresh_token: refreshToken }).toString(),
            });
        },
        register(email, password, role) {
            return API.request('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, role }),
            });
        },
        listUsers() {
            return API.request('/api/auth/users');
        },
        deleteUser(id) {
            return API.request(`/api/auth/users/${id}`, { method: 'DELETE' });
        },
        forgotPassword(email) {
            return API.request('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
        },
        resetPassword(token, newPassword) {
            return API.request('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword }),
            });
        },
    },

    // ─── Health ───────────────────────────────────────
    health() {
        return API.request('/health');
    },
};
