// POST a chat message and read the Server-Sent Events reply as it streams.
// (EventSource can't POST or send cookies cross-site, so this reads fetch's body stream.)
const BASE_URL = import.meta.env.VITE_BASE_URL;

export class ChatHttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

/**
 * onEvent(event, data) is called for: session, cards, token, reset, done, error.
 * Resolves when the stream ends. Rejects with ChatHttpError (429, 503, 400…) or a network error.
 */
export async function sendChat({ text, sessionId, signal, onEvent }) {
    const res = await fetch(`${BASE_URL}/chat/message`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, ...(sessionId ? { sessionId } : {}) }),
        signal,
    });
    if (!res.ok || !res.body) {
        let message = 'Something went wrong. Please try again.';
        try {
            message = (await res.json()).message || message;
        } catch {
            // not JSON
        }
        throw new ChatHttpError(res.status, message);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let cut;
        while ((cut = buffer.indexOf('\n\n')) !== -1) {
            const block = buffer.slice(0, cut);
            buffer = buffer.slice(cut + 2);
            const event = block.match(/^event: (.+)$/m)?.[1];
            const data = block.match(/^data: (.+)$/m)?.[1];
            if (!event || !data) continue; // heartbeats (": ping") have no event
            try {
                onEvent(event, JSON.parse(data));
            } catch {
                // a malformed block is skipped, the stream continues
            }
        }
    }
}
