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

    // ─── Projects ─────────────────────────────────────
    projects: {
        list() {
            return API.request('/api/projects');
        },
        get(id) {
            return API.request(`/api/projects/${id}`);
        },
        create(name, sharepointSiteId = null) {
            return API.postForm('/api/projects', { name, sharepoint_site_id: sharepointSiteId });
        },
        update(id, data) {
            return API.putForm(`/api/projects/${id}`, data);
        },
        delete(id) {
            return API.request(`/api/projects/${id}`, { method: 'DELETE' });
        },
        syncLogs(id) {
            return API.request(`/api/projects/${id}/sync-logs`);
        },
        stats(id) {
            return API.request(`/api/projects/${id}/stats`);
        },
    },

    // ─── Letters ──────────────────────────────────────
    letters: {
        upload(file, projectId = null) {
            const extra = {};
            if (projectId) extra.project_id = projectId;
            return API.upload('/api/letters/upload', file, extra);
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
        generate(letterId, instructions = '', sessionId = '') {
            return API.postForm(`/api/drafts/generate/${letterId}`, { instructions, session_id: sessionId });
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken }),
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

    // ─── Jobs ─────────────────────────────────────────
    jobs: {
        get(jobId) {
            return API.request(`/api/jobs/${jobId}`);
        },
    },

    // ─── Health ───────────────────────────────────────
    health() {
        return API.request('/health');
    },

    // ─── Drafting Sessions ────────────────────────────
    draftingSessions: {
        templates() {
            return API.request('/api/drafting-sessions/templates');
        },
        list() {
            return API.request('/api/drafting-sessions');
        },
        search(q) {
            return API.request(`/api/drafting-sessions/search?q=${encodeURIComponent(q)}`);
        },
        get(sessionId) {
            return API.request(`/api/drafting-sessions/${sessionId}`);
        },
        create(letterId, projectId, title) {
            return API.postForm('/api/drafting-sessions', {
                letter_id: letterId || '',
                project_id: projectId || '',
                title: title || '',
            });
        },
        togglePin(sessionId) {
            return API.request(`/api/drafting-sessions/${sessionId}/pin`, { method: 'PATCH' });
        },
        rename(sessionId, title) {
            return API.postForm(`/api/drafting-sessions/${sessionId}/title`, { title });
        },
        delete(sessionId) {
            return API.request(`/api/drafting-sessions/${sessionId}`, { method: 'DELETE' });
        },
        addMessage(sessionId, role, content, draftResponseId) {
            return API.postForm(`/api/drafting-sessions/${sessionId}/messages`, {
                role,
                content,
                draft_response_id: draftResponseId || '',
            });
        },
    },

    // ─── Prompts (Admin) ───────────────────────────────
    prompts: {
        list(includeInactive = false) {
            return API.request(`/api/prompts?include_inactive=${includeInactive}`);
        },
        get(templateId) {
            return API.request(`/api/prompts/${templateId}`);
        },
        create(label, promptText, icon = 'ti-sparkles', displayOrder = 0) {
            return API.postForm('/api/prompts', {
                label,
                prompt_text: promptText,
                icon,
                display_order: displayOrder,
            });
        },
        update(templateId, label, promptText, icon, displayOrder, isActive) {
            return API.putForm(`/api/prompts/${templateId}`, {
                label: label || undefined,
                prompt_text: promptText || undefined,
                icon: icon || undefined,
                display_order: displayOrder !== undefined ? displayOrder : undefined,
                is_active: isActive !== undefined ? isActive : undefined,
            });
        },
        delete(templateId) {
            return API.request(`/api/prompts/${templateId}`, { method: 'DELETE' });
        },
        reorder(templateIds) {
            return API.postForm('/api/prompts/reorder', {
                template_ids: templateIds.join(','),
            });
        },
    },
};
