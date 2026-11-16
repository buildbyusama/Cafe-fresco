import './CSS/menu.css';
import './CSS/account.css';
import { formatMoney, unitPrice } from '../utils/price';
import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import productContext from '../Context/ProductContext';
import { imgUrl, onImgError } from './home/useHomeData';

const Wishlist = () => {
    // The context list is the only source, so the page and the Navbar badge always agree
    const { wishlist, wishlistLoading, getWishlist, removeFromWish, addToCart } = useContext(productContext);
    const [error, setError] = useState(false);
    const [busyId, setBusyId] = useState(null);

    useEffect(() => {
        getWishlist().then((ok) => setError(!ok));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleCartSubmit = async (item) => {
        setBusyId(item._id);
        await addToCart({ id: item._id, quantity: 1 });
        setBusyId(null);
    };

    const handleRemove = async (item) => {
        setBusyId(item._id);
        await removeFromWish(item._id);
        setBusyId(null);
    };

    const status = (item) => (item.isActive === false ? ['Unavailable', 'is-off'] : item.inStock ? ['In Stock', 'is-on'] : ['Out of Stock', 'is-off']);

    return (
        <main className="fh">
            <section className="fm-hero">
                <div className="fh-wrap">
                    <nav className="fm-crumbs" aria-label="Breadcrumb">
                        <Link to="/">Home</Link> <i className="bi bi-chevron-right" style={{ fontSize: '0.7rem' }} /> <span>Wishlist</span>
                    </nav>
                    <h1 className="fm-title">
                        My <em>wishlist</em>
                    </h1>
                    {wishlist.length > 0 && <p className="fx-lead">{wishlist.length} saved {wishlist.length === 1 ? 'dish' : 'dishes'}</p>}
                </div>
            </section>

            <section className="fh-wrap fx-body">
                {wishlistLoading && wishlist.length === 0 ? (
                    <div className="fx-list">
                        {[0, 1, 2].map((i) => <div key={i} className="fh-skel fx-skel" />)}
                    </div>
                ) : error && wishlist.length === 0 ? (
                    <div className="fm-empty">
                        <div className="fm-empty-ico"><i className="bi bi-wifi-off" /></div>
                        <h3>Couldn&apos;t load your wishlist</h3>
                        <p>Please check your connection and try again.</p>
                        <button type="button" className="fh-btn fh-btn-red" onClick={() => getWishlist().then((ok) => setError(!ok))}>Try again</button>
                    </div>
                ) : wishlist.length === 0 ? (
                    <div className="fm-empty">
                        <div className="fm-empty-ico"><i className="bi bi-heart" /></div>
                        <h3>Your wishlist is empty</h3>
                        <p>Tap the heart on any dish to save it here for later.</p>
                        <Link to="/products" className="fh-btn fh-btn-red">Browse the menu</Link>
                    </div>
                ) : (
                    <div className="fx-list">
                        {wishlist.map((item) => {
                            const [label, cls] = status(item);
                            return (
                                <article key={item._id} className="fx-row" data-product={item._id}>
                                    <Link to={`/product/${item._id}`} className="fx-thumb">
                                        <img src={imgUrl(item.image)} alt={item.title} onError={onImgError} loading="lazy" />
                                    </Link>
                                    <div className="fx-info">
                                        <Link to={`/product/${item._id}`} className="fx-name">{item.title}</Link>
                                        <span className={`fx-stock ${cls}`}>{label}</span>
                                    </div>
                                    <div className="fx-price">
                                        {formatMoney(unitPrice(item))}
                                        {item.discount > 0 && <s>{formatMoney(item.price)}</s>}
                                    </div>
                                    <div className="fx-actions">
                                        <button type="button" className="fh-btn fh-btn-red fx-add" disabled={!item.inStock || item.isActive === false || busyId === item._id} onClick={() => handleCartSubmit(item)}>
                                            <i className="bi bi-bag-plus" /> Add to Cart
                                        </button>
                                        <button type="button" className="fx-remove" aria-label={`Remove ${item.title}`} disabled={busyId === item._id} onClick={() => handleRemove(item)}>
                                            <i className="bi bi-trash3" />
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>
        </main>
    );
};

export default Wishlist;
