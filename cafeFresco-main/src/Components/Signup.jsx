import { useEffect, useState, useContext } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import productContext from '../Context/ProductContext';
import { safeNext } from '../utils/safeNext';
import AuthLayout, { AuthField, PasswordRules } from './auth/AuthLayout';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORDER = ['name', 'email', 'password', 'confirm'];

// Same rules as the server (backend utils/validation.js)
const validate = (f) => {
    const errors = {};
    const name = f.name.trim();
    if (name.length < 2 || name.length > 60) errors.name = 'Name must be 2–60 characters';
    if (!EMAIL_RE.test(f.email.trim())) errors.email = 'Enter a valid email address';
    if (f.password.length < 8) errors.password = 'Password must be at least 8 characters';
    else if (!/[A-Za-z]/.test(f.password) || !/[0-9]/.test(f.password)) errors.password = 'Password must contain at least one letter and one number';
    if (f.confirm !== f.password) errors.confirm = 'Passwords do not match';
    return errors;
};

const SignUp = () => {
    const BASE_URL = import.meta.env.VITE_BASE_URL;
    const { playSound, refreshSession, authStatus } = useContext(productContext);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const next = safeNext(searchParams.get('next'));
    const [formData, setFormData] = useState({ name: '', email: '', password: '', confirm: '' });
    const [errors, setErrors] = useState({});
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (authStatus === 'authenticated') navigate(next, { replace: true });
    }, [authStatus]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (name) => (e) => {
        setFormData({ ...formData, [name]: e.target.value });
        if (errors[name]) setErrors({ ...errors, [name]: undefined });
        if (formError) setFormError('');
    };

    const handleRegister = async () => {
        if (submitting) return;
        const found = validate(formData);
        setErrors(found);
        const first = ORDER.find((k) => found[k]);
        if (first) {
            document.getElementById(`signup-${first}`)?.focus();
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`${BASE_URL}/user/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: formData.name.trim(), email: formData.email.trim(), password: formData.password }),
                credentials: 'include'
            });
            const data = await res.json().catch(() => ({}));

            if (res.status === 403 && data.vpnBlocked) {
                setFormError(data.message || 'Please turn off your VPN and try again.');
                playSound();
                return;
            }
            if (!res.ok) {
                if (data.fields) setErrors(data.fields);
                else setFormError(data.message || 'Sign up failed');
                toast.error(data.message || 'Sign up failed');
                playSound();
                return;
            }

            await refreshSession();
            toast.success(data.message || 'Welcome!');
            playSound();
            navigate(next, { replace: true });
        } catch (error) {
            console.error('Signup error:', error.message);
            setFormError('Could not reach the server. Check your connection and try again.');
            playSound();
        } finally {
            setSubmitting(false);
        }
    };

    const qs = next !== '/' ? `?next=${encodeURIComponent(next)}` : '';

    return (
        <AuthLayout
            title={<>Create your <span style={{ color: 'var(--cf-red)' }}>account</span></>}
            subtitle="It takes less than a minute — then your favourites are one tap away."
            perks={['Save dishes to your wishlist', 'Track every order live', 'Faster checkout next time']}
            footer={<>Already have an account? <Link to={`/login${qs}`}>Sign in</Link></>}
        >
            <form noValidate onSubmit={(e) => { e.preventDefault(); handleRegister(); }} className="fa-fields">
                <AuthField id="signup-name" label="Full name" icon="bi-person" autoComplete="name" placeholder="Your name" value={formData.name} onChange={setField('name')} error={errors.name} autoFocus />
                <AuthField id="signup-email" label="Email address" icon="bi-envelope" type="email" autoComplete="email" placeholder="you@example.com" value={formData.email} onChange={setField('email')} error={errors.email} />
                <div>
                    <AuthField id="signup-password" label="Password" icon="bi-lock" type="password" autoComplete="new-password" placeholder="Create a password" value={formData.password} onChange={setField('password')} error={errors.password} />
                    <PasswordRules value={formData.password} />
                </div>
                <AuthField
                    id="signup-confirm"
                    label="Confirm password"
                    icon="bi-shield-check"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    value={formData.confirm}
                    onChange={setField('confirm')}
                    error={errors.confirm}
                    hint={formData.confirm && formData.confirm === formData.password ? '✓ Passwords match' : undefined}
                />
                {formError && <div className="fa-error" role="alert"><i className="bi bi-exclamation-circle" /> {formError}</div>}
                <button type="submit" className="fh-btn fh-btn-red fa-submit" disabled={submitting}>
                    {submitting ? (
                        <>
                            <span className="spinner-border spinner-border-sm" aria-hidden="true" /> Creating account…
                        </>
                    ) : (
                        <>
                            Register <i className="bi bi-arrow-right" />
                        </>
                    )}
                </button>
            </form>
        </AuthLayout>
    );
};

export default SignUp;
