import { useState, useEffect, useContext } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import productContext from '../Context/ProductContext';
import { apiFetch } from '../api';
import { formatMoney, unitPrice } from '../utils/price';
import useDocumentTitle from '../hooks/useDocumentTitle';
import useStoreSettings from '../hooks/useStoreSettings';
import { trackView } from '../utils/track';
import DishCard from './home/DishCard';
import { colorFor, imgUrl, onImgError } from './home/useHomeData';
import './CSS/landing.css';
import './CSS/menu.css';
import './CSS/detail.css';

const LOW_STOCK = 5;

// Full, half or empty star for position i (1–5) of an average rating
const starClass = (avg, i) => (avg >= i ? 'bi bi-star-fill' : avg >= i - 0.5 ? 'bi bi-star-half' : 'bi bi-star');
const Stars = ({ value, size = '1rem' }) => (
    <span className="fd-stars" aria-hidden="true" style={{ fontSize: size }}>
        {[1, 2, 3, 4, 5].map((i) => <i key={i} className={starClass(value, i)} />)}
    </span>
);

const ProductDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addToCart, addToWish, wishlistIds, playSound, categories } = useContext(productContext);
    const store = useStoreSettings();
    const pay = store?.payments || { card: true, cod: true };
    const payLabel = pay.card && pay.cod ? 'Card or cash on delivery' : pay.card ? 'Card payment' : 'Cash on delivery';
    const [status, setStatus] = useState('loading'); // loading | ready | notfound | error
    const [p, setP] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [adding, setAdding] = useState(false);
    const [savingWish, setSavingWish] = useState(false);
    const [reviews, setReviews] = useState([]);
    const [rating, setRating] = useState(0);
    const [hover, setHover] = useState(0);
    const [reviewText, setReviewText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [reviewError, setReviewError] = useState('');
    const [related, setRelated] = useState(null);

    const saved = p ? wishlistIds.includes(String(p._id)) : false;
    useDocumentTitle(status === 'ready' ? p.title : status === 'notfound' ? 'Product not found' : 'Menu');

    // The URL id is the source of truth (refresh, shared links and related dishes all work)
    useEffect(() => {
        window.scrollTo(0, 0);
        setStatus('loading');
        setQuantity(1);
        setRating(0);
        setReviewText('');
        setReviewError('');
        const ctrl = new AbortController();
        apiFetch(`/product/${id}`, { signal: ctrl.signal })
            .then((r) => {
                if (ctrl.signal.aborted) return;
                if (r.status === 400 || r.status === 404) return setStatus('notfound');
                if (!r.ok) return setStatus('error');
                setP(r.data);
                setStatus('ready');
                trackView(r.data._id);
            })
            .catch((err) => {
                if (err.name !== 'AbortError') setStatus('error');
            });
        return () => ctrl.abort();
    }, [id]);

    const productId = p?._id;
    const categoryId = p?.category?._id;

    const fetchReviews = async () => {
        if (!productId) return;
        const { ok, data } = await apiFetch(`/review/all/${productId}`);
        setReviews(ok && Array.isArray(data) ? data : []);
    };

    useEffect(() => {
        setReviews([]);
        fetchReviews();
    }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

    // "You may also like": similar dishes (category, tags, meaning), never this one; topped up from trending
    useEffect(() => {
        if (!productId) return;
        let alive = true;
        setRelated(null);
        (async () => {
            const pick = [];
            const add = (list) => list.forEach((d) => d._id !== productId && !pick.some((x) => x._id === d._id) && pick.length < 4 && pick.push(d));
            const similar = await apiFetch(`/reco/similar/${productId}`);
            if (similar.ok) add(similar.data.products || []);
            if (pick.length < 4) {
                const r = await apiFetch('/reco/trending');
                if (r.ok) add(r.data.products || []);
            }
            if (alive) setRelated(pick);
        })();
        return () => {
            alive = false;
        };
    }, [productId]);

    const loginNext = () => navigate(`/login?next=${encodeURIComponent(window.location.pathname)}`);

    if (status === 'loading') {
        return (
            <main className="fh">
                <div className="fh-wrap fd-grid" style={{ paddingTop: 50 }}>
                    <div className="fh-skel" style={{ aspectRatio: '1', borderRadius: 32 }} />
                    <div>
                        {[40, 80, 30, 100, 90, 60].map((w, i) => (
                            <div key={i} className="fh-skel" style={{ height: i === 1 ? 44 : 16, width: `${w}%`, marginTop: 18 }} />
                        ))}
                    </div>
                </div>
            </main>
        );
    }

    if (status !== 'ready') {
        return (
            <main className="fh">
                <div className="fh-wrap fm-empty" style={{ padding: '90px 20px' }}>
                    <div className="fm-empty-ico"><i className={status === 'notfound' ? 'bi bi-search' : 'bi bi-wifi-off'} /></div>
                    <h3>{status === 'notfound' ? 'Product not found' : 'Could not load this product'}</h3>
                    <p>{status === 'notfound' ? 'It may have been removed or the link is wrong.' : 'Please check your connection and try again.'}</p>
                    <Link to="/products" className="fh-btn fh-btn-red">Browse the menu</Link>
                </div>
            </main>
        );
    }

    const discount = Number(p.discount) || 0;
    const unit = unitPrice(p);
    const stock = p.inventory?.quantityInStock ?? 0;
    const out = stock <= 0;
    const avg = Number(p.averageRating) || 0;
    const count = Number(p.reviewCount) || 0;
    const menu = (categories || []).filter((c) => c.productCount > 0).sort((a, b) => b.productCount - a.productCount);
    const catIndex = menu.findIndex((c) => c._id === categoryId);
    const catColor = colorFor(p.category?.title || '', Math.max(0, catIndex));

    const changeQty = (delta) => setQuantity((q) => Math.min(Math.max(q + delta, 1), Math.max(stock, 1)));

    const handleAdd = async () => {
        if (out || adding) return;
        setAdding(true);
        const r = await addToCart({ id: p._id, quantity });
        setAdding(false);
        if (r?.needsLogin) loginNext();
    };

    const handleSave = async () => {
        if (saved || savingWish) return;
        setSavingWish(true);
        const r = await addToWish(p._id);
        setSavingWish(false);
        if (r?.needsLogin) loginNext();
    };

    const handleSubmitReview = async (e) => {
        e.preventDefault();
        if (submitting || rating === 0) return;
        setSubmitting(true);
        setReviewError('');
        const { ok, status: st, data } = await apiFetch(`/review/add/${p._id}`, { method: 'POST', body: { rating, review: reviewText } });
        setSubmitting(false);
        playSound();
        if (st === 401) {
            toast.error('Please login to write a review.');
            loginNext();
            return;
        }
        if (!ok) {
            setReviewError(data?.message || 'Could not add your review');
            return;
        }
        toast.success(data.message);
        setRating(0);
        setReviewText('');
        fetchReviews();
        const fresh = await apiFetch(`/product/${p._id}`);
        if (fresh.ok) setP((d) => ({ ...d, averageRating: fresh.data.averageRating, reviewCount: fresh.data.reviewCount }));
    };

    // rating breakdown from the loaded reviews (newest 50)
    const dist = [5, 4, 3, 2, 1].map((s) => ({ s, n: reviews.filter((r) => r.rating === s).length }));

    return (
        <main className="fh">
            <div className="fh-wrap">
                <nav className="fm-crumbs fd-crumbs" aria-label="Breadcrumb">
                    <Link to="/">Home</Link> <i className="bi bi-chevron-right" /> <Link to="/products">Menu</Link>
                    {p.category && (
                        <>
                            {' '}<i className="bi bi-chevron-right" /> <Link to={`/products?category=${p.category._id}`}>{p.category.title}</Link>
                        </>
                    )}{' '}
                    <i className="bi bi-chevron-right" /> <span aria-current="page">{p.title}</span>
                </nav>

                <section className="fd-grid">
                    <div className="fd-media">
                        <div className="fd-blob" style={{ background: catColor }} aria-hidden />
                        <div className="fd-photo">
                            <img src={imgUrl(p.image)} alt={p.title} onError={onImgError} />
                            <div className="fh-dish-tags">
                                {out ? <span className="t-out">Out of stock</span> : (
                                    <>
                                        {p.newRelease && <span className="t-new">New</span>}
                                        {discount > 0 && <span className="t-off">-{discount}%</span>}
                                        {p.featured && <span className="t-new" style={{ background: 'var(--cf-orange)' }}>Chef&apos;s pick</span>}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="fd-info">
                        {p.category && (
                            <Link to={`/products?category=${p.category._id}`} className="fd-cat" style={{ '--c': catColor }}>
                                {p.category.title}
                            </Link>
                        )}
                        <h1 className="fd-title">{p.title}</h1>

                        <a href="#reviews" className="fd-rating" data-testid="avg-rating">
                            <Stars value={avg} />
                            <span>{count > 0 ? `${avg.toFixed(1)} (${count} review${count === 1 ? '' : 's'})` : 'No reviews yet'}</span>
                        </a>

                        <div className="fd-price">
                            <strong>{formatMoney(unit)}</strong>
                            {discount > 0 && (
                                <>
                                    <s>{formatMoney(p.price)}</s>
                                    <span className="fd-save">Save {formatMoney(p.price - unit)}</span>
                                </>
                            )}
                        </div>

                        <div className={`fd-stock ${out ? 'is-out' : stock <= LOW_STOCK ? 'is-low' : 'is-in'}`}>
                            <i className={out ? 'bi bi-x-circle' : stock <= LOW_STOCK ? 'bi bi-exclamation-circle' : 'bi bi-check-circle'} />
                            {out ? 'Out of stock' : stock <= LOW_STOCK ? `Only ${stock} left` : `In stock (${stock})`}
                        </div>

                        <p className="fd-desc">{p.description}</p>

                        {(p.tags?.length > 0 || p.dietary?.vegetarian || p.dietary?.vegan || p.dietary?.spicyLevel > 0) && (
                            <div className="fd-tags">
                                {p.dietary?.vegan ? <span className="fd-diet is-veg"><i className="bi bi-flower1" /> Vegan</span> : p.dietary?.vegetarian && <span className="fd-diet is-veg"><i className="bi bi-flower1" /> Vegetarian</span>}
                                {p.dietary?.spicyLevel > 0 && <span className="fd-diet is-spicy"><i className="bi bi-fire" /> {['', 'Mild', 'Medium', 'Hot'][p.dietary.spicyLevel]}</span>}
                                {(p.tags || []).map((t) => (
                                    <Link key={t} to={`/products?tags=${encodeURIComponent(t)}`} className="fd-tag">#{t}</Link>
                                ))}
                            </div>
                        )}

                        {/* only allergen info staff have checked is shown; otherwise point to staff */}
                        <p className="fd-allergens">
                            <i className="bi bi-info-circle" />{' '}
                            {p.allergensVerified
                                ? p.allergens?.length ? `Contains: ${p.allergens.join(', ')}.` : 'No common allergens listed by our kitchen.'
                                : 'Allergies? Please ask our staff before ordering.'}
                        </p>

                        <ul className="fd-perks">
                            <li><i className="bi bi-fire" /> Cooked fresh to order</li>
                            {store?.delivery?.etaMinutes > 0 && <li><i className="bi bi-truck" /> Delivered in about {store.delivery.etaMinutes} mins</li>}
                            <li><i className="bi bi-credit-card" /> {payLabel}</li>
                        </ul>

                        <div className="fd-buy">
                            <div className="fd-qty" role="group" aria-label="Quantity">
                                <button type="button" aria-label="Decrease quantity" onClick={() => changeQty(-1)} disabled={quantity <= 1 || out}>
                                    <i className="bi bi-dash-lg" />
                                </button>
                                <output aria-live="polite">{quantity}</output>
                                <button type="button" aria-label="Increase quantity" onClick={() => changeQty(1)} disabled={quantity >= stock || out}>
                                    <i className="bi bi-plus-lg" />
                                </button>
                            </div>
                            <button type="button" className="fh-btn fh-btn-red fd-add" onClick={handleAdd} disabled={out || adding}>
                                <i className={adding ? 'bi bi-hourglass-split' : 'bi bi-bag-plus'} />
                                {out ? 'Out of stock' : (
                                    <>
                                        Add to cart <span className="fd-add-total">· {formatMoney(unit * quantity)}</span>
                                    </>
                                )}
                            </button>
                            <button type="button" className={`fd-save-btn${saved ? ' is-saved' : ''}`} onClick={handleSave} disabled={savingWish} aria-pressed={saved}>
                                <i className={saved ? 'bi bi-heart-fill' : 'bi bi-heart'} /> {saved ? 'Saved' : 'Save'}
                            </button>
                        </div>
                        {quantity >= stock && !out && stock > 1 && <p className="fd-note">That&apos;s all we have right now.</p>}
                    </div>
                </section>

                {/* ---------- reviews ---------- */}
                <section id="reviews" className="fd-reviews">
                    <div className="fh-center">
                        <div className="fh-eyebrow">What customers say</div>
                        <h2 className="fh-h2">Reviews</h2>
                        <div className="fh-rule" />
                    </div>

                    <div className="fd-review-grid">
                        <aside className="fd-summary">
                            <b className={`fd-avg${count > 0 ? '' : ' is-empty'}`}>{count > 0 ? avg.toFixed(1) : '0.0'}</b>
                            <Stars value={avg} size="1.2rem" />
                            <span className="fd-sum-count">{count > 0 ? `Based on ${count} review${count === 1 ? '' : 's'}` : 'No reviews yet'}</span>
                            <div className="fd-bars">
                                {dist.map(({ s, n }) => (
                                    <div key={s} className="fd-bar">
                                        <span>{s}<i className="bi bi-star-fill" /></span>
                                        <div><i style={{ width: reviews.length ? `${(n / reviews.length) * 100}%` : 0 }} /></div>
                                        <em>{n}</em>
                                    </div>
                                ))}
                            </div>
                        </aside>

                        <div className="fd-list">
                            {reviews.length === 0 ? (
                                <div className="fd-empty">
                                    <i className="bi bi-chat-heart" />
                                    <b>No reviews yet</b>
                                    <span>Ordered this dish? Be the first to tell others how it was.</span>
                                </div>
                            ) : (
                                reviews.map((r) => (
                                    <article key={r._id} className="fd-review">
                                        <div className="fd-avatar" style={{ background: colorFor(r.name || '', (r.name || 'C').charCodeAt(0)) }}>
                                            {(r.name || 'C').charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="fd-review-head">
                                                <b>{r.name || 'Customer'}</b>
                                                <Stars value={r.rating} size="0.85rem" />
                                                <time dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</time>
                                            </div>
                                            <p>{r.review}</p>
                                        </div>
                                    </article>
                                ))
                            )}

                            <form className="fd-form" onSubmit={handleSubmitReview}>
                                <h3>Write a review</h3>
                                <p className="fd-form-hint">Reviews are open to customers who have received this dish.</p>
                                <div className="star-rating" role="radiogroup" aria-label="Your rating" onMouseLeave={() => setHover(0)}>
                                    {[1, 2, 3, 4, 5].map((s) => (
                                        <button
                                            key={s}
                                            type="button"
                                            role="radio"
                                            aria-checked={rating === s}
                                            aria-label={`${s} star${s > 1 ? 's' : ''}`}
                                            onMouseEnter={() => setHover(s)}
                                            onClick={() => setRating(s)}
                                        >
                                            <i className={s <= (hover || rating) ? 'bi bi-star-fill' : 'bi bi-star'} />
                                        </button>
                                    ))}
                                    <span className="fd-rate-label">{['Tap to rate', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][hover || rating]}</span>
                                </div>
                                <label htmlFor="reviewText" className="visually-hidden">Your review</label>
                                <textarea
                                    id="reviewText"
                                    rows="3"
                                    value={reviewText}
                                    onChange={(e) => setReviewText(e.target.value)}
                                    maxLength={1000}
                                    placeholder="How was it? Taste, portion, freshness…"
                                />
                                <div className="fd-form-foot">
                                    <span>{reviewText.length}/1000</span>
                                    <button type="submit" className="fh-btn fh-btn-red" disabled={submitting || rating === 0}>
                                        {submitting ? 'Submitting…' : 'Submit Review'}
                                    </button>
                                </div>
                                {reviewError && <div className="fd-error" role="alert">{reviewError}</div>}
                            </form>
                        </div>
                    </div>
                </section>

                {/* ---------- related ---------- */}
                {(related === null || related.length > 0) && (
                    <section className="fh-section">
                        <div className="fd-related-head">
                            <div>
                                <div className="fh-eyebrow">Craving more?</div>
                                <h2 className="fh-h2">You may also like</h2>
                            </div>
                            <Link to={p.category ? `/products?category=${p.category._id}` : '/products'} className="fh-btn fh-btn-ghost">
                                See all <i className="bi bi-arrow-right" />
                            </Link>
                        </div>
                        <div className="fh-dish-grid" style={{ marginTop: 26 }}>
                            {related === null
                                ? Array.from({ length: 4 }, (_, i) => <div key={i} className="fh-skel" style={{ aspectRatio: '4 / 4.3', borderRadius: 24 }} />)
                                : related.map((d) => <DishCard key={d._id} product={d} />)}
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
};

export default ProductDetail;
