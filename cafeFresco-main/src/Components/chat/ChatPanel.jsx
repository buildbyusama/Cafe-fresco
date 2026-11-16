import PropTypes from 'prop-types';
import { useContext, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import productContext from '../../Context/ProductContext';
import { apiFetch } from '../../api';
import { formatMoney } from '../../utils/price';
import { imgUrl, onImgError } from '../home/useHomeData';
import { sendChat, ChatHttpError } from './stream';
import FormattedText from './FormattedText';

const SESSION_KEY = 'cf_chat_session';
const SUGGESTIONS = ['Recommend something', "Today's deals", 'Track my order', 'Opening hours'];
const store = {
    get: () => { try { return localStorage.getItem(SESSION_KEY); } catch { return null; } },
    set: (v) => { try { if (v) localStorage.setItem(SESSION_KEY, v); else localStorage.removeItem(SESSION_KEY); } catch { /* storage blocked */ } },
};
let nextId = 0;
const localId = () => `local-${++nextId}`;

// A dish found by the assistant: open it, or add one (the customer's own tap is the confirmation)
function DishMini({ card, onAdd, busy }) {
    return (
        <div className="cc-dish">
            <Link to={`/product/${card.id}`} className="cc-dish-main">
                <img src={imgUrl(card.image)} alt="" onError={onImgError} loading="lazy" />
                <span>
                    <b>{card.title}</b>
                    <small>
                        {formatMoney(card.price)}
                        {card.originalPrice > card.price && <s>{formatMoney(card.originalPrice)}</s>}
                        {!card.inStock && <em> · out of stock</em>}
                    </small>
                </span>
            </Link>
            <button type="button" className="cc-add" disabled={!card.inStock || busy} onClick={() => onAdd(card.id, 1)} aria-label={`Add ${card.title} to cart`}>
                <i className="bi bi-bag-plus" />
            </button>
        </div>
    );
}
DishMini.propTypes = { card: PropTypes.object.isRequired, onAdd: PropTypes.func.isRequired, busy: PropTypes.bool };

// The assistant proposed adding to the cart (A4): nothing happens until Confirm
function ActionCard({ card, state, onConfirm, onCancel }) {
    return (
        <div className={`cc-action is-${state}`}>
            <img src={imgUrl(card.image)} alt="" onError={onImgError} />
            <div>
                <b>{card.quantity} × {card.title}</b>
                <small>{formatMoney(card.price * card.quantity)}</small>
            </div>
            {state === 'pending' && (
                <span className="cc-action-btns">
                    <button type="button" className="cc-btn-red" onClick={onConfirm}>Confirm</button>
                    <button type="button" className="cc-btn-ghost" onClick={onCancel}>Cancel</button>
                </span>
            )}
            {state === 'added' && <span className="cc-done"><i className="bi bi-check2-circle" /> Added</span>}
            {state === 'cancelled' && <span className="cc-muted">Not added</span>}
            {state === 'busy' && <span className="cc-muted">Adding…</span>}
        </div>
    );
}
ActionCard.propTypes = { card: PropTypes.object.isRequired, state: PropTypes.string.isRequired, onConfirm: PropTypes.func.isRequired, onCancel: PropTypes.func.isRequired };

export default function ChatPanel({ onClose, greeting }) {
    const { addToCart, authStatus } = useContext(productContext);
    const location = useLocation();
    const [sessionId, setSessionId] = useState(store.get);
    const [messages, setMessages] = useState([]); // {id, role, content, cards, serverId, feedback, actions:{productId:state}}
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [notice, setNotice] = useState(null); // {text, retry?}
    const [busyAdd, setBusyAdd] = useState(null);
    const listRef = useRef(null);
    const inputRef = useRef(null);
    const ctrlRef = useRef(null);
    const lastText = useRef('');

    // history of an existing conversation
    useEffect(() => {
        if (!sessionId) return;
        apiFetch(`/chat/session/${sessionId}`).then((r) => {
            if (!r.ok) {
                store.set(null);
                setSessionId(null);
                return;
            }
            setMessages(r.data.messages.map((m) => ({ id: m.id, serverId: m.role === 'assistant' ? m.id : null, role: m.role, content: m.content, cards: m.cards || [], feedback: m.feedback, actions: {} })));
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        inputRef.current?.focus();
        const onKey = (e) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            ctrlRef.current?.abort(); // closing the panel stops an answer in progress
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, notice]);

    const patchLast = (fn) => setMessages((list) => list.map((m, i) => (i === list.length - 1 ? fn(m) : m)));

    const send = async (raw) => {
        const text = String(raw ?? input).trim();
        if (!text || sending) return;
        lastText.current = text;
        setInput('');
        setNotice(null);
        setSending(true);
        setMessages((list) => [...list, { id: localId(), role: 'user', content: text, cards: [] }, { id: localId(), role: 'assistant', content: '', cards: [], streaming: true, actions: {} }]);
        const ctrl = new AbortController();
        ctrlRef.current = ctrl;
        try {
            await sendChat({
                text,
                sessionId,
                signal: ctrl.signal,
                onEvent: (event, data) => {
                    if (event === 'session' && data.sessionId !== sessionId) {
                        store.set(data.sessionId);
                        setSessionId(data.sessionId);
                    } else if (event === 'token') patchLast((m) => ({ ...m, content: m.content + data.text }));
                    else if (event === 'reset') patchLast((m) => ({ ...m, content: '', cards: [] }));
                    else if (event === 'cards') patchLast((m) => ({ ...m, cards: [...m.cards, ...data.cards] }));
                    else if (event === 'done') patchLast((m) => ({ ...m, streaming: false, serverId: data.messageId }));
                    else if (event === 'error') {
                        patchLast((m) => ({ ...m, streaming: false }));
                        setNotice({ text: data.message, retry: data.retryable });
                    }
                },
            });
        } catch (err) {
            if (err.name === 'AbortError') {
                patchLast((m) => ({ ...m, streaming: false, content: m.content || 'Stopped.' }));
            } else {
                // drop the empty assistant bubble and explain what happened
                setMessages((list) => (list.at(-1)?.role === 'assistant' && !list.at(-1).content ? list.slice(0, -1) : list));
                const text = err instanceof ChatHttpError
                    ? err.status === 429 ? "You're sending messages quickly. Please wait a moment and try again." : err.status === 503 ? 'The assistant is taking a break right now. You can still use the Contact page.' : err.message
                    : "Can't reach Cafe Fresco right now. Check your connection.";
                setNotice({ text, retry: !(err instanceof ChatHttpError) || err.status >= 500 });
            }
        } finally {
            patchLast((m) => (m.role === 'assistant' ? { ...m, streaming: false } : m));
            setSending(false);
            ctrlRef.current = null;
        }
    };

    const newChat = async () => {
        ctrlRef.current?.abort();
        if (sessionId) apiFetch(`/chat/session/${sessionId}`, { method: 'DELETE' }); // your chat is deleted, not just hidden
        store.set(null);
        setSessionId(null);
        setMessages([]);
        setNotice(null);
        inputRef.current?.focus();
    };

    const addDish = async (productId, quantity, msgId) => {
        setBusyAdd(productId);
        if (msgId) setMessages((list) => list.map((m) => (m.id === msgId ? { ...m, actions: { ...m.actions, [productId]: 'busy' } } : m)));
        const res = await addToCart({ id: productId, quantity });
        setBusyAdd(null);
        if (msgId) setMessages((list) => list.map((m) => (m.id === msgId ? { ...m, actions: { ...m.actions, [productId]: res?.ok ? 'added' : 'pending' } } : m)));
    };

    const feedback = async (m, value) => {
        if (!m.serverId) return;
        setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, feedback: value } : x)));
        apiFetch('/chat/feedback', { method: 'POST', body: { messageId: m.serverId, value } });
    };

    const loggedIn = authStatus === 'authenticated';
    const loginUrl = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;

    return (
        <div className="cc-panel" role="dialog" aria-modal="false" aria-label="Cafe Fresco assistant">
            <header className="cc-head">
                <span className="cc-avatar" aria-hidden><i className="bi bi-stars" /></span>
                <div>
                    <b>Cafe Fresco assistant</b>
                    <small>Menu, deals and your orders</small>
                </div>
                <button type="button" className="cc-icon" onClick={newChat} aria-label="Start a new chat" title="New chat"><i className="bi bi-pencil-square" /></button>
                <button type="button" className="cc-icon" onClick={onClose} aria-label="Close chat"><i className="bi bi-x-lg" /></button>
            </header>

            <div className="cc-list" ref={listRef} aria-live="polite">
                <div className="cc-msg is-bot">
                    <div className="cc-bubble"><FormattedText text={greeting} /></div>
                </div>
                {messages.length === 0 && (
                    <div className="cc-chips">
                        {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => send(s)}>{s}</button>)}
                    </div>
                )}
                {messages.map((m) => (
                    <div key={m.id} className={`cc-msg ${m.role === 'user' ? 'is-user' : 'is-bot'}`}>
                        {(m.content || m.streaming) && (
                            <div className="cc-bubble">
                                {m.role === 'user' ? m.content : <FormattedText text={m.content} />}
                                {m.streaming && !m.content && <span className="cc-typing" aria-label="Assistant is typing"><i /><i /><i /></span>}
                            </div>
                        )}
                        {m.cards?.filter((c) => c.type === 'dish').length > 0 && (
                            <div className="cc-cards">
                                {m.cards.filter((c) => c.type === 'dish').slice(0, 4).map((c) => <DishMini key={c.id} card={c} busy={busyAdd === c.id} onAdd={(id, q) => addDish(id, q)} />)}
                            </div>
                        )}
                        {m.cards?.filter((c) => c.type === 'add_to_cart').map((c) => (
                            <ActionCard
                                key={c.productId}
                                card={c}
                                state={m.actions?.[c.productId] || 'pending'}
                                onConfirm={() => addDish(c.productId, c.quantity, m.id)}
                                onCancel={() => setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, actions: { ...x.actions, [c.productId]: 'cancelled' } } : x)))}
                            />
                        ))}
                        {m.role === 'assistant' && !m.streaming && !loggedIn && /log in/i.test(m.content) && (
                            <Link to={loginUrl} className="cc-login" onClick={onClose}>Log in</Link>
                        )}
                        {m.role === 'assistant' && !m.streaming && m.serverId && (
                            <div className="cc-feedback">
                                <button type="button" aria-label="Helpful" aria-pressed={m.feedback === 'up'} className={m.feedback === 'up' ? 'is-on' : ''} onClick={() => feedback(m, 'up')}><i className="bi bi-hand-thumbs-up" /></button>
                                <button type="button" aria-label="Not helpful" aria-pressed={m.feedback === 'down'} className={m.feedback === 'down' ? 'is-on' : ''} onClick={() => feedback(m, 'down')}><i className="bi bi-hand-thumbs-down" /></button>
                            </div>
                        )}
                    </div>
                ))}
                {notice && (
                    <div className="cc-notice" role="alert">
                        {notice.text}
                        {notice.retry && <button type="button" onClick={() => send(lastText.current)}>Try again</button>}
                    </div>
                )}
            </div>

            <form className="cc-compose" onSubmit={(e) => { e.preventDefault(); send(); }}>
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value.slice(0, 1000))}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            send();
                        }
                    }}
                    rows={1}
                    placeholder="Ask about dishes, deals or your order…"
                    aria-label="Message"
                />
                {sending ? (
                    <button type="button" className="cc-send is-stop" onClick={() => ctrlRef.current?.abort()} aria-label="Stop the answer"><i className="bi bi-stop-fill" /></button>
                ) : (
                    <button type="submit" className="cc-send" disabled={!input.trim()} aria-label="Send"><i className="bi bi-send-fill" /></button>
                )}
            </form>
            <p className="cc-privacy">Chats are kept for 30 days to help us improve. Don&apos;t share card details here.</p>
        </div>
    );
}

ChatPanel.propTypes = { onClose: PropTypes.func.isRequired, greeting: PropTypes.string };
