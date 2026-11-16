import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import heroDish from '../../assets/Products/healthy.png';

// Hero: serif headline, round dish with an offer badge, two service chips (reference layout, Cafe Fresco content)
export default function HomeHero({ bestDeal, dishCount, categoryCount }) {
    const scrollToSteps = () => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });

    return (
        <section className="fh-hero">
            <div className="fh-wrap fh-hero-grid">
                <div>
                    <h1 className="fh-hero-title">
                        Fresh Food is the <em>Best Part</em> of Your <span className="fh-hl">Day</span>
                    </h1>
                    <p className="fh-hero-sub">
                        Breakfast stacks, healthy bowls, burgers and grills — cooked fresh at Cafe Fresco and delivered hot to your door.
                    </p>
                    <div className="fh-hero-cta">
                        <Link to="/products" className="fh-btn fh-btn-red">
                            Explore Menu <i className="bi bi-arrow-right" />
                        </Link>
                        <button type="button" className="fh-play" onClick={scrollToSteps}>
                            <span><i className="bi bi-play-fill" /></span>
                            How it works
                        </button>
                    </div>
                    {dishCount > 0 && (
                        <div className="fh-hero-stats">
                            <div><b>{dishCount}+</b><span>Dishes on the menu</span></div>
                            <div><b>{categoryCount}</b><span>Categories</span></div>
                            <div><b>30 min</b><span>Average delivery</span></div>
                        </div>
                    )}
                </div>

                <div className="fh-hero-art">
                    <div className="fh-hero-sun" aria-hidden />
                    <div className="fh-hero-plate">
                        <img src={heroDish} alt="Mediterranean bowl with falafel, hummus and fresh vegetables" />
                    </div>
                    {bestDeal && (
                        <Link to={`/product/${bestDeal._id}`} className="fh-badge" aria-label={`${bestDeal.discount}% off ${bestDeal.title}`}>
                            <div>
                                <b>{bestDeal.discount}%</b>
                                <br />
                                <small>Off</small>
                            </div>
                        </Link>
                    )}
                    <div className="fh-chips">
                        <div className="fh-chip">
                            <i className="bi bi-truck" style={{ background: '#FFF0DC', color: '#E8262B' }} />
                            <div>
                                <b>Fast Delivery</b>
                                <span>Hot at your door in ~30 mins</span>
                            </div>
                        </div>
                        <div className="fh-chip">
                            <i className="bi bi-credit-card-2-front" style={{ background: '#FFF7D6', color: '#B07D00' }} />
                            <div>
                                <b>Pay Your Way</b>
                                <span>Card online or cash on delivery</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

HomeHero.propTypes = { bestDeal: PropTypes.object, dishCount: PropTypes.number, categoryCount: PropTypes.number };
