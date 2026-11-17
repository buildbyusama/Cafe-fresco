import './CSS/menu.css';
import './CSS/account.css';
import { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import productContext from '../Context/ProductContext';
import toast from 'react-hot-toast';
import { apiFetch } from '../api';
import AvatarPicker from './account/AvatarPicker';

// Mirrors the backend rules (utils/validation.js PHONE_REGEX, update-profile limits)
const PHONE_REGEX = /^\+?[0-9\s-]{7,15}$/;
const FIELDS = ['name', 'phone', 'address'];
const validate = (f) => {
    const errors = {};
    if (f.name.trim().length < 2 || f.name.trim().length > 60) errors.name = 'Name must be 2–60 characters';
    if (f.phone.trim() && !PHONE_REGEX.test(f.phone.trim())) errors.phone = 'Enter a valid phone number';
    if (f.address.trim().length > 200) errors.address = 'Address must be at most 200 characters';
    return errors;
};

const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';

const UserProfile = () => {
    // The session user (GET /user/me) is the source; refreshSession reloads it after a save
    const { user, authStatus, refreshSession, playSound, wishlist, cart } = useContext(productContext);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({ name: '', phone: '', address: '' });
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [sendingReset, setSendingReset] = useState(false);
    const [resetSent, setResetSent] = useState(false);

    const startEdit = () => {
        setForm({ name: user?.name || '', phone: user?.phone || '', address: user?.address || '' });
        setErrors({});
        setEditing(true);
        setTimeout(() => document.getElementById('profile-name')?.focus(), 0);
    };

    const setField = (k) => (e) => {
        setForm({ ...form, [k]: e.target.value });
        if (errors[k]) setErrors({ ...errors, [k]: undefined });
    };

    const save = async (e) => {
        e.preventDefault();
        if (saving) return;
        const v = validate(form);
        setErrors(v);
        const first = FIELDS.find((k) => v[k]);
        if (first) {
            document.getElementById(`profile-${first}`)?.focus();
            return;
        }
        setSaving(true);
        const { ok, data } = await apiFetch('/user/update-profile', { method: 'PUT', body: { name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim() } });
        setSaving(false);
        playSound();
        if (!ok) {
            setErrors(data?.fields || {});
            toast.error(data?.message || 'Could not save your profile');
            return;
        }
        await refreshSession();
        toast.success('Profile updated');
        setEditing(false);
    };

    const handleReset = async () => {
        if (!user?.email || sendingReset) return;
        setSendingReset(true);
        const { ok, data } = await apiFetch('/user/forgot-password', { method: 'POST', body: { email: user.email } });
        setSendingReset(false);
        playSound();
        if (ok) {
            setResetSent(true);
            toast.success(data?.message || 'Check your email for a reset link');
        } else toast.error(data?.message || 'Could not send the reset email');
    };

    if (authStatus === 'loading' || !user) {
        return (
            <main className="fh">
                <section className="fh-wrap fx-body" style={{ paddingTop: 50 }} aria-busy="true">
                    <div className="fh-skel" style={{ height: 180, borderRadius: 28, marginBottom: 18 }} />
                    <div className="fh-skel" style={{ height: 320, borderRadius: 28 }} />
                </section>
            </main>
        );
    }

    const rows = [
        { key: 'name', label: 'Full name', icon: 'bi-person', value: user.name },
        { key: 'phone', label: 'Phone', icon: 'bi-telephone', value: user.phone, placeholder: '+92 300 1234567' },
        { key: 'email', label: 'Email', icon: 'bi-envelope', value: user.email, readOnly: true },
        { key: 'address', label: 'Delivery address', icon: 'bi-geo-alt', value: user.address, placeholder: 'House, street, area, city' },
    ];

    const cartCount = (cart || []).reduce((n, i) => n + (i.quantity || 0), 0);

    return (
        <main className="fh">
            <section className="fh-wrap fx-body" style={{ paddingTop: 34 }}>
                <nav className="fm-crumbs" aria-label="Breadcrumb">
                    <Link to="/">Home</Link> <i className="bi bi-chevron-right" style={{ fontSize: '0.7rem' }} /> <span>My profile</span>
                </nav>

                <div className="fp-card-hero">
                    <AvatarPicker initials={initials(user.name)} />
                    <div className="fp-who">
                        <h1 data-testid="profile-heading">{user.name}</h1>
                        <p>{user.email}</p>
                    </div>
                    <div className="fp-quick">
                        <Link to="/track"><i className="bi bi-receipt" /> My orders</Link>
                        <Link to="/wishlist"><i className="bi bi-heart" /> Wishlist <b>{wishlist?.length || 0}</b></Link>
                        <Link to="/cart"><i className="bi bi-bag" /> Cart <b>{cartCount}</b></Link>
                    </div>
                </div>

                <div className="fp-grid">
                    <form className="fp-panel" onSubmit={save} noValidate>
                        <div className="fp-panel-head">
                            <h2>Profile information</h2>
                            {!editing && (
                                <button type="button" className="fh-btn fh-btn-ghost fp-edit" onClick={startEdit}>
                                    <i className="bi bi-pencil" /> Edit profile
                                </button>
                            )}
                        </div>

                        <div className="fp-rows">
                            {rows.map((item) => (
                                <div className={`fp-row${item.key === 'address' || item.key === 'email' ? ' is-wide' : ''}`} key={item.key}>
                                    <label htmlFor={`profile-${item.key}`}>
                                        <i className={`bi ${item.icon}`} /> {item.label}
                                    </label>
                                    {editing && !item.readOnly ? (
                                        <>
                                            {item.key === 'address' ? (
                                                <textarea id={`profile-${item.key}`} name={item.key} className={`fp-input${errors[item.key] ? ' is-invalid' : ''}`} rows="3" maxLength={200} placeholder={item.placeholder} value={form[item.key]} onChange={setField(item.key)} />
                                            ) : (
                                                <input id={`profile-${item.key}`} name={item.key} className={`fp-input${errors[item.key] ? ' is-invalid' : ''}`} placeholder={item.placeholder} autoComplete={item.key === 'phone' ? 'tel' : 'name'} value={form[item.key]} onChange={setField(item.key)} />
                                            )}
                                            {errors[item.key] && <div className="invalid-feedback d-block" role="alert">{errors[item.key]}</div>}
                                            {item.key === 'address' && <div className="fp-count">{form.address.length}/200</div>}
                                        </>
                                    ) : (
                                        <div className="fp-value" id={`profile-${item.key}`} data-testid={`profile-${item.key}`}>
                                            <span className={item.value ? '' : 'is-empty'}>{item.value || 'Not set'}</span>
                                            {editing && item.readOnly && <small>Contact us to change your email.</small>}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {editing && (
                            <div className="fp-actions">
                                <button type="submit" className="fh-btn fh-btn-red" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                                <button type="button" className="fh-btn fh-btn-ghost" disabled={saving} onClick={() => setEditing(false)}>Cancel</button>
                            </div>
                        )}
                    </form>

                    <aside className="fp-panel fp-security">
                        <h2>Password &amp; security</h2>
                        <p>We&apos;ll email a secure link to <b>{user.email}</b> so you can choose a new password. The link works for 10 minutes.</p>
                        {resetSent ? (
                            <div className="fp-sent" role="status"><i className="bi bi-envelope-check" /> Reset link sent — check your inbox.</div>
                        ) : (
                            <button type="button" className="fh-btn fh-btn-red" disabled={sendingReset} onClick={handleReset}>
                                <i className="bi bi-shield-lock" /> {sendingReset ? 'Sending…' : 'Send password reset email'}
                            </button>
                        )}
                    </aside>
                </div>
            </section>
        </main>
    );
};

export default UserProfile;
