import { useContext, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import productContext from '../Context/ProductContext';
import { apiFetch } from '../api';
import { formatMoney } from '../utils/price';
import CheckoutSteps from './checkout/CheckoutSteps';
import DishCard from './home/DishCard';
import { imgUrl, onImgError } from './home/useHomeData';
import './CSS/landing.css';
import './CSS/menu.css';
import './CSS/checkout.css';

const CartPage = () => {
    // The context cart (the server's response) is the only source for lines and totals
    const {
        cart, getCart, removeFromCart, updateCartItemQuantity, pendingIds, subtotal, totalPrice, discountAmount,
        discountApplied, discountStale, appliedCode, autoApplied, applyDiscount, clearDiscount, loading, cartLoaded
    } = useContext(productContext);
    const [discountCode, setDiscountCode] = useState('');
    const [applying, setApplying] = useState(false);
    const [ideas, setIdeas] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        window.scrollTo(0, 0);
        getCart();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (appliedCode) setDiscountCode(appliedCode);
    }, [appliedCode]);

    // empty cart: suggest what's trending instead of a dead end
    const empty = cartLoaded && cart.length === 0;
    useEffect(() => {
        if (!empty || ideas) return;
        apiFetch('/reco/trending').then((r) => setIdeas(r.ok ? (r.data.products || []).slice(0, 4) : []));
    }, [empty, ideas]);

    // "Goes well with your order": refreshed when the set of dishes changes (not on quantity changes)
    const cartKey = cart.map((i) => String(i.productId)).sort().join(',');
    const [pairs, setPairs] = useState(null);
    useEffect(() => {
        if (!cartKey) return undefined;
        let alive = true;
        apiFetch('/reco/cart', { method: 'POST', body: { productIds: cartKey.split(',') } }).then((r) => alive && setPairs(r.ok ? (r.data.products || []).slice(0, 4) : []));
        return () => { alive = false; };
    }, [cartKey]);

    const unavailableCount = cart.filter((item) => item.available === false).length;
    const anyPending = pendingIds.length > 0;
    const isPending = (item) => pendingIds.includes(String(item.productId));
    const itemCount = cart.reduce((n, i) => n + (i.available === false ? 0 : i.quantity), 0);
    const savedOnItems = cart.reduce((n, i) => n + (i.available === false || !(i.discount > 0) ? 0 : ((i.originalPrice || i.price) - i.price) * i.quantity), 0);
    const blocked = cart.length === 0 || unavailableCount > 0 || anyPending || discountStale;

    const handleCheckout = () => {
        if (unavailableCount) {
            toast.error('Remove unavailable items before checkout');
            return;
        }
        if (blocked) return;
        navigate('/address');
    };

    const handleDiscount = async (e) => {
        e.preventDefault();
        const code = discountCode.trim().toUpperCase();
        if (!code) return toast.error('Enter a discount code');
        setApplying(true);
        await applyDiscount(code);
        setApplying(false);
    };

    const firstLoad = loading && cart.length === 0 && !cartLoaded;

    return (
        <main className="fh">
            <div className="fh-wrap">
                <div className="fk-head">
                    <nav className="fm-crumbs" aria-label="Breadcrumb">
                        <Link to="/">Home</Link> <i className="bi bi-chevron-right" style={{ fontSize: '0.65rem' }} /> <span style={{ color: 'var(--cf-ink)', fontWeight: 600 }}>Cart</span>
                    </nav>
                    <h1 className="fk-title">
                        Your <em>Cart</em>
                        {itemCount > 0 && <small>{itemCount} {itemCount === 1 ? 'item' : 'items'}</small>}
                    </h1>
                </div>

                {firstLoad ? (
                    <div className="fk-grid" style={{ marginTop: 28 }}>
                        <div className="fk-lines">
                            {[0, 1, 2].map((i) => <div key={i} className="fh-skel" style={{ height: 124, borderRadius: 22 }} />)}
                        </div>
                        <div className="fh-skel" style={{ height: 320, borderRadius: 26 }} />
                    </div>
                ) : cart.length === 0 ? (
                    <>
                        <div className="fk-empty">
                            <div className="fk-empty-ico"><i className="bi bi-bag" /></div>
                            <h2>Your cart is empty</h2>
                            <p>Nothing here yet — pick something delicious from our menu and it will show up here.</p>
                            <Link to="/products" className="fh-btn fh-btn-red">Browse the menu <i className="bi bi-arrow-right" /></Link>
                        </div>
                        {ideas && ideas.length > 0 && (
                            <section className="fh-section">
                                <div className="fh-center">
                                    <div className="fh-eyebrow">Need ideas?</div>
                                    <h2 className="fh-h2">Our Signature Dishes</h2>
                                    <div className="fh-rule" />
                                </div>
                                <div className="fh-dish-grid" style={{ marginTop: 30 }}>
                                    {ideas.map((p) => <DishCard key={p._id} product={p} />)}
                                </div>
                            </section>
                        )}
                    </>
                ) : (
                    <>
                        <CheckoutSteps current="cart" />
                        <div className="fk-grid">
                            <div className="fk-lines">
                                {cart.map((item) => {
                                    const off = item.available === false;
                                    return (
                                        <article
                                            key={item.productId}
                                            className={`fk-line cart-line${off ? ' is-unavailable' : ''}${isPending(item) ? ' is-busy' : ''}`}
                                            data-product={item.productId}
                                        >
                                            {off && (
                                                <div className="fk-line-warn" role="alert">
                                                    <i className="bi bi-exclamation-triangle" />
                                                    {item.reason} — {item.inStock > 0 && item.inStock < item.quantity ? 'reduce the quantity or remove it' : 'remove it'} to continue
                                                </div>
                                            )}
                                            <Link to={`/product/${item.productId}`} tabIndex={-1} aria-hidden="true">
                                                <img src={imgUrl(item.image)} onError={onImgError} className="fk-line-img" alt="" style={off ? { filter: 'grayscale(0.7)' } : undefined} />
                                            </Link>
                                            <div style={{ minWidth: 0 }}>
                                                <Link to={`/product/${item.productId}`} className="fk-line-title">{item.title}</Link>
                                                <div className="fk-line-meta">{item.category?.title}</div>
                                                <div className="fk-line-unit">
                                                    {formatMoney(item.price)} each
                                                    {item.discount > 0 && <s>{formatMoney(item.originalPrice || item.price)}</s>}
                                                </div>
                                            </div>
                                            <div className="fk-line-right">
                                                <div className="fk-qty">
                                                    <button
                                                        type="button"
                                                        aria-label="Decrease quantity"
                                                        disabled={item.quantity <= 1 || isPending(item)}
                                                        onClick={() => updateCartItemQuantity(item.productId, item.quantity - 1)}
                                                    >
                                                        <i className="bi bi-dash-lg" />
                                                    </button>
                                                    <input aria-label={`Quantity of ${item.title}`} value={item.quantity} type="number" readOnly tabIndex={-1} />
                                                    <button
                                                        type="button"
                                                        aria-label="Increase quantity"
                                                        disabled={item.quantity >= item.inStock || item.quantity >= 99 || isPending(item)}
                                                        onClick={() => updateCartItemQuantity(item.productId, item.quantity + 1)}
                                                    >
                                                        <i className="bi bi-plus-lg" />
                                                    </button>
                                                </div>
                                                <div className="fk-line-total">
                                                    {formatMoney(item.price * item.quantity)}
                                                    {item.discount > 0 && <s>{formatMoney((item.originalPrice || item.price) * item.quantity)}</s>}
                                                </div>
                                                <button type="button" className="fk-remove" aria-label={`Remove ${item.title}`} disabled={isPending(item)} onClick={() => removeFromCart(item.productId)}>
                                                    <i className="bi bi-trash3" /> Remove
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}
                                <Link to="/products" className="fk-remove" style={{ justifySelf: 'start', color: 'var(--cf-red)' }}>
                                    <i className="bi bi-plus-circle" /> Add more dishes
                                </Link>
                            </div>

                            <aside className="fk-panel fk-summary" aria-label="Order summary">
                                <h2>Order summary</h2>
                                <p className="fk-panel-sub">Have a discount code? Apply it here.</p>
                                <form className="fk-code" onSubmit={handleDiscount}>
                                    <div className="fk-code-input">
                                        <i className="bi bi-ticket-perforated" />
                                        <label htmlFor="discountCode" className="visually-hidden">Discount code</label>
                                        <input
                                            type="text"
                                            id="discountCode"
                                            placeholder="Discount code"
                                            value={discountCode}
                                            disabled={discountApplied}
                                            onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                                            autoComplete="off"
                                        />
                                    </div>
                                    {discountApplied ? (
                                        <button type="button" className="is-remove" onClick={() => { clearDiscount({ byUser: true }); setDiscountCode(''); }}>
                                            Remove
                                        </button>
                                    ) : (
                                        <button type="submit" disabled={!discountCode.trim() || applying || cart.length === 0}>
                                            {applying ? '…' : 'Apply'}
                                        </button>
                                    )}
                                </form>
                                {discountApplied && <div className="fk-code-ok"><i className="bi bi-check-circle-fill" /> {autoApplied ? `We applied ${appliedCode} for you, your best available code` : `Code ${appliedCode} applied`}</div>}

                                <div className="fk-rows">
                                    <div className="fk-row"><span>Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})</span><span>{formatMoney(subtotal)}</span></div>
                                    {savedOnItems > 0.004 && <div className="fk-row is-off"><span>Dish discounts (included)</span><span>−{formatMoney(savedOnItems)}</span></div>}
                                    {discountApplied && (
                                        <div className="fk-row is-off" data-testid="cart-breakdown">
                                            <span>Discount ({appliedCode})</span>
                                            <span>{discountStale ? 'updating…' : `−${formatMoney(discountAmount)}`}</span>
                                        </div>
                                    )}
                                    <div className="fk-row"><span>Delivery</span><span style={{ color: '#1e7a45', fontWeight: 600 }}>Free</span></div>
                                </div>
                                <div className="fk-total">
                                    <span>Total</span>
                                    <h3 data-testid="cart-total" className={discountStale ? 'is-stale' : undefined} aria-busy={discountStale}>
                                        {formatMoney(totalPrice)}
                                    </h3>
                                </div>
                                <button onClick={handleCheckout} disabled={blocked} type="button" className="fh-btn fh-btn-red fk-cta">
                                    Proceed to Pay <i className="bi bi-arrow-right" />
                                </button>
                                {unavailableCount > 0 && <p className="fk-hint" style={{ marginTop: 10 }}><i className="bi bi-info-circle" /> Remove or fix the highlighted items to continue.</p>}
                                <div className="fk-trust">
                                    <span><i className="bi bi-shield-lock" /> Secure checkout</span>
                                    <span><i className="bi bi-credit-card" /> Card</span>
                                    <span><i className="bi bi-cash-coin" /> Cash on delivery</span>
                                </div>
                            </aside>
                        </div>

                        {pairs && pairs.length > 0 && (
                            <section className="fh-section fk-pairs" aria-label="Goes well with your order">
                                <div className="fh-eyebrow">Complete your meal</div>
                                <h2 className="fh-h2">Goes well with your order</h2>
                                <div className="fh-dish-grid" style={{ marginTop: 26 }}>
                                    {pairs.map((p) => <DishCard key={p._id} product={p} />)}
                                </div>
                            </section>
                        )}
                    </>
                )}
            </div>
        </main>
    );
};

export default CartPage;
