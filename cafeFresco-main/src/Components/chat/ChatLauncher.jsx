import { lazy, Suspense, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useStoreSettings from '../../hooks/useStoreSettings';
import './chat.css';

// The panel (and its code) loads only when someone opens the chat
const ChatPanel = lazy(() => import('./ChatPanel'));

// Floating assistant button, shown unless Store Info turns the assistant off or hides it on this page
export default function ChatLauncher() {
    const settings = useStoreSettings();
    const { pathname } = useLocation();
    const [open, setOpen] = useState(false);
    const buttonRef = useRef(null);

    const chatbot = settings?.chatbot;
    if (!chatbot || chatbot.enabled === false) return null;
    if ((chatbot.hiddenOn || []).some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

    const close = () => {
        setOpen(false);
        setTimeout(() => buttonRef.current?.focus(), 0); // focus goes back where it came from
    };

    return (
        <>
            {open && (
                <Suspense fallback={<div className="cc-panel cc-loading" aria-busy="true"><span className="cc-typing"><i /><i /><i /></span></div>}>
                    <ChatPanel onClose={close} greeting={chatbot.greeting} />
                </Suspense>
            )}
            {!open && (
                <button ref={buttonRef} type="button" className="cc-launcher" onClick={() => setOpen(true)} aria-label="Open the Cafe Fresco assistant">
                    <i className="bi bi-chat-dots-fill" />
                    <span>Ask us</span>
                </button>
            )}
        </>
    );
}
