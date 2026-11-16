import { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import productContext from '../Context/ProductContext';
import { apiFetch } from '../api';
import useStoreSettings, { hoursSummary } from '../hooks/useStoreSettings';
import './CSS/landing.css';
import './CSS/menu.css';
import './CSS/pages.css';

const EMPTY = { name: '', email: '', phone: '', subject: '', message: '' };
// Same limits as the backend /user/contact
const PHONE_REGEX = /^\+?[0-9\s-]{7,15}$/;
const validate = (f) => {
    const e = {};
    if (f.name.trim().length < 2 || f.name.trim().length > 60) e.name = 'Name must be 2–60 characters';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Enter a valid email';
    if (f.phone.trim() && !PHONE_REGEX.test(f.phone.trim())) e.phone = 'Enter a valid phone number';
    if (f.subject.trim().length < 3 || f.subject.trim().length > 120) e.subject = 'Subject must be 3–120 characters';
    if (f.message.trim().length < 10 || f.message.trim().length > 2000) e.message = 'Message must be 10–2000 characters';
    return e;
};

// Quick topics prefill the subject
const TOPICS = ['Order help', 'Catering & big orders', 'Feedback', 'Something else'];

// Answers that match how the shop actually works
const FAQ = [
    ['How can I pay?', 'Pay securely by card online, or choose cash on delivery at checkout.'],
    ['How long does delivery take?', 'It depends on your area and how busy the kitchen is. You can follow every step of your order under My Orders.'],
    ['Can I cancel my order?', 'Yes — while an order is still pending and unpaid you can cancel it yourself from My Orders. After that, send us a message and we will help.'],
    ['How do discount codes work?', 'Enter your code in the cart before checkout. Each code has its own rules, such as a minimum order or an expiry date.'],
    ['Can I leave a review?', 'Reviews are open for dishes you have received, so every review comes from a real order.']
];

const Contact = () => {
    const { playSound, user, authStatus } = useContext(productContext);
    const store = useStoreSettings();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState(EMPTY);
    const [errors, setErrors] = useState({});
    const [sentTo, setSentTo] = useState('');

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // signed-in customers don't retype their name and email
    useEffect(() => {
        if (authStatus === 'authenticated' && user) {
            setFormData((f) => ({ ...f, name: f.name || user.name || '', email: f.email || user.email || '', phone: f.phone || user.phone || '' }));
        }
    }, [authStatus, user]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: undefined });
    };

    const pickTopic = (t) => {
        setFormData((f) => ({ ...f, subject: f.subject === t ? '' : t }));
        if (errors.subject) setErrors((e) => ({ ...e, subject: undefined }));
        document.getElementById('message')?.focus();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return;
        const v = validate(formData);
        setErrors(v);
        if (Object.keys(v).length) {
            document.getElementById(Object.keys(v)[0])?.focus();
            return;
        }
        setLoading(true);
        const { ok, status, data } = await apiFetch('/user/contact', { method: 'POST', body: formData });
        setLoading(false);
        playSound();
        if (ok) {
            toast.success(data?.message || 'Message sent!');
            setSentTo(formData.name.trim().split(/\s+/)[0]);
            setFormData(EMPTY);
            setErrors({});
        } else if (status === 429) {
            toast.error('Too many messages, please try again later.');
        } else {
            setErrors(data?.fields || {});
            toast.error(data?.message || 'Something went wrong.');
        }
    };

    const field = (id, label, icon, opts = {}) => (
        <div className={`fc-field${opts.full ? ' full' : ''}`}>
            <label htmlFor={id}>
                {label} {opts.required && <em>*</em>}
            </label>
            <div className="fc-input">
                <i className={`bi ${icon}`} />
                {opts.textarea ? (
                    <textarea id={id} name={id} rows="5" value={formData[id]} onChange={handleChange} maxLength={2000} aria-invalid={!!errors[id]} placeholder={opts.placeholder} />
                ) : (
                    <input id={id} name={id} type={opts.type || 'text'} value={formData[id]} onChange={handleChange} aria-invalid={!!errors[id]} placeholder={opts.placeholder} autoComplete={opts.autoComplete} required={opts.required} />
                )}
            </div>
            {errors[id] && <div className="fc-err" role="alert">{errors[id]}</div>}
            {opts.textarea && !errors[id] && <span className="fc-count">{formData[id].length}/2000</span>}
        </div>
    );

    const contact = store?.contact || {};
    const hours = hoursSummary(store?.hours);
    const info = [
        contact.phone && ['bi-telephone', 'Call us', contact.phone, `tel:${contact.phone.replace(/s/g, '')}`, '#3E9B48'],
        contact.email && ['bi-envelope', 'Email', contact.email, `mailto:${contact.email}`, '#1C8C9E'],
        contact.address && ['bi-geo-alt', 'Visit us', contact.address, contact.mapUrl || null, '#E8262B'],
        hours && ['bi-clock', store.openNow === true ? 'Open now' : store.openNow === false ? 'Closed now' : 'Opening hours', hours, null, '#F2B705']
    ].filter(Boolean);

    return (
        <main className="fh">
            <section className="fh-wrap fp-hero">
                <nav className="fm-crumbs" aria-label="Breadcrumb">
                    <Link to="/">Home</Link> <i className="bi bi-chevron-right" style={{ fontSize: '0.65rem' }} /> <span style={{ color: 'var(--cf-ink)', fontWeight: 600 }}>Contact</span>
                </nav>
                <div className="fh-center" style={{ paddingTop: 20 }}>
                    <div className="fh-eyebrow">We&apos;re here to help</div>
                    <h1 className="fp-title" style={{ marginBottom: 10 }}>
                        Get in <em>Touch</em>
                    </h1>
                    <p className="fp-lead" style={{ margin: '0 auto' }}>
                        A question about an order, a big group lunch, or just feedback on your meal — send us a message and our team will get back to you.
                    </p>
                </div>

                <div className="fc-grid">
                    <aside className="fc-side">
                        <Link to="/track" className="fc-card" style={{ '--c': '#E8262B' }}>
                            <i className="bi bi-truck" />
                            <div><b>Where&apos;s my order?</b><span>Follow it live from our kitchen to your door.</span></div>
                            <i className="bi bi-chevron-right" />
                        </Link>
                        <button type="button" className="fc-card" style={{ '--c': '#FF8A1F' }} onClick={() => pickTopic('Catering & big orders')}>
                            <i className="bi bi-people" />
                            <div><b>Catering &amp; big orders</b><span>Office lunches, parties, family events.</span></div>
                            <i className="bi bi-chevron-right" />
                        </button>
                        <button type="button" className="fc-card" style={{ '--c': '#3E9B48' }} onClick={() => pickTopic('Feedback')}>
                            <i className="bi bi-chat-heart" />
                            <div><b>Share feedback</b><span>Loved a dish or something wasn&apos;t right? Tell us.</span></div>
                            <i className="bi bi-chevron-right" />
                        </button>
                        <Link to="/products" className="fc-card" style={{ '--c': '#F2B705' }}>
                            <i className="bi bi-journal-text" />
                            <div><b>Browse the menu</b><span>Prices, discounts and what&apos;s in stock right now.</span></div>
                            <i className="bi bi-chevron-right" />
                        </Link>
                        {info.map(([icon, title, text, href, c]) =>
                            href ? (
                                <a key={title} href={href} className="fc-card" style={{ '--c': c }} {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                                    <i className={`bi ${icon}`} />
                                    <div><b>{title}</b><span>{text}</span></div>
                                    <i className="bi bi-chevron-right" />
                                </a>
                            ) : (
                                <div key={title} className="fc-card" style={{ '--c': c }}>
                                    <i className={`bi ${icon}`} />
                                    <div><b>{title}</b><span>{text}</span></div>
                                    <span />
                                </div>
                            )
                        )}
                    </aside>

                    <div className="fc-form">
                        {sentTo ? (
                            <div className="fc-done" role="status">
                                <i className="bi bi-check-lg" />
                                <h2>Thanks, {sentTo}!</h2>
                                <p>Your message is on its way to our team. We&apos;ll reply to the email address you gave us.</p>
                                <button type="button" className="fh-btn fh-btn-ghost" onClick={() => setSentTo('')}>Send another message</button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} noValidate>
                                <h2>Send us a message</h2>
                                <p className="fc-form-sub">Fields marked <em style={{ color: 'var(--cf-red)', fontStyle: 'normal' }}>*</em> are required.</p>
                                <div className="fc-topics" role="group" aria-label="Topic">
                                    {TOPICS.map((t) => (
                                        <button key={t} type="button" className={`fc-topic${formData.subject === t ? ' is-on' : ''}`} aria-pressed={formData.subject === t} onClick={() => pickTopic(t)}>
                                            {t}
                                        </button>
                                    ))}
                                </div>
                                <div className="fc-fields">
                                    {field('name', 'Full name', 'bi-person', { required: true, full: true, autoComplete: 'name', placeholder: 'Your name' })}
                                    {field('email', 'Email', 'bi-envelope', { required: true, type: 'email', autoComplete: 'email', placeholder: 'you@example.com' })}
                                    {field('phone', 'Phone (optional)', 'bi-telephone', { type: 'tel', autoComplete: 'tel', placeholder: '0300 1234567' })}
                                    {field('subject', 'Subject', 'bi-tag', { required: true, full: true, placeholder: 'What is it about?' })}
                                    {field('message', 'Message', 'bi-chat-left-text', { required: true, full: true, textarea: true, placeholder: 'Tell us how we can help…' })}
                                </div>
                                <button type="submit" className="fh-btn fh-btn-red fc-submit" disabled={loading}>
                                    {loading ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm" aria-hidden="true" /> Sending…
                                        </>
                                    ) : (
                                        <>
                                            <i className="bi bi-send" /> Send Message
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </section>

            <section className="fh-wrap fh-section">
                <div className="fh-center">
                    <div className="fh-eyebrow">Quick answers</div>
                    <h2 className="fh-h2">Frequently Asked Questions</h2>
                    <div className="fh-rule" />
                </div>
                <div className="fc-faq">
                    {FAQ.map(([q, a], i) => (
                        <details key={q} open={i === 0}>
                            <summary>{q}</summary>
                            <p>{a}</p>
                        </details>
                    ))}
                </div>
            </section>
        </main>
    );
};

export default Contact;
