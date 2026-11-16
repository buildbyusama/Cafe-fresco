import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import '../CSS/menu.css';
import DishCard from './DishCard';
import { formatMoney, unitPrice } from '../../utils/price';
import { colorFor, imgUrl, onImgError, useReveal } from './useHomeData';
import chef from '../../assets/logo/learn.png';
import chefThumbs from '../../assets/logo/contact2.png';
import stickerSandwich from '../../assets/Catagories/Lunch.png';
import stickerCake from '../../assets/Catagories/desert.png';

// ---------- promo tiles + "Our Categories" list ----------
export function HomePromo({ menu }) {
    const ref = useReveal();
    const pick = (rx) => menu.find((c) => rx.test(c.title)) || null;
    const big = pick(/burger/i) || menu[0];
    const small1 = pick(/dessert/i) || menu[1];
    const small2 = pick(/grill/i) || menu[2];
    const list = menu.slice(0, 3);
    if (!big) return null;

    return (
        <section ref={ref} className="fh-wrap fh-section fh-reveal">
            <div className="fh-promo">
                <div className="fh-tiles">
                    <Link to={`/products?category=${big._id}`} className="fh-tile fh-tile-big">
                        <div className="fh-tile-text">
                            <b>Tasty {big.title.split(/\s|&/)[0]}</b>
                            <span>NEW</span>
                        </div>
                        <img src={imgUrl(big.cover)} alt={big.title} loading="lazy" onError={onImgError} />
                    </Link>
                    {[small1, small2].filter(Boolean).map((c, i) => (
                        <Link key={c._id} to={`/products?category=${c._id}`} className="fh-tile">
                            <img src={imgUrl(c.cover)} alt={c.title} loading="lazy" onError={onImgError} />
                            <div className="fh-tile-label">
                                {c.title}
                                <span>Order now <i className="bi bi-arrow-right" /></span>
                            </div>
                        </Link>
                    ))}
                </div>

                <div className="fh-list">
                    <h2>Our Categories</h2>
                    {list.map((c, i) => (
                        <Link key={c._id} to={`/products?category=${c._id}`} className="fh-list-item">
                            <span className="fh-list-icon" style={{ background: `color-mix(in srgb, ${colorFor(c.title, menu.indexOf(c))} 16%, #fff)` }}>
                                <img src={imgUrl(c.image || c.cover)} alt="" loading="lazy" onError={onImgError} />
                            </span>
                            <div>
                                <b>{c.title}</b>
                                <span>{c.description || 'Freshly made, every day'} · {c.productCount} dishes</span>
                            </div>
                        </Link>
                    ))}
                    <Link to="/products" className="fh-btn fh-btn-ghost" style={{ marginTop: 14 }}>
                        See full menu <i className="bi bi-arrow-right" />
                    </Link>
                </div>
            </div>
        </section>
    );
}

HomePromo.propTypes = { menu: PropTypes.array.isRequired };

// ---------- get started (how ordering works) ----------
export function HomeGetStarted() {
    const ref = useReveal();
    return (
        <section ref={ref} id="how-it-works" className="fh-wrap fh-section fh-reveal">
            <div className="fh-start">
                <div>
                    <div className="fh-eyebrow">Order online</div>
                    <h2 className="fh-h2">Get Started Today!</h2>
                    <div className="fh-rule" />
                    <p className="fh-start-lead">Fresh food from our kitchen to your table in three easy steps.</p>
                    <p>
                        Pick your favourites from the menu, choose card or cash on delivery at checkout, and follow your order from our kitchen to your door. Every dish is cooked to order with simple, quality ingredients.
                    </p>
                    <div className="fh-feature-row">
                        <div className="fh-feature">
                            <i className="bi bi-bag-heart" style={{ background: '#FFF1D2', color: '#B07D00' }} />
                            <b>Easy Ordering</b>
                            <span>Add dishes to your cart, apply a discount code and check out in a minute.</span>
                        </div>
                        <div className="fh-feature">
                            <i className="bi bi-geo-alt" style={{ background: '#FFE3DE', color: '#E8262B' }} />
                            <b>Track Your Order</b>
                            <span>See every step — from our kitchen to your doorstep.</span>
                        </div>
                    </div>
                    <div className="fh-hero-cta" style={{ marginTop: 28 }}>
                        <Link to="/products" className="fh-btn fh-btn-red">Start an order</Link>
                        <Link to="/track" className="fh-btn fh-btn-ghost">Track my order</Link>
                    </div>
                </div>
                <div className="fh-start-art">
                    <div className="fh-start-circle">
                        <img src={chef} alt="Cafe Fresco chef serving a fresh dish" loading="lazy" />
                    </div>
                    <img className="fh-sticker" src={stickerSandwich} alt="" style={{ top: '8%', right: '6%' }} />
                    <img className="fh-sticker" src={stickerCake} alt="" style={{ bottom: '10%', left: '6%', animationDelay: '1.4s' }} />
                </div>
            </div>
        </section>
    );
}

