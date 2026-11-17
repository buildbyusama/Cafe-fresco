import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Portal from '@mui/material/Portal';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { IconAlertTriangle, IconCircleCheck, IconCircleX, IconInfoCircle, IconTrash, IconX } from '@tabler/icons-react';
import { playTone, soundEnabled } from '../utils/sound';

// Toasts (notify.success / error / info / warning) with a short sound, and a promise-based confirm dialog
const NotifyContext = createContext(null);

const KIND = {
    success: { icon: IconCircleCheck, color: '#2E9A57', bg: '#EAF6EE', title: 'Done' },
    error: { icon: IconCircleX, color: '#D32F2F', bg: '#FDECEC', title: 'Something went wrong' },
    warning: { icon: IconAlertTriangle, color: '#C77700', bg: '#FFF4DC', title: 'Heads up' },
    info: { icon: IconInfoCircle, color: '#1E5BB8', bg: '#E7F0FD', title: 'Note' }
};
const DURATION = { success: 3200, info: 3600, warning: 5000, error: 6000 };
const MAX_VISIBLE = 3;

function Toast({ toast, onClose }) {
    const k = KIND[toast.severity] || KIND.info;
    const Icon = k.icon;
    const [paused, setPaused] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const remaining = useRef(DURATION[toast.severity] || 3500);
    const startedAt = useRef(Date.now());

    // auto-dismiss, paused while hovered
    useEffect(() => {
        if (paused) return undefined;
        startedAt.current = Date.now();
        const t = setTimeout(() => setLeaving(true), remaining.current);
        return () => {
            clearTimeout(t);
            remaining.current -= Date.now() - startedAt.current;
        };
    }, [paused]);

    useEffect(() => {
        if (!leaving) return undefined;
        const t = setTimeout(() => onClose(toast.id), 220);
        return () => clearTimeout(t);
    }, [leaving, onClose, toast.id]);

    return (
        <Box
            role={toast.severity === 'error' ? 'alert' : 'status'}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            sx={{
                pointerEvents: 'auto',
                position: 'relative',
                overflow: 'hidden',
                width: { xs: 'calc(100vw - 32px)', sm: 380 },
                display: 'flex',
                gap: 1.5,
                alignItems: 'flex-start',
                p: 1.75,
                pr: 1,
                bgcolor: '#FFFFFF',
                borderRadius: '14px',
                border: '1px solid #EEEDE9',
                boxShadow: '0 12px 32px rgba(17,17,17,0.14)',
                animation: `${leaving ? 'cfToastOut .22s ease-in forwards' : 'cfToastIn .32s cubic-bezier(.2,.9,.3,1.2)'}`,
                '@keyframes cfToastIn': { from: { opacity: 0, transform: 'translateY(-12px) scale(.97)' }, to: { opacity: 1, transform: 'none' } },
                '@keyframes cfToastOut': { to: { opacity: 0, transform: 'translateY(-8px) scale(.97)' } }
            }}
        >
            <Box sx={{ width: 34, height: 34, borderRadius: '10px', bgcolor: k.bg, color: k.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon size={20} stroke={2} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, pt: 0.25 }}>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#111' }}>{toast.title || k.title}</Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: '#555', mt: 0.25, lineHeight: 1.45, wordBreak: 'break-word' }}>{toast.message}</Typography>
            </Box>
            <IconButton aria-label="Dismiss" size="small" onClick={() => setLeaving(true)} sx={{ color: '#9A978F', mt: -0.25 }}>
                <IconX size={16} />
            </IconButton>
            {/* time-left bar */}
            <Box
                aria-hidden
                sx={{
                    position: 'absolute',
                    left: 0,
                    bottom: 0,
                    height: 3,
                    width: '100%',
                    bgcolor: k.color,
                    opacity: 0.35,
                    transformOrigin: 'left',
                    animation: `cfToastBar ${DURATION[toast.severity] || 3500}ms linear forwards`,
                    animationPlayState: paused ? 'paused' : 'running',
                    '@keyframes cfToastBar': { from: { transform: 'scaleX(1)' }, to: { transform: 'scaleX(0)' } }
                }}
            />
        </Box>
    );
}

