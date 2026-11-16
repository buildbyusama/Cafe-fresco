import { useState, useContext, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import productContext from '../Context/ProductContext';
import AuthLayout, { AuthField, PasswordRules } from './auth/AuthLayout';

const ResetPassword = () => {
    const [password, setPassword] = useState({ new: '', confirm: '' });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [link, setLink] = useState('checking'); // checking | valid | invalid
    const { playSound, refreshSession } = useContext(productContext);
    const navigate = useNavigate();
    const BASE_URL = import.meta.env.VITE_BASE_URL;
    const { token } = useParams();

    // say "expired" before anyone types a new password twice
    useEffect(() => {
        fetch(`${BASE_URL}/user/reset-password/${encodeURIComponent(token)}`, { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : { valid: true })) // server trouble: let the submit decide
            .then((d) => setLink(d.valid ? 'valid' : 'invalid'))
            .catch(() => setLink('valid'));
    }, [token, BASE_URL]);

    const handleSubmit = async () => {
        if (loading) return;
        // Validate first, so a mistake never leaves the button stuck on "Updating…"
        const e = {};
        if (password.new.length < 8 || !/[A-Za-z]/.test(password.new) || !/[0-9]/.test(password.new)) e.new = 'At least 8 characters with a letter and a number';
        if (password.new !== password.confirm) e.confirm = 'Passwords do not match';
        setErrors(e);
        if (Object.keys(e).length) {
            document.getElementById(e.new ? 'newPassword' : 'confirmPassword')?.focus();
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/user/reset-password/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword: password.new }),
                credentials: 'include'
            });
            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                toast.success(data.message || 'Password reset successful');
                playSound();
                await refreshSession(); // server ended any old session
                navigate('/login', { replace: true });
            } else if (res.status === 400 && /invalid or has expired/i.test(data.message || '')) {
                setLink('invalid');
                playSound();
            } else {
                setErrors(data.fields?.newPassword ? { new: data.fields.newPassword } : { form: data.message || 'Could not reset the password' });
                playSound();
            }
        } catch (error) {
            console.error('Reset error:', error.message);
            setErrors({ form: 'Could not reach the server. Please try again.' });
            playSound();
        } finally {
            setLoading(false);
        }
    };

    const set = (k) => (ev) => {
        setPassword({ ...password, [k]: ev.target.value });
        if (errors[k] || errors.form) setErrors({ ...errors, [k]: undefined, form: undefined });
    };

    return (
        <AuthLayout
            title={link === 'invalid' ? <>Link <span style={{ color: 'var(--cf-red)' }}>expired</span></> : <>Set a new <span style={{ color: 'var(--cf-red)' }}>password</span></>}
            subtitle={link === 'valid' ? 'Choose a password you haven’t used here before.' : undefined}
            footer={<><Link to="/login">Back to sign in</Link></>}
        >
            {link === 'checking' ? (
                <div className="fa-status" aria-busy="true">
                    <span className="spinner-border text-danger" role="status" aria-label="Checking your link" />
                </div>
            ) : link === 'invalid' ? (
                <div className="fa-status" role="alert">
                    <i className="bi bi-hourglass-bottom bad" />
                    <h2>This reset link no longer works</h2>
                    <p>Reset links are valid for 10 minutes and can be used once. Ask for a new one — it only takes a moment.</p>
                    <Link to="/forgot" className="fh-btn fh-btn-red">Send me a new link</Link>
                </div>
            ) : (
                <form noValidate onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="fa-fields">
                    <div>
                        <AuthField id="newPassword" label="New password" icon="bi-lock" type="password" autoComplete="new-password" placeholder="Create a password" value={password.new} onChange={set('new')} error={errors.new} autoFocus />
                        <PasswordRules value={password.new} />
                    </div>
                    <AuthField
                        id="confirmPassword"
                        label="Confirm password"
                        icon="bi-shield-check"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Repeat it"
                        value={password.confirm}
                        onChange={set('confirm')}
                        error={errors.confirm}
                        hint={password.confirm && password.confirm === password.new ? '✓ Passwords match' : undefined}
                    />
                    {errors.form && <div className="fa-error" role="alert"><i className="bi bi-exclamation-circle" /> {errors.form}</div>}
                    <button type="submit" className="fh-btn fh-btn-red fa-submit" disabled={loading}>
                        {loading ? (
                            <>
                                <span className="spinner-border spinner-border-sm" aria-hidden="true" /> Updating…
                            </>
                        ) : (
                            <>
                                Reset Password <i className="bi bi-check2" />
                            </>
                        )}
                    </button>
                </form>
            )}
        </AuthLayout>
    );
};

export default ResetPassword;
