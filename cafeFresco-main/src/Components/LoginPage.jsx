import { useState, useContext, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import productContext from '../Context/ProductContext';
import { safeNext } from '../utils/safeNext';
import AuthLayout, { AuthField } from './auth/AuthLayout';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCK_KEY = 'loginBlockedUntil';
const LOCK_MS = 15 * 60 * 1000; // same window as the server's login limiter

// The server keeps blocking after a refresh, so the countdown must survive one too
const readLock = () => {
    try {
        const t = Number(localStorage.getItem(LOCK_KEY)) || 0;
        return t > Date.now() ? t : 0;
    } catch {
        return 0;
    }
};

const LoginSection = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const { playSound, refreshSession, authStatus } = useContext(productContext);
    const BASE_URL = import.meta.env.VITE_BASE_URL;
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const next = safeNext(searchParams.get('next'));
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [fieldErr, setFieldErr] = useState({});
    const [blockedUntil, setBlockedUntil] = useState(readLock);
    const [now, setNow] = useState(Date.now());

    // Already logged in → go where they were heading
    useEffect(() => {
        if (authStatus === 'authenticated') navigate(next, { replace: true });
    }, [authStatus]); // eslint-disable-line react-hooks/exhaustive-deps

    // tick once a second while locked
    useEffect(() => {
        if (!blockedUntil) return undefined;
        const t = setInterval(() => {
            setNow(Date.now());
            if (Date.now() >= blockedUntil) {
                setBlockedUntil(0);
                try { localStorage.removeItem(LOCK_KEY); } catch { /* ignore */ }
            }
        }, 1000);
        return () => clearInterval(t);
    }, [blockedUntil]);

    const left = Math.max(0, Math.ceil((blockedUntil - now) / 1000));
    const loginBlocked = left > 0;

    const set = (k) => (e) => {
        setFormData({ ...formData, [k]: e.target.value });
        if (fieldErr[k]) setFieldErr({ ...fieldErr, [k]: undefined });
        if (error) setError('');
    };

    const handleLogin = async () => {
        if (submitting || loginBlocked) return;
        const email = formData.email.trim();
        const fe = {};
        if (!EMAIL_RE.test(email)) fe.email = 'Enter a valid email address';
        if (!formData.password) fe.password = 'Enter your password';
        setFieldErr(fe);
        if (Object.keys(fe).length) {
            document.getElementById(fe.email ? 'login-email' : 'login-password')?.focus();
            return;
        }

        setSubmitting(true);
        setError('');
        try {
            const res = await fetch(`${BASE_URL}/user/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: formData.password }),
                credentials: 'include'
            });
            const data = await res.json().catch(() => ({}));

            if (res.status === 429) {
                const until = Date.now() + LOCK_MS;
                setBlockedUntil(until);
                setNow(Date.now());
                try { localStorage.setItem(LOCK_KEY, String(until)); } catch { /* ignore */ }
                toast.error(data.message || 'Too many attempts. Please wait and try again.');
                playSound();
                return;
            }
            if (res.status === 403 && data.vpnBlocked) {
                setError(data.message || 'Please turn off your VPN and try again.');
                playSound();
                return;
            }
            if (!res.ok) {
                setError(data.message || 'Login failed');
                playSound();
                return;
            }

            try { localStorage.removeItem(LOCK_KEY); } catch { /* ignore */ }
            // Session cookie is httpOnly: load the user from the server
            await refreshSession();
            toast.success(data.message || 'Login successful');
            playSound();
            navigate(next, { replace: true });
        } catch (err) {
            console.error('Login error:', err.message);
            setError('Could not reach the server. Check your connection and try again.');
            playSound();
        } finally {
            setSubmitting(false);
        }
    };

    const qs = next !== '/' ? `?next=${encodeURIComponent(next)}` : '';

    return (
        <AuthLayout
            title={<>Welcome <span style={{ color: 'var(--cf-red)' }}>back</span></>}
            subtitle={next.startsWith('/cart') || next.startsWith('/address') || next.startsWith('/payment') ? 'Sign in to continue to checkout.' : 'Sign in to order, track and save your favourites.'}
            footer={<>New to Cafe Fresco? <Link to={`/signup${qs}`}>Create an account</Link></>}
        >
            <form noValidate onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="fa-fields">
                <AuthField id="login-email" label="Email address" icon="bi-envelope" type="email" autoComplete="email" placeholder="you@example.com" value={formData.email} onChange={set('email')} error={fieldErr.email} autoFocus />
                <AuthField
                    id="login-password"
                    label="Password"
                    icon="bi-lock"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Your password"
                    value={formData.password}
                    onChange={set('password')}
                    error={fieldErr.password}
                    right={<Link to="/forgot">Forgot password?</Link>}
                />
                {error && <div className="fa-error" role="alert"><i className="bi bi-exclamation-circle" /> {error}</div>}
                {loginBlocked && (
                    <div className="fa-error" role="status">
                        <i className="bi bi-shield-lock" /> Too many attempts — for your safety, sign-in is paused. You can try again in {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}, or reset your password.
                    </div>
                )}
                <button type="submit" className="fh-btn fh-btn-red fa-submit" disabled={loginBlocked || submitting}>
                    {loginBlocked ? (
                        `Try again in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`
                    ) : submitting ? (
                        <>
                            <span className="spinner-border spinner-border-sm" aria-hidden="true" /> Signing in…
                        </>
                    ) : (
                        <>
                            Sign in <i className="bi bi-arrow-right" />
                        </>
                    )}
                </button>
            </form>
        </AuthLayout>
    );
};

export default LoginSection;
