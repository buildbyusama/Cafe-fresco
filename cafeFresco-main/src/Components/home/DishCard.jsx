import PropTypes from 'prop-types';
import { useContext, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import productContext from '../../Context/ProductContext';
import { formatMoney, unitPrice } from '../../utils/price';
import { imgUrl, onImgError } from './useHomeData';

// One dish card for the whole shop (home "Just Dropped" + the menu page):
// tall photo with tags and a quick-add button, then name, category and price.
export default function DishCard({ product, tag }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { addToCart, authStatus } = useContext(productContext);
    const [state, setState] = useState('idle'); // idle | adding | added
    const p = product;
    const discount = Number(p.discount) || 0;
    const price = unitPrice(p);
    const stock = p.inventory?.quantityInStock;
    const out = stock !== undefined && stock <= 0;
    const url = `/product/${p._id}`;

    const quickAdd = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (out || state === 'adding') return;
        if (authStatus !== 'authenticated') {
            toast.error('Please login first to use the cart');
            navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
            return;
        }
        setState('adding');
        const res = await addToCart({ id: p._id, quantity: 1 });
        if (res?.ok) {
            setState('added');
            setTimeout(() => setState('idle'), 1800);
        } else {
            setState('idle');
            if (res?.needsLogin) navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
        }
    };

    // <article> with two links (photo, name) and the add button beside them: a button may not sit inside a link
    return (
        <article className={`fh-dish${out ? ' is-out' : ''}`}>
            <div className="fh-dish-img">
                <Link to={url} className="fh-dish-photo" tabIndex={-1} aria-hidden="true">
                    <img src={imgUrl(p.image)} alt="" loading="lazy" onError={onImgError} />
                </Link>
                <div className="fh-dish-tags">
                    {out ? (
                        <span className="t-out">Out of stock</span>
                    ) : (
                        <>
                            {(tag || p.newRelease) && <span className="t-new">{tag || 'New'}</span>}
                            {discount > 0 && <span className="t-off">-{discount}%</span>}
                        </>
                    )}
                </div>
                <button
                    type="button"
                    className={`fh-dish-add${state === 'added' ? ' is-added' : ''}`}
                    aria-label={out ? `${p.title} is out of stock` : `Add ${p.title} to cart`}
                    title={out ? 'Out of stock' : 'Add to cart'}
                    disabled={out || state === 'adding'}
                    onClick={quickAdd}
                >
                    <i className={state === 'added' ? 'bi bi-check-lg' : state === 'adding' ? 'bi bi-hourglass-split' : 'bi bi-bag-plus'} />
                </button>
            </div>
            <Link to={url} className="fh-dish-body">
                <b>{p.title}</b>
                <span className="fh-dish-cat">{p.category?.title || 'Cafe Fresco'}</span>
                <span className="fh-dish-price">
                    <strong>{formatMoney(price)}</strong>
                    {discount > 0 && (
                        <s className="text-decoration-line-through">
                            <span className="visually-hidden">was </span>
                            {formatMoney(p.price)}
                        </s>
                    )}
                </span>
            </Link>
        </article>
    );
}

DishCard.propTypes = { product: PropTypes.object.isRequired, tag: PropTypes.string };
