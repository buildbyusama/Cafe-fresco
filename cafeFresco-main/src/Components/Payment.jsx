import { useContext, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import productContext from '../Context/ProductContext';
import { formatMoney } from '../utils/price';
import WrappedPaymentForm from './StripePayment';
import CheckoutSteps from './checkout/CheckoutSteps';
import { imgUrl, onImgError } from './home/useHomeData';
import './CSS/landing.css';
import './CSS/menu.css';
import './CSS/checkout.css';

const Payment = () => {
    // Every number comes from the derived cart values (same as the cart page)
    const { cart, subtotal, totalPrice, discountAmount, discountApplied, appliedCode, shippingAddress, user, cartLoaded } = useContext(productContext);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // Checkout must be walked in order: cart → address → payment
    if (cartLoaded && cart.length === 0) return <Navigate to="/cart" replace />;
    if (cartLoaded && cart.some((item) => item.available === false)) return <Navigate to="/cart" replace />;
    if (!shippingAddress) return <Navigate to="/address" replace />;

    return (
        <main className="fh">
            <div className="fh-wrap">
                <div className="fk-head">
                    <nav className="fm-crumbs" aria-label="Breadcrumb">
                        <Link to="/">Home</Link> <i className="bi bi-chevron-right" style={{ fontSize: '0.65rem' }} /> <Link to="/cart">Cart</Link>{' '}
                        <i className="bi bi-chevron-right" style={{ fontSize: '0.65rem' }} /> <span style={{ color: 'var(--cf-ink)', fontWeight: 600 }}>Payment</span>
                    </nav>
                    <h1 className="fk-title">
                        Secure <em>Payment</em>
                    </h1>
                </div>
                <CheckoutSteps current="payment" />

                <div className="fk-grid">
                    <div style={{ display: 'grid', gap: 18 }}>
                        <section className="fk-panel" data-testid="delivery">
                            <div className="fk-address">
                                <i className="bi bi-geo-alt-fill" />
                                <div>
                                    <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Delivery to</p>
                                    <b>{shippingAddress.fullName}</b>
                                    <p>{shippingAddress.line1}</p>
                                    <p>{shippingAddress.city} {shippingAddress.zip}</p>
                                    <p>{shippingAddress.phone}{user?.email ? ` · ${user.email}` : ''}</p>
                                </div>
                                <Link to="/address" className="fk-edit">Edit</Link>
                            </div>
                        </section>

                        <section className="fk-panel">
                            <h2>How would you like to pay?</h2>
                            <p className="fk-panel-sub">Your total is checked again by our server before anything is charged.</p>
                            <WrappedPaymentForm totalPrice={totalPrice} originalTotal={subtotal} />
                        </section>
                    </div>

                    <aside className="fk-panel fk-summary" data-testid="order-summary" aria-label="Order summary">
                        <h2>Order summary</h2>
                        <p className="fk-panel-sub">{cart.length} {cart.length === 1 ? 'dish' : 'dishes'}</p>
                        <ul className="fk-mini">
                            {cart.map((item) => (
                                <li key={item.productId}>
                                    <img src={imgUrl(item.image)} onError={onImgError} alt="" />
                                    <div>
                                        <b>{item.title}</b>
                                        <small>
                                            {item.quantity} × {formatMoney(item.price)}
                                            {item.discount > 0 && <s>{formatMoney(item.originalPrice)}</s>}
                                        </small>
                                    </div>
                                    <strong>{formatMoney(item.price * item.quantity)}</strong>
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
                            <h3 data-testid="payment-total">{formatMoney(totalPrice)}</h3>
                        </div>
                    </aside>
                </div>
            </div>
        </main>
    );
};

export default Payment;