// ---------- top foods (round dishes) ----------
export function HomeTopFoods({ items }) {
    const ref = useReveal();
    if (items && !items.length) return null;
    return (
        <section ref={ref} className="fh-wrap fh-section fh-reveal fh-center">
            <h2 className="fh-h2" style={{ color: 'var(--cf-red)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Top Foods</h2>
            <div className="fh-top-grid">
                {!items
                    ? Array.from({ length: 4 }, (_, i) => <div key={i} className="fh-skel" style={{ aspectRatio: '1', borderRadius: '50%', width: '82%', margin: '0 auto' }} />)
                    : items.slice(0, 4).map((p) => (
                          <Link key={p._id} to={`/product/${p._id}`} className="fh-top">
                              <div className="fh-top-img">
                                  <img src={imgUrl(p.image)} alt={p.title} loading="lazy" onError={onImgError} />
                              </div>
                              <b>{p.title}</b>
                              <span>
                                  {p.category?.title} · <em>{formatMoney(unitPrice(p))}</em>
                              </span>
                          </Link>
                      ))}
            </div>
        </section>
    );
}

HomeTopFoods.propTypes = { items: PropTypes.array };

// ---------- fresh picks (tall cards, in place of the reference's team cards) ----------
// same DishCard as the menu page, so the two pages always look alike
export function HomeFreshPicks({ items }) {
    const ref = useReveal();
    if (items && !items.length) return null;

    return (
        <section ref={ref} className="fh-wrap fh-section fh-reveal">
            <div className="fh-center">
                <div className="fh-script">fresco</div>
                <h2 className="fh-h2">Just Dropped This Week</h2>
                <div className="fh-rule" />
            </div>
            <div className="fh-dish-grid" style={{ marginTop: 44 }}>
                {!items
                    ? Array.from({ length: 4 }, (_, i) => <div key={i} className="fh-skel" style={{ aspectRatio: '4 / 4.3', borderRadius: 24 }} />)
                    : items.slice(0, 4).map((p) => <DishCard key={p._id} product={p} tag="New" />)}
            </div>
            <div className="fh-center" style={{ marginTop: 30 }}>
                <Link to="/products" className="fh-btn fh-btn-ghost">
                    View full menu <i className="bi bi-arrow-right" />
                </Link>
            </div>
        </section>
    );
}

HomeFreshPicks.propTypes = { items: PropTypes.array };

// ---------- offer call to action ----------
export function HomeOffer({ bestDeal }) {
    const ref = useReveal();
    return (
        <section ref={ref} className="fh-wrap fh-section fh-reveal">
            <div className="fh-offer">
                <div>
                    <h2>{bestDeal ? `Get ${bestDeal.discount}% Discount` : 'Hungry Already?'}</h2>
                    <p>
                        {bestDeal
                            ? `Save on ${bestDeal.title} and other selected dishes — the discount is already in the price.`
                            : 'Order in a minute and get it hot at your door. Card or cash on delivery.'}
                    </p>
                    <div className="fh-hero-cta">
                        <Link to={bestDeal ? `/product/${bestDeal._id}` : '/products'} className="fh-btn fh-btn-dark">
                            <i className="bi bi-bag-check" /> Order now
                        </Link>
                        <Link to="/contact" className="fh-btn fh-btn-dark">
                            <i className="bi bi-chat-dots" /> Catering &amp; big orders
                        </Link>
                    </div>
                </div>
                <div className="fh-offer-art">
                    {bestDeal && <img className="fh-offer-dish" src={imgUrl(bestDeal.image)} alt={bestDeal.title} loading="lazy" />}
                    <div className="fh-offer-card">
                        <img src={chefThumbs} alt="" loading="lazy" />
                    </div>
                </div>
            </div>
        </section>
    );
}

HomeOffer.propTypes = { bestDeal: PropTypes.object };

// ---------- recommendation rows ("Recommended for you", "Trending now") ----------
export function HomeDishRow({ script, title, items, sub }) {
    const ref = useReveal();
    if (items && !items.length) return null;

    return (
        <section ref={ref} className="fh-wrap fh-section fh-reveal">
            <div className="fh-center">
                <div className="fh-script">{script}</div>
                <h2 className="fh-h2">{title}</h2>
                {sub && <p className="fh-row-sub">{sub}</p>}
                <div className="fh-rule" />
            </div>
            <div className="fh-dish-grid" style={{ marginTop: 44 }}>
                {!items
                    ? Array.from({ length: 4 }, (_, i) => <div key={i} className="fh-skel" style={{ aspectRatio: '4 / 4.3', borderRadius: 24 }} />)
                    : items.slice(0, 4).map((p) => <DishCard key={p._id} product={p} />)}
            </div>
        </section>
    );
}

HomeDishRow.propTypes = { script: PropTypes.string, title: PropTypes.string.isRequired, items: PropTypes.array, sub: PropTypes.string };
