import './CSS/menu.css';
import './CSS/checkout.css';
import './CSS/account.css';
import { useContext, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import productContext from '../Context/ProductContext';
import toast from 'react-hot-toast';
import { apiFetch } from '../api';
import { formatMoney } from '../utils/price';
import { imgUrl, onImgError } from './home/useHomeData';
import WrappedPaymentForm from './StripePayment';

const shortId = (id) => `#${String(id).slice(-6).toUpperCase()}`;
const lineTitle = (line) => line.title || line.productId?.title || 'Removed product';
const when = (d) => new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

// Placed → Preparing (paid or COD) → Delivered; a cancelled order stops the line
const progress = (o) => {
    if (o.orderStatus === 'completed') return 3;
    if (o.paymentStatus === 'paid' || o.paymentMethod !== 'card') return 2;
    return 1;
};

const Track = () => {
    const { refreshSession } = useContext(productContext);
    const [searchParams, setSearchParams] = useSearchParams();
    const highlight = searchParams.get('order');
    const page = Math.max(1, parseInt(searchParams.get('page')) || 1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [orders, setOrders] = useState([]);
    const [totalPages, setTotalPages] = useState(1);
    const [payingId, setPayingId] = useState(null);
    const [cancellingId, setCancellingId] = useState(null);
    const [confirmOrder, setConfirmOrder] = useState(null);

    const getHistory = async () => {
        setLoading(true);
        setError(false);
        const { ok, status, data } = await apiFetch(`/order/user/history?page=${page}`);
        if (ok) {
            setOrders(data.orders || []);
            setTotalPages(data.totalPages || 1);
        } else if (status === 401) {
            // Session expired mid-visit: the route guard sends them to login
            refreshSession();
        } else {
            setError(true);
        }
        setLoading(false);
    };

    useEffect(() => {
        getHistory();
    }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

    // Bring the order from checkout into view
    useEffect(() => {
        if (!highlight || loading) return;
        document.getElementById(`order-${highlight}`)?.scrollIntoView({ block: 'center' });
    }, [highlight, loading, orders]);

    // Esc closes the cancel dialog
    useEffect(() => {
        if (!confirmOrder) return undefined;
        const onKey = (e) => e.key === 'Escape' && setConfirmOrder(null);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [confirmOrder]);

    const cancel = async () => {
        const order = confirmOrder;
        setConfirmOrder(null);
        if (!order || cancellingId) return;
        setCancellingId(order._id);
        const { ok, data } = await apiFetch(`/order/cancel/${order._id}`, { method: 'POST' });
        setCancellingId(null);
        if (ok) toast.success('Order cancelled');
        else toast.error(data?.message || 'Could not cancel this order');
        getHistory();
    };

    const goPage = (p) => {
        const next = new URLSearchParams(searchParams);
        if (p > 1) next.set('page', String(p)); else next.delete('page');
        next.delete('order');
        setSearchParams(next);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const canAct = (o) => o.orderStatus === 'pending' && o.paymentStatus === 'unpaid';
    const firstLoad = loading && orders.length === 0;

    return (
        <main className="fh">
            <section className="fm-hero">
                <div className="fh-wrap">
                    <nav className="fm-crumbs" aria-label="Breadcrumb">
                        <Link to="/">Home</Link> <i className="bi bi-chevron-right" style={{ fontSize: '0.7rem' }} /> <span>My orders</span>
                    </nav>
                    <h1 className="fm-title">
                        My <em>orders</em>
                    </h1>
                    <p className="fx-lead">Track deliveries, pay for open orders or cancel before we start cooking.</p>
                </div>
            </section>

            <section className="fh-wrap fx-body">
                {firstLoad ? (
                    <div className="fx-list">
                        {[0, 1].map((i) => <div key={i} className="fh-skel fx-skel" style={{ height: 210 }} />)}
                    </div>
                ) : error ? (
                    <div className="fm-empty">
                        <div className="fm-empty-ico"><i className="bi bi-wifi-off" /></div>
                        <h3>Couldn&apos;t load your orders</h3>
                        <p>Please check your connection and try again.</p>
                        <button type="button" className="fh-btn fh-btn-red" onClick={getHistory}>Try again</button>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="fm-empty">
                        <div className="fm-empty-ico"><i className="bi bi-receipt" /></div>
                        <h3>No orders yet</h3>
                        <p>You haven&apos;t placed any orders yet — your first one is a few taps away.</p>
                        <Link to="/products" className="fh-btn fh-btn-red">Browse the menu</Link>
                    </div>
                ) : (
                    <div className={`fx-list${loading ? ' fx-dim' : ''}`} aria-busy={loading}>
                        {orders.map((order) => {
                            const step = progress(order);
                            const cancelled = order.orderStatus === 'cancelled';
                            return (
                                <article key={order._id} id={`order-${order._id}`} data-order={order._id} className={`fx-order${highlight === order._id ? ' is-new' : ''}`}>
                                    <header className="fx-order-head">
                                        <div>
                                            <b>Order {shortId(order._id)}</b>
                                            <span className="fx-when">{when(order.createdAt)}</span>
                                        </div>
                                        <div className="fx-pills">
                                            <span className={`fx-pill st-${order.orderStatus}`} data-testid="order-status">{order.orderStatus}</span>
                                            <span className={`fx-pill pay-${order.paymentStatus}`} data-testid="payment-status">{order.paymentStatus}</span>
                                        </div>
                                    </header>

                                    {cancelled ? (
                                        <p className="fx-cancelled"><i className="bi bi-x-circle" /> This order was cancelled.</p>
                                    ) : (
                                        <ol className="fx-track" aria-label="Order progress">
                                            {['Placed', 'Preparing', 'Delivered'].map((s, i) => (
                                                <li key={s} className={i < step ? 'is-done' : ''} aria-current={i === step - 1 ? 'step' : undefined}>
                                                    <span><i className={`bi ${['bi-receipt', 'bi-fire', 'bi-house-check'][i]}`} /></span>
                                                    {s}
                                                </li>
                                            ))}
                                        </ol>
                                    )}

                                    <ul className="fx-lines">
                                        {order.products.map((line, i) => (
                                            <li key={i}>
                                                <img src={imgUrl(line.productId?.image)} alt="" onError={onImgError} loading="lazy" />
                                                <span className="fx-line-name">{lineTitle(line)}</span>
                                                <span className="fx-qty">× {line.quantity}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <footer className="fx-order-foot">
                                        <div className="fx-meta">
                                            <span><i className={`bi ${order.paymentMethod === 'card' ? 'bi-credit-card' : 'bi-cash-coin'}`} /> {order.paymentMethod === 'card' ? 'Card' : 'Cash on delivery'}</span>
                                            {order.shippingAddress?.city && <span><i className="bi bi-geo-alt" /> {order.shippingAddress.city}</span>}
                                            {order.discountCode && <span><i className="bi bi-tag" /> {order.discountCode}</span>}
                                        </div>
                                        <div className="fx-total">
                                            Total <b>{formatMoney(order.totalAmount)}</b>
                                        </div>
                                    </footer>

                                    {canAct(order) && payingId !== order._id && (
                                        <div className="fx-order-actions">
                                            {order.paymentMethod === 'card' && (
                                                <button type="button" className="fh-btn fh-btn-red" onClick={() => setPayingId(order._id)}>
                                                    <i className="bi bi-credit-card" /> Pay now
                                                </button>
                                            )}
                                            <button type="button" className="fh-btn fh-btn-ghost" disabled={cancellingId === order._id} onClick={() => setConfirmOrder(order)}>
                                                {cancellingId === order._id ? 'Cancelling…' : 'Cancel'}
                                            </button>
                                        </div>
                                    )}
                                    {payingId === order._id && (
                                        <div className="fx-pay">
                                            <WrappedPaymentForm retryOrder={order} onDone={() => { setPayingId(null); getHistory(); }} />
                                            <button type="button" className="fx-link" onClick={() => setPayingId(null)}>Close</button>
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                )}

                {totalPages > 1 && !error && (
                    <nav className="fx-pager" aria-label="Order pages">
                        <button type="button" disabled={page <= 1 || loading} onClick={() => goPage(page - 1)} aria-label="Previous page"><i className="bi bi-chevron-left" /></button>
                        <span>Page {page} of {totalPages}</span>
                        <button type="button" disabled={page >= totalPages || loading} onClick={() => goPage(page + 1)} aria-label="Next page"><i className="bi bi-chevron-right" /></button>
                    </nav>
                )}
            </section>

            {confirmOrder && (
                <div className="fk-confirm-backdrop" onClick={() => setConfirmOrder(null)}>
                    <div className="fk-confirm" role="alertdialog" aria-modal="true" aria-labelledby="fx-cancel-title" onClick={(e) => e.stopPropagation()}>
                        <i className="bi bi-x-octagon big" />
                        <h3 id="fx-cancel-title">Cancel order {shortId(confirmOrder._id)}?</h3>
                        <p>The dishes go back on the menu and any discount code is released.</p>
                        <div className="fk-confirm-btns">
                            <button type="button" className="fh-btn fk-back" onClick={() => setConfirmOrder(null)} autoFocus>Keep order</button>
                            <button type="button" className="fh-btn fh-btn-red" onClick={cancel}>Yes, cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

export default Track;
