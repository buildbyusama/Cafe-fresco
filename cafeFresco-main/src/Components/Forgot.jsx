import { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import productContext from '../Context/ProductContext';
import AuthLayout, { AuthField } from './auth/AuthLayout';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Forgot = () => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [sentTo, setSentTo] = useState('');
    const { playSound } = useContext(productContext);
    const BASE_URL = import.meta.env.VITE_BASE_URL;
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (loading) return;
        if (!EMAIL_RE.test(email.trim())) {
            setError('Enter a valid email address');
            document.getElementById('email')?.focus();
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${BASE_URL}/user/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
                credentials: 'include'
            });
            const data = await res.json().catch(() => ({}));
            playSound();
            // the server answers the same way whether or not the account exists (no account guessing)
            if (res.ok) setSentTo(email.trim());
            else setError(data.message || 'Could not send the link. Please try again.');
        } catch (err) {
            console.error('Error occurred:', err.message);
            setError('Could not reach the server. Please try again.');
            playSound();
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title={sentTo ? <>Check your <span style={{ color: 'var(--cf-red)' }}>email</span></> : <>Forgot your <span style={{ color: 'var(--cf-red)' }}>password?</span></>}
            subtitle={sentTo ? undefined : "No worries — enter your email and we'll send you a link to set a new one."}
            footer={<>Remembered it? <Link to="/login">Back to sign in</Link></>}
        >
            {sentTo ? (
                <div className="fa-status" role="status">
                    <i className="bi bi-envelope-check ok" />
                    <h2>Link sent</h2>
                    <p>
                        If an account exists for <b>{sentTo}</b>, a reset link is on its way. It works for <b>10 minutes</b> — check your spam folder if you don&apos;t see it.
                    </p>
                    <button type="button" className="fh-btn fh-btn-ghost" onClick={() => { setSentTo(''); }}>
                        Use a different email
                    </button>
                </div>
            ) : (
                <form noValidate onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="fa-fields">
                    <AuthField
                        id="email"
                        label="Email address"
                        icon="bi-envelope"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                        error={error}
                        autoFocus
                    />
                    <button type="submit" className="fh-btn fh-btn-red fa-submit" disabled={loading}>
                        {loading ? (
                            <>
                                <span className="spinner-border spinner-border-sm" aria-hidden="true" /> Sending…
                            </>
                        ) : (
                            <>
                                Send Reset Link <i className="bi bi-send" />
                            </>
                        )}
                    </button>
                </form>
            )}
        </AuthLayout>
    );
};

export default Forgot;
