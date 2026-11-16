import { useContext, useEffect } from 'react';
import { Link } from 'react-router-dom';
import productContext from '../Context/ProductContext';
import { colorFor, imgUrl, onImgError, useReveal } from './home/useHomeData';
import image1 from '../assets/About/c1-web.jpg';
import image2 from '../assets/About/c2-web.jpg';
import image3 from '../assets/About/c3-web.jpg';
import image4 from '../assets/About/c4-web.jpg';
import chef from '../assets/logo/learn.png';
import stickerSandwich from '../assets/Catagories/Lunch.png';
import './CSS/landing.css';
import './CSS/menu.css';
import './CSS/pages.css';

const VALUES = [
    ['bi-basket2', 'Fresh ingredients', 'Vegetables, herbs and meat bought fresh and prepped in our kitchen every morning.', '#3E9B48'],
    ['bi-fire', 'Cooked to order', 'Nothing sits under a lamp — your dish is made when you order it.', '#E8262B'],
    ['bi-truck', 'Hot at your door', 'Packed to keep the heat in and delivered in about 30 minutes.', '#FF8A1F'],
    ['bi-tag', 'Fair prices', 'Honest portions and prices, with real discounts shown upfront.', '#F2B705']
];

const About = () => {
    const { categories } = useContext(productContext);
    const r1 = useReveal();
    const r2 = useReveal();
    const r3 = useReveal();
    const r4 = useReveal();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // real numbers from the live menu
    const menu = (categories || []).filter((c) => c.productCount > 0).sort((a, b) => b.productCount - a.productCount);
    const dishes = menu.reduce((n, c) => n + c.productCount, 0);

    return (
        <main className="fh">
            <section className="fh-wrap fp-hero">
                <nav className="fm-crumbs" aria-label="Breadcrumb">
                    <Link to="/">Home</Link> <i className="bi bi-chevron-right" style={{ fontSize: '0.65rem' }} /> <span style={{ color: 'var(--cf-ink)', fontWeight: 600 }}>About Us</span>
                </nav>
                <div className="fp-hero-grid">
                    <div>
                        <div className="fh-eyebrow">Our story</div>
                        <h1 className="fp-title">
                            Fresh Food, Made with <em>Love</em> <span className="hl">Every Day</span>
                        </h1>
                        <p className="fp-lead">
                            Welcome to <strong>Cafe Fresco</strong>. Our idea is simple: food from a café kitchen should taste just as good at home. So we cook every dish to order — fluffy breakfasts, crunchy salads, stacked burgers, grills and sweet treats — and bring it to your door while it&apos;s still hot.
                        </p>
                        <div className="fh-hero-cta" style={{ marginTop: 28 }}>
                            <Link to="/products" className="fh-btn fh-btn-red">
                                Explore our menu <i className="bi bi-arrow-right" />
                            </Link>
                            <Link to="/contact" className="fh-btn fh-btn-ghost">Contact us</Link>
                        </div>
                    </div>
                    <div className="fa-collage">
                        <img src={image1} alt="Cafe Fresco dining room" />
                        <img src={image2} alt="Our counter and bar" />
                        <img src={image3} alt="Guests enjoying a meal" />
                        <img src={image4} alt="Bright seating by the windows" />
                        {dishes > 0 && (
                            <div className="fa-collage-badge">
                                <b>{dishes}+</b>
                                <span>dishes on<br />our menu</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="fa-stats">
                    <div className="fa-stat"><i className="bi bi-egg-fried" /><b>{dishes || '—'}</b><span>Dishes to choose from</span></div>
                    <div className="fa-stat"><i className="bi bi-grid" /><b>{menu.length || '—'}</b><span>Menu categories</span></div>
                    <div className="fa-stat"><i className="bi bi-stopwatch" /><b>~30 min</b><span>Average delivery</span></div>
                    <div className="fa-stat"><i className="bi bi-wallet2" /><b>2 ways</b><span>Card or cash on delivery</span></div>
                </div>
            </section>

            <section ref={r1} className="fh-wrap fh-section fh-reveal">
                <div className="fh-center">
                    <div className="fh-eyebrow">What we stand for</div>
                    <h2 className="fh-h2">Why People Love Cafe Fresco</h2>
                    <div className="fh-rule" />
                </div>
                <div className="fa-values">
                    {VALUES.map(([icon, title, text, c]) => (
                        <div key={title} className="fa-value" style={{ '--c': c }}>
                            <i className={`bi ${icon}`} />
                            <b>{title}</b>
                            <span>{text}</span>
                        </div>
                    ))}
                </div>
            </section>

            <section ref={r2} className="fh-wrap fh-section fh-reveal">
                <div className="fa-kitchen">
                    <div className="fh-start-art">
                        <div className="fh-start-circle">
                            <img src={chef} alt="Our chef with a freshly made dish" loading="lazy" />
                        </div>
                        <img className="fh-sticker" src={stickerSandwich} alt="" style={{ top: '10%', right: '8%' }} />
                    </div>
                    <div>
                        <div className="fh-eyebrow">From our kitchen</div>
                        <h2 className="fh-h2">How Every Order Is Made</h2>
                        <div className="fh-rule" />
                        <ol className="fa-steps">
                            <li>
                                <span>1</span>
                                <div><b>You order</b><p>Pick dishes from the menu and pay by card or cash on delivery.</p></div>
                            </li>
                            <li>
                                <span>2</span>
                                <div><b>We cook it fresh</b><p>Our kitchen starts your order straight away — nothing is pre-made.</p></div>
                            </li>
                            <li>
                                <span>3</span>
                                <div><b>It comes to you hot</b><p>Packed carefully and on its way, and you can follow it under My Orders.</p></div>
                            </li>
                        </ol>
                    </div>
                </div>
            </section>

            {menu.length > 0 && (
                <section ref={r3} className="fh-wrap fh-section fh-reveal fh-center">
                    <div className="fh-eyebrow">On the menu</div>
                    <h2 className="fh-h2">Something for Every Craving</h2>
                    <div className="fh-rule" />
                    <div className="fa-cats">
                        {menu.map((c, i) => (
                            <Link key={c._id} to={`/products?category=${c._id}`} className="fm-chip" style={{ '--c': colorFor(c.title, i) }}>
                                <span className="fm-chip-ico">
                                    <img src={imgUrl(c.image || c.cover)} alt="" onError={onImgError} />
                                </span>
                                {c.title} <small>{c.productCount}</small>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            <section ref={r4} className="fh-wrap fh-reveal">
                <div className="fp-cta">
                    <div>
                        <h2>Hungry already?</h2>
                        <p>Browse the full menu and get it hot at your door in about 30 minutes.</p>
                    </div>
                    <div className="fp-cta-btns">
                        <Link to="/products" className="fh-btn fh-btn-white">Order now <i className="bi bi-arrow-right" /></Link>
                        <Link to="/contact" className="fh-btn fh-btn-outline">Get in touch</Link>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default About;