export function NotifyProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const [confirmState, setConfirmState] = useState(null);
    const resolver = useRef(null);
    const nextId = useRef(0);

    const show = useCallback((severity, message, opts = {}) => {
        const text = typeof message === 'string' ? message : message?.message || String(message ?? '');
        setToasts((list) => {
            // the same message twice in a row just restarts, it doesn't stack
            const rest = list.filter((t) => !(t.message === text && t.severity === severity));
            return [...rest, { id: ++nextId.current, severity, message: text, title: opts.title }].slice(-MAX_VISIBLE);
        });
        if (soundEnabled()) playTone(severity);
    }, []);

    const notify = useMemo(
        () => ({
            success: (m, o) => show('success', m, o),
            error: (m, o) => show('error', m, o),
            warning: (m, o) => show('warning', m, o),
            info: (m, o) => show('info', m, o)
        }),
        [show]
    );

    const remove = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

    // An open MUI dialog marks every sibling aria-hidden, which would silence toasts for screen readers
    // (e.g. a save error shown while the form is still open). Keep the toast region exposed.
    // callback ref: the Portal mounts its content a render later, so a plain ref would still be empty in an effect
    const observer = useRef(null);
    const regionRef = useCallback((el) => {
        observer.current?.disconnect();
        observer.current = null;
        if (!el) return;
        const unhide = () => el.getAttribute('aria-hidden') && el.removeAttribute('aria-hidden');
        observer.current = new MutationObserver(unhide);
        observer.current.observe(el, { attributes: true, attributeFilter: ['aria-hidden'] });
    }, []);

    const confirm = useCallback(
        ({ title = 'Are you sure?', message = '', confirmText = 'Confirm', danger = false, warning = false } = {}) =>
            new Promise((resolve) => {
                resolver.current = resolve;
                setConfirmState({ title, message, confirmText, danger, warning });
                if ((danger || warning) && soundEnabled()) playTone('warning');
            }),
        []
    );

    const closeConfirm = (result) => {
        resolver.current?.(result);
        resolver.current = null;
        setConfirmState(null);
    };

    // danger = destructive (delete); warning = a risky but non-destructive choice (e.g. publish personal data)
    const ConfirmIcon = confirmState?.warning ? IconAlertTriangle : confirmState?.danger ? IconTrash : IconInfoCircle;

    return (
        <NotifyContext.Provider value={{ notify, confirm }}>
            {children}
            {/* own node under <body>, so a dialog hiding #root doesn't hide the toasts */}
            <Portal>
                <Stack
                    ref={regionRef}
                    spacing={1}
                    aria-live="polite"
                    sx={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 2000, pointerEvents: 'none', alignItems: 'center' }}
                >
                    {toasts.map((t) => (
                        <Toast key={t.id} toast={t} onClose={remove} />
                    ))}
                </Stack>
            </Portal>
            <Dialog open={!!confirmState} onClose={() => closeConfirm(false)} maxWidth="xs" fullWidth aria-labelledby="cf-confirm-title">
                <Box sx={{ p: 3, pb: 2.5 }}>
                    <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
                        <Box
                            sx={{
                                width: 44,
                                height: 44,
                                borderRadius: '12px',
                                flexShrink: 0,
                                display: 'grid',
                                placeItems: 'center',
                                bgcolor: confirmState?.danger && !confirmState?.warning ? '#FDECEC' : '#FFF3D1',
                                color: confirmState?.danger && !confirmState?.warning ? '#D32F2F' : '#C98A00'
                            }}
                        >
                            <ConfirmIcon size={22} stroke={1.8} />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography id="cf-confirm-title" sx={{ fontSize: '1rem', fontWeight: 700, color: '#111', lineHeight: 1.35 }}>
                                {confirmState?.title}
                            </Typography>
                            {confirmState?.message && <Typography sx={{ fontSize: '0.875rem', color: '#6B6B6B', mt: 0.75 }}>{confirmState.message}</Typography>}
                        </Box>
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', mt: 3 }}>
                        <Button variant="outlined" color="inherit" onClick={() => closeConfirm(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => closeConfirm(true)} variant="contained" color={confirmState?.warning ? 'warning' : confirmState?.danger ? 'error' : 'primary'} autoFocus>
                            {confirmState?.confirmText}
                        </Button>
                    </Stack>
                </Box>
            </Dialog>
        </NotifyContext.Provider>
    );
}

export const useNotify = () => useContext(NotifyContext).notify;
export const useConfirm = () => useContext(NotifyContext).confirm;
