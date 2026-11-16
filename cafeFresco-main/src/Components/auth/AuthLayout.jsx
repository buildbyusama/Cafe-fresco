import PropTypes from 'prop-types';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../../assets/logo/logo-transparent.png';
import chef from '../../assets/Products/healthy.png';
import '../CSS/landing.css';
import '../CSS/auth.css';

// Split screen for every auth page: brand panel (left) + form card (right)
export default function AuthLayout({ title, subtitle, children, footer, perks }) {
    return (
        <main className="fh fa-auth">
            <div className="fa-auth-card">
                <aside className="fa-brand" aria-hidden="true">
                    <Link to="/" tabIndex={-1} className="fa-brand-logo">
                        <img src={logo} alt="" />
                    </Link>
                    <h2>
                        Fresh food,<br />
                        <span>delivered hot.</span>
                    </h2>
                    <ul>
                        {(perks || ['Order your favourites in a minute', 'Track every order live', 'Card or cash on delivery']).map((t) => (
                            <li key={t}><i className="bi bi-check-circle-fill" /> {t}</li>
                        ))}
                    </ul>
                    <div className="fa-brand-art">
                        <div className="fa-brand-circle" />
                        <img src={chef} alt="" />
                    </div>
                </aside>
                <section className="fa-form">
                    <Link to="/" className="fa-mobile-logo" aria-label="Cafe Fresco home">
                        <img src={logo} alt="Cafe Fresco" />
                    </Link>
                    <h1 className="fa-title">{title}</h1>
                    {subtitle && <p className="fa-sub">{subtitle}</p>}
                    {children}
                    {footer && <div className="fa-foot">{footer}</div>}
                </section>
            </div>
        </main>
    );
}

AuthLayout.propTypes = { title: PropTypes.node, subtitle: PropTypes.node, children: PropTypes.node, footer: PropTypes.node, perks: PropTypes.array };

// Input with an icon, label, error and an optional show/hide toggle for passwords
export function AuthField({ id, label, icon, type = 'text', value, onChange, error, autoComplete, placeholder, hint, autoFocus, right }) {
    const [show, setShow] = useState(false);
    const isPw = type === 'password';
    return (
        <div className="fa-field">
            <div className="fa-label-row">
                <label htmlFor={id}>{label}</label>
                {right}
            </div>
            <div className="fa-input">
                <i className={`bi ${icon}`} />
                <input
                    id={id}
                    name={id}
                    type={isPw && show ? 'text' : type}
                    value={value}
                    onChange={onChange}
                    autoComplete={autoComplete}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
                    className={error ? 'is-invalid' : ''}
                />
                {isPw && (
                    <button type="button" className="fa-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
                        <i className={show ? 'bi bi-eye-slash' : 'bi bi-eye'} />
                    </button>
                )}
            </div>
            {error ? (
                <div className="invalid-feedback d-block" id={`${id}-err`} role="alert">{error}</div>
            ) : (
                hint && <div className="fa-hint" id={`${id}-hint`}>{hint}</div>
            )}
        </div>
    );
}

AuthField.propTypes = {
    id: PropTypes.string.isRequired, label: PropTypes.node, icon: PropTypes.string, type: PropTypes.string, value: PropTypes.string, onChange: PropTypes.func,
    error: PropTypes.string, autoComplete: PropTypes.string, placeholder: PropTypes.string, hint: PropTypes.node, autoFocus: PropTypes.bool, right: PropTypes.node
};

// Live checklist for the password rules the server applies (8+ chars, a letter, a number)
export function PasswordRules({ value }) {
    const rules = [
        [value.length >= 8, 'At least 8 characters'],
        [/[A-Za-z]/.test(value), 'A letter'],
        [/[0-9]/.test(value), 'A number']
    ];
    return (
        <ul className="fa-rules" aria-label="Password rules">
            {rules.map(([ok, text]) => (
                <li key={text} className={ok ? 'ok' : ''}>
                    <i className={ok ? 'bi bi-check-circle-fill' : 'bi bi-circle'} /> {text}
                </li>
            ))}
        </ul>
    );
}

PasswordRules.propTypes = { value: PropTypes.string };
