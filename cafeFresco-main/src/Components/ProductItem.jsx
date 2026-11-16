import 'boxicons';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router-dom';
import { useContext, useState } from 'react';
import productContext from '../Context/ProductContext';
import toast from 'react-hot-toast';
import { formatMoney, unitPrice } from '../utils/price';

// Shown when a product image is missing or fails to load
const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="287" height="200"><rect width="100%" height="100%" fill="#f3e2b0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#8a7a4a">No image</text></svg>'
);

const badgeStyle = (bg) => ({
    backgroundColor: bg, color: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold'
});

const ProductItem = (props) => {
    const navigate = useNavigate();
    const { playSound, addToCart, authStatus } = useContext(productContext);
    const [adding, setAdding] = useState(false);
    const [added, setAdded] = useState(false);
    const BASE_URL = import.meta.env.VITE_BASE_URL;

    const discount = Number(props.discount) || 0;
    const finalPrice = unitPrice({ price: props.price, discount });
    const outOfStock = props.stock !== undefined && props.stock <= 0;
    const productUrl = `/product/${props.id}`;

    // The check mark reflects the real result: shown 2 s after a successful add, then reverts
    const handleCartSubmit = async () => {
        if (adding || outOfStock) return;
        if (authStatus !== 'authenticated') {
            playSound();
            toast.error('Please login first to use the cart');
            navigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
            return;
        }
        setAdding(true);
        const result = await addToCart({ id: props.id, quantity: 1 });
        setAdding(false);
        if (result?.needsLogin) {
            navigate(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        } else if (result?.ok) {
            setAdded(true);
            setTimeout(() => setAdded(false), 2000);
        }
    };

    return (
        <div>
            <div className="card cardItem" style={{ borderRadius: "15px", background: '#feeab3', height: "340px", width: '18rem', marginTop: 30, marginBottom: 40 }}>
                <div className="d-flex flex-column align-items-end gap-1" style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1 }}>
                    {props.isNew && <span style={badgeStyle('red')}>New</span>}
                    {props.isFeatured && <span style={badgeStyle('#d97706')}>Featured</span>}
                    {discount > 0 && <span style={badgeStyle('#15803d')}>-{discount}%</span>}
                    {outOfStock && <span style={badgeStyle('#6b7280')}>Out of stock</span>}
                </div>

                <img
                    onClick={() => navigate(productUrl)}
                    style={{ width: "287px", height: "200px", borderRadius: "17px", cursor: 'pointer', objectFit: 'cover' }}
                    className="card-img-top"
                    src={props.image ? `${BASE_URL}/${props.image}` : PLACEHOLDER}
                    onError={(e) => { if (e.currentTarget.src !== PLACEHOLDER) e.currentTarget.src = PLACEHOLDER; }}
                    alt={props.title}
                    loading="lazy"
                />
                <div className="card-body">
                    <h2 className="card-title h5">
                        <Link to={productUrl} className="text-reset text-decoration-none">{props.title}</Link>
                    </h2>
                    <div className="d-flex gap-2 align-items-center" style={{ marginTop: "30px" }}>
                        <div className="fw-bold">
                            {formatMoney(finalPrice)}
                            {discount > 0 && <span className="ms-1 text-muted text-decoration-line-through small">{formatMoney(props.price)}</span>}
                        </div>
                        <div className="d-flex gap-1">
                            <box-icon name='fork'></box-icon>{props.details}
                        </div>
                    </div>

                    <box-icon
                        className="mobile-icon-item"
                        name={added ? 'check-square' : 'cart-add'}
                        type="solid"
                        title={outOfStock ? 'Out of stock' : 'Add to cart'}
                        aria-disabled={outOfStock || adding}
                        onClick={handleCartSubmit}
                        style={{
                            cursor: outOfStock ? 'not-allowed' : adding ? 'progress' : 'pointer',
                            opacity: outOfStock ? 0.4 : 1,
                            position: "relative",
                            top: "-27px",
                            right: "-215px",
                            marginLeft: "15px",
                            width: "30px",
                            height: "30px",
                        }}
                    ></box-icon>
                </div>
            </div>
        </div>
    );
}

export default ProductItem;


ProductItem.propTypes = {
    background: PropTypes.string,
    title: PropTypes.string,
    details: PropTypes.string,
    image: PropTypes.string,
    description: PropTypes.string,
    id: PropTypes.string,
    price: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    discount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    stock: PropTypes.number,
    isNew: PropTypes.bool,
    isFeatured: PropTypes.bool,
};
