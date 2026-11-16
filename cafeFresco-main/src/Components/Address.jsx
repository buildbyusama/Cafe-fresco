import { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import productContext from '../Context/ProductContext';
import { formatMoney } from '../utils/price';
import CheckoutSteps from './checkout/CheckoutSteps';
import { imgUrl, onImgError } from './home/useHomeData';
import './CSS/landing.css';
import './CSS/menu.css';
import './CSS/checkout.css';

// Same rules the server applies (backend utils/validation.js validateShippingAddress)
const PHONE_REGEX = /^\+?[0-9\s-]{7,15}$/;
const validate = (a) => {
    const errors = {};
    if (a.fullName.trim().length < 2 || a.fullName.trim().length > 60) errors.fullName = 'Full name must be 2–60 characters';
    if (!PHONE_REGEX.test(a.phone.trim())) errors.phone = 'Enter a valid phone number';
    if (a.city.trim().length < 2 || a.city.trim().length > 60) errors.city = 'City must be 2–60 characters';
    if (!/^[A-Za-z0-9 -]{3,10}$/.test(a.zip.trim())) errors.zip = 'Enter a valid postal code';
    if (a.line1.trim().length < 5 || a.line1.trim().length > 200) errors.line1 = 'Address must be 5–200 characters';
    return errors;
};

const FIELDS = [
    ['fullName', 'Full name', 'bi-person', 'text', 'name', 'Your name'],
    ['phone', 'Phone', 'bi-telephone', 'tel', 'tel', '0300 1234567'],
    ['line1', 'Street address', 'bi-house-door', 'text', 'street-address', 'House, street, area'],
    ['city', 'City', 'bi-building', 'text', 'address-level2', 'e.g. Lahore'],
    ['zip', 'Postal code', 'bi-mailbox', 'text', 'postal-code', 'e.g. 54000']
];

const Address = () => {
    const navigate = useNavigate();
    const { shippingAddress, setShippingAddress, cart, cartLoaded, subtotal, totalPrice, discountApplied, discountAmount, appliedCode } = useContext(productContext);
    const BASE_URL = import.meta.env.VITE_BASE_URL;
    const [addressDetail, setAddressDetail] = useState(shippingAddress || { fullName: '', phone: '', city: '', zip: '', line1: '' });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // Prefill from the customer's saved profile when nothing was entered yet
    useEffect(() => {
        if (shippingAddress) return;
        fetch(`${BASE_URL}/user/user-info`, { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                const u = data?.user;
                if (u) setAddressDetail((prev) => ({ ...prev, fullName: prev.fullName || u.name || '', phone: prev.phone || u.phone || '', line1: prev.line1 || u.address || '' }));
            })
            .catch(() => {});
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Nothing to deliver, or something can't be bought: back to the cart
    useEffect(() => {
        if (cartLoaded && (cart.length === 0 || cart.some((i) => i.available === false))) navigate('/cart', { replace: true });
    }, [cartLoaded, cart]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleChange = (e) => {
        const { name, value } = e.target;
        setAddressDetail((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const found = validate(addressDetail);
        setErrors(found);
        if (Object.keys(found).length) {
            // focus the first problem in the order the fields appear on screen
            const first = FIELDS.find(([name]) => found[name])?.[0];
            document.querySelector(`[name="${first}"]`)?.focus();
            return;
        }
        const trimmed = Object.fromEntries(Object.entries(addressDetail).map(([k, v]) => [k, v.trim()]));
        setShippingAddress(trimmed);
        navigate('/payment');
    };

    return (
        <main className="fh">
            <div className="fh-wrap">
                <div className="fk-head">
                    <nav className="fm-crumbs" aria-label="Breadcrumb">
                        <Link to="/">Home</Link> <i className="bi bi-chevron-right" style={{ fontSize: '0.65rem' }} /> <Link to="/cart">Cart</Link>{' '}
                        <i className="bi bi-chevron-right" style={{ fontSize: '0.65rem' }} /> <span style={{ color: 'var(--cf-ink)', fontWeight: 600 }}>Delivery</span>
                    </nav>
                    <h1 className="fk-title">
                        Delivery <em>Details</em>
                    </h1>
                </div>
                <CheckoutSteps current="address" />

                <div className="fk-grid">
                    <form className="fk-panel" onSubmit={handleSubmit} noValidate>
                        <h2>Where should we deliver?</h2>
                        <p className="fk-panel-sub">We&apos;ll call this number if the rider can&apos;t find you.</p>
                        <div className="fk-fields">
                            {FIELDS.map(([name, label, icon, type, auto, ph]) => (
                                <div key={name} className={`fk-field${name === 'line1' ? ' full' : ''}`}>
                                    <label htmlFor={`addr-${name}`}>
                                        {label} <em>*</em>
                                    </label>
                                    <div className="fk-input">
                                        <i className={`bi ${icon}`} />
                                        <input
                                            id={`addr-${name}`}
                                            name={name}
                                            type={type}
                                            autoComplete={auto}
                                            placeholder={ph}
                                            value={addressDetail[name]}
                                            onChange={handleChange}
                                            className={errors[name] ? 'is-invalid' : ''}
                                            aria-invalid={!!errors[name]}
                                            aria-describedby={errors[name] ? `addr-${name}-err` : undefined}
                                        />
                                    </div>
                                    {errors[name] && <div className="invalid-feedback d-block" id={`addr-${name}-err`}>{errors[name]}</div>}
                                </div>
                            ))}
                        </div>
                        <div className="fk-actions">
                            <button type="button" onClick={() => navigate('/cart')} className="fh-btn fk-back">
                                <i className="bi bi-arrow-left" /> Go back
                            </button>
                            <button type="submit" className="fh-btn fh-btn-red">
                                Continue to payment <i className="bi bi-arrow-right" />
                            </button>
                        </div>
                    </form>

                    <aside className="fk-panel fk-summary" aria-label="Your order">
                        <h2>Your order</h2>
                        <p className="fk-panel-sub">{cart.length} {cart.length === 1 ? 'dish' : 'dishes'}</p>
                        <ul className="fk-mini">
                            {cart.map((i) => (
                                <li key={i.productId}>
                                    <img src={imgUrl(i.image)} onError={onImgError} alt="" />
                                    <div>
                                        <b>{i.title}</b>
                                        <small>{i.quantity} × {formatMoney(i.price)}</small>
                                    </div>
                                    <strong>{formatMoney(i.price * i.quantity)}</strong>
                                </li>
                            ))}
                        </ul>
                        <div className="fk-rows">
                            <div className="fk-row"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
                            {discountApplied && <div className="fk-row is-off"><span>Discount ({appliedCode})</span><span>−{formatMoney(discountAmount)}</span></div>}
                            <div className="fk-row"><span>Delivery</span><span style={{ color: '#1e7a45', fontWeight: 600 }}>Free</span></div>
                        </div>
                        <div className="fk-total" style={{ marginBottom: 0 }}>
                            <span>Total</span>
                            <h3>{formatMoney(totalPrice)}</h3>
                        </div>
                    </aside>
                </div>
            </div>
        </main>
    );
};

export default Address;
