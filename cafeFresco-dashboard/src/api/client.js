// Single API client for the dashboard: always sends the session cookie, parses JSON safely,
// throws ApiError with the server's `message`, and reports 401s to the session layer.

const BASE_URL = import.meta.env.VITE_BASE_URL;

export class ApiError extends Error {
    constructor(status, message, data) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

let onUnauthorized = null;
export const setUnauthorizedHandler = (handler) => {
    onUnauthorized = handler;
};

export async function apiFetch(path, { method = 'GET', body, formData, signal, headers = {} } = {}) {
    const init = { method, credentials: 'include', signal, headers: { ...headers } };
    if (formData) {
        init.body = formData; // browser sets the multipart boundary
    } else if (body !== undefined) {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
    }

    let response;
    try {
        response = await fetch(`${BASE_URL}${path}`, init);
    } catch (err) {
        if (err.name === 'AbortError') throw err;
        throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
    }

    const text = await response.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = { message: text };
    }

    if (!response.ok) {
        if (response.status === 401 && onUnauthorized) onUnauthorized();
        const message = data?.message || data?.error || `Request failed (${response.status})`;
        throw new ApiError(response.status, message, data);
    }
    return data;
}
