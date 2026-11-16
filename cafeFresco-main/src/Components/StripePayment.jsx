import PropTypes from 'prop-types';
import { useState, useContext, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import productContext from '../Context/ProductContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatMoney } from '../utils/price';
import './CSS/landing.css';
import './CSS/checkout.css';
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_KEY);

// retryOrder: pay an existing unpaid card order (Track page "Pay now"); no new order is created
const PaymentForm = ({ totalPrice = 0, originalTotal = 0, retryOrder = null, onDone }) => {
    const { appliedCode, clearDiscount, shippingAddress, setShippingAddress, getCart, playSound } = useContext(productContext);
    const navigate = useNavigate();
    const [paymentMethod, setPaymentMethod] = useState('stripe');
    const [processing, setProcessing] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [cardComplete, setCardComplete] = useState(false);
    const [cardFocus, setCardFocus] = useState(false);
    const [cardError, setCardError] = useState('');
    const [confirmCancel, setConfirmCancel] = useState(false);
    // the cart changed and the discount is being re-checked: wait for the fresh total before paying
    const { discountStale } = useContext(productContext);
    // A card order that was created but not paid yet (declined card): pay again reuses it
    const [pendingOrder, setPendingOrder] = useState(retryOrder);
    // One key per checkout attempt: a double submit or network retry returns the same order
    const idempotencyKey = useRef(null);
    const stripe = useStripe();
    const elements = useElements();
    const BASE_URL = import.meta.env.VITE_BASE_URL;

    const post = async (path, body, headers = {}) => {
        const res = await fetch(`${BASE_URL}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            credentials: 'include',
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Something went wrong');
        return data;
    };

    // D2: the server builds the order from the saved cart; we send only address, code and method
    const createOrder = async (method) => {
        if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
        const data = await post('/order/create', {
            shippingAddress,
            paymentMethod: method,
            ...(appliedCode ? { discountCode: appliedCode } : {}),
        }, { 'Idempotency-Key': idempotencyKey.current });
        return data.order;
    };

    const finish = (order, message) => {
        toast.success(message);
        playSound();
        if (retryOrder) { onDone?.(order); return; }
        setPendingOrder(null);
        idempotencyKey.current = null;
        setShippingAddress(null);
        clearDiscount();
        getCart(); // server emptied the cart
        navigate(`/track?order=${order._id}`, { replace: true });
    };

    // C7: the customer can drop an unpaid order; the server returns the stock and the code
    const handleCancel = async () => {
        if (!pendingOrder || cancelling || processing) return;
        setConfirmCancel(false);
        setCancelling(true);
        try {
            await post(`/order/cancel/${pendingOrder._id}`, {});
            toast.success('Order cancelled');
            if (retryOrder) { onDone?.(null); return; }
            setPendingOrder(null);
            idempotencyKey.current = null;
            setShippingAddress(null);
            clearDiscount();
            navigate(`/track?order=${pendingOrder._id}`, { replace: true });
        } catch (error) {
            toast.error(error.message);
            if (retryOrder) onDone?.(null);
        } finally {
            setCancelling(false);
        }
    };

    const handleSubmit = async () => {
        if (processing || cancelling) return;
        if (paymentMethod === 'stripe' && !cardComplete) {
            toast.error('Please enter your full card details');
            return;
        }
        if (!retryOrder && !shippingAddress) {
            toast.error('Please enter your delivery details first');
            navigate('/address');
            return;
        }

        setProcessing(true);
        try {
            if (paymentMethod === 'cod') {
                // The COD payment record and the confirmation email are created by the server
                const order = await createOrder('cod');
                finish(order, 'Order placed successfully with Cash on Delivery!');

            } else if (paymentMethod === 'stripe') {
                if (!stripe || !elements) {
                    toast.error('Card payment is still loading, please try again');
                    return;
                }

                // 1. Order first (unpaid, stock reserved) — or reuse the one whose card was declined
                const order = pendingOrder || await createOrder('card');
                setPendingOrder(order);
                const expected = Number(totalPrice || originalTotal);
                if (!pendingOrder && expected && Math.abs(expected - order.totalAmount) > 0.009) {
                    toast(`Total updated to ${formatMoney(order.totalAmount)}`);
                }

                // 2. The order's single intent (reused on retry)
                const { clientSecret } = await post('/stripe/payment-intent', { orderId: order._id });

                // 3. Charge the card
                const result = await stripe.confirmCardPayment(clientSecret, {
                    payment_method: { card: elements.getElement(CardElement) },
                });
                if (result.error) {
                    toast.error(`${result.error.message} Your order is saved — you can try another card.`);
                    return;
                }

                // 4. Server verifies with Stripe, marks the order paid and sends the email
                const confirmed = await post('/stripe/confirm', { paymentIntentId: result.paymentIntent.id });
                finish(confirmed.order, 'Payment successful and order placed!');
            }
        } catch (error) {
            toast.error(error.message || "Something went wrong");
            playSound();
        } finally {
            setProcessing(false);
        }
    };




    const locked = processing || !!pendingOrder || !!retryOrder;
    const amount = pendingOrder ? pendingOrder.totalAmount : (totalPrice || originalTotal);
    const stale = !retryOrder && !pendingOrder && discountStale;
    const method = (key, icon, title, sub) => (
        <label className={`fk-method${paymentMethod === key ? ' is-on' : ''}${locked && paymentMethod !== key ? ' is-disabled' : ''}`}>
            <input type="radio" name="paymentMethod" value={key} checked={paymentMethod === key} disabled={locked} onChange={() => setPaymentMethod(key)} />
            <i className={`bi ${icon}`} />
            <span>
                <b>{title}</b>
                <small>{sub}</small>
            </span>
            <span className="fk-method-dot" aria-hidden="true" />
        </label>
    );

    return (
        <div>
            <div className="fk-methods" role="radiogroup" aria-label="Payment method">
                {method('stripe', 'bi-credit-card-2-front', 'Card', 'Visa, Mastercard · via Stripe')}
                {method('cod', 'bi-cash-coin', 'Cash on delivery', 'Pay the rider at your door')}
            </div>

            {pendingOrder && (
                <div className="fk-pending" role="status">
                    <i className="bi bi-exclamation-circle" /> Your order #{String(pendingOrder._id).slice(-6).toUpperCase()} is saved but not paid yet — try the card again, use another card, or cancel it.
                </div>
            )}

            {paymentMethod === 'stripe' ? (
                <>
                    <div className={`fk-card${cardFocus ? ' is-focus' : ''}`}>
                        <CardElement
                            options={{ style: { base: { fontSize: '16px', color: '#1e1a16', fontFamily: 'Poppins, system-ui, sans-serif', '::placeholder': { color: '#a39a90' } }, invalid: { color: '#b42318' } } }}
                            onFocus={() => setCardFocus(true)}
                            onBlur={() => setCardFocus(false)}
                            onChange={(e) => { setCardComplete(e.complete); setCardError(e.error?.message || ''); }}
                        />
                    </div>
                    {cardError ? (
                        <p className="fk-hint" role="alert" style={{ color: '#b42318' }}><i className="bi bi-exclamation-circle" /> {cardError}</p>
                    ) : (
                        <p className="fk-hint"><i className="bi bi-shield-lock" /> Card details go straight to Stripe — we never see or store them.</p>
                    )}
                </>
            ) : (
                <div className="fk-cod-note">
                    <i className="bi bi-info-circle-fill" />
                    <span>Please keep <b>{formatMoney(amount)}</b> ready. You can cancel this order from My Orders until it&apos;s on its way.</span>
                </div>
            )}

            <button className="fh-btn fh-btn-red fk-pay" onClick={handleSubmit} disabled={processing || cancelling || stale || (paymentMethod === 'stripe' && !cardComplete)}>
                {processing ? (
                    <>
                        <span className="spinner-border spinner-border-sm" aria-hidden="true" /> Processing…
                    </>
                ) : stale ? (
                    'Updating total…'
                ) : (
                    <>
                        <i className={paymentMethod === 'cod' ? 'bi bi-bag-check' : 'bi bi-lock-fill'} />
                        {`${pendingOrder ? 'Retry payment' : paymentMethod === 'cod' ? 'Place order' : 'Pay'} ${formatMoney(amount)}`}
                    </>
                )}
            </button>
            {pendingOrder && (
                <button type="button" className="fh-btn fk-cancel" onClick={() => setConfirmCancel(true)} disabled={processing || cancelling}>
                    {cancelling ? 'Cancelling…' : 'Cancel order'}
                </button>
            )}

            {confirmCancel && (
                <div className="fk-confirm-backdrop" onClick={() => setConfirmCancel(false)}>
                    <div className="fk-confirm" role="alertdialog" aria-modal="true" aria-labelledby="fk-cancel-title" onClick={(e) => e.stopPropagation()}>
                        <i className="bi bi-x-octagon big" />
                        <h3 id="fk-cancel-title">Cancel this unpaid order?</h3>
                        <p>The dishes go back on the menu and any discount code is released.</p>
                        <div className="fk-confirm-btns">
                            <button type="button" className="fh-btn fk-back" onClick={() => setConfirmCancel(false)} autoFocus>Keep order</button>
                            <button type="button" className="fh-btn fh-btn-red" onClick={handleCancel}>Yes, cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Wrap your component with Elements provider (in parent component or here)
export default function WrappedPaymentForm(props) {
    return (
        <Elements stripe={stripePromise}>
            <PaymentForm {...props} />
        </Elements>
    );
}

PaymentForm.propTypes = {
    totalPrice: PropTypes.number,
    originalTotal: PropTypes.number,
    retryOrder: PropTypes.object,
    onDone: PropTypes.func,
};
