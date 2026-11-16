import './CSS/landing.css';
import { useContext } from 'react';
import { Link } from 'react-router-dom';
import productContext from '../Context/ProductContext';
import logo from '../assets/logo/logo-transparent.png';

// Four-column footer (reference layout): brand, about, menu categories, account
const Footer = () => {
    const { categories, authStatus } = useContext(productContext);
    const menu = (categories || []).filter((c) => c.productCount > 0).sort((a, b) => b.productCount - a.productCount).slice(0, 5);
    const signedIn = authStatus === 'authenticated';

    return (
        <footer className="cf-footer">
            <div className="cf-footer-grid">
                <div>
                    <img src={logo} alt="Cafe Fresco" style={{ height: 46, marginBottom: 14 }} />
                    <p>Fresh breakfast, healthy bowls, burgers and grills — cooked to order in our kitchen and delivered hot to your door.</p>
                    <div className="cf-pay">
                        <span><i className="bi bi-credit-card" /> Card</span>
                        <span><i className="bi bi-cash-coin" /> Cash on delivery</span>
                    </div>
                </div>
                <div>
                    <h4>About Us</h4>
                    <ul>
                        <li><Link to="/about">Our Story</Link></li>
                        <li><Link to="/contact">Contact</Link></li>
                        <li><Link to="/contact">Catering &amp; big orders</Link></li>
                        <li><Link to="/products">Full Menu</Link></li>
                    </ul>
                </div>
                <div>
                    <h4>Our Menu</h4>
                    <ul>
                        {menu.map((c) => (
                            <li key={c._id}><Link to={`/products?category=${c._id}`}>{c.title}</Link></li>
                        ))}
                    </ul>
                </div>
                <div>
                    <h4>Your Account</h4>
                    <ul>
                        {signedIn ? (
                            <>
                                <li><Link to="/track">My Orders</Link></li>
                                <li><Link to="/user/profile">My Profile</Link></li>
                            </>
                        ) : (
                            <>
                                <li><Link to="/login">Sign in</Link></li>
                                <li><Link to="/signup">Create account</Link></li>
                            </>
                        )}
                        <li><Link to="/cart">Cart</Link></li>
                        <li><Link to="/wishlist">Wishlist</Link></li>
                    </ul>
                </div>
            </div>
            <div className="cf-footer-bottom">
                <span>Copyright © {new Date().getFullYear()} Cafe Fresco</span>
                <span>Developed by <b>Muhammad Usama, Muhammad Waleed</b></span>
            </div>
        </footer>
    );
};

export default Footer;
