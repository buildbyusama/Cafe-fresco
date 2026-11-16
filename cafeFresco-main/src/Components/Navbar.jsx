import './CSS/landing.css';
import logo from '../assets/logo/logo-transparent.png';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import productContext from '../Context/ProductContext';
import { useContext, useEffect, useRef, useState } from 'react';

const LINKS = [
    ['/', 'Home'],
    ['/products', 'Menu'],
    ['/about', 'About Us'],
    ['/contact', 'Contact']
];

const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || 'U';

const Navbar = () => {
    const { cart, wishlistCount, authStatus, user, logout } = useContext(productContext);
    const location = useLocation();
    const navigate = useNavigate();
    const [drawer, setDrawer] = useState(false);
    const [menu, setMenu] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const menuRef = useRef(null);
    const signedIn = authStatus === 'authenticated';

    // close menus on navigation / outside click / Esc
    useEffect(() => {
        setDrawer(false);
        setMenu(false);
    }, [location]);

    useEffect(() => {
        const onDown = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenu(false);
        const onKey = (e) => e.key === 'Escape' && (setMenu(false), setDrawer(false));
        const onScroll = () => setScrolled(window.scrollY > 8);
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('scroll', onScroll);
        };
    }, []);

    const doLogout = async () => {
        setMenu(false);
        setDrawer(false);
        await logout();
        navigate('/login', { replace: true });
    };

    return (
        <>
            <nav className={`cf-nav${scrolled ? ' is-scrolled' : ''}`} aria-label="Main">
                <div className="cf-nav-inner">
                    <Link to="/" className="cf-nav-logo" aria-label="Cafe Fresco home">
                        <img src={logo} alt="Cafe Fresco" />
                    </Link>

                    <ul className="cf-nav-links">
                        {LINKS.map(([to, label]) => (
                            <li key={to}>
                                <NavLink to={to} end={to === '/'}>{label}</NavLink>
                            </li>
                        ))}
                    </ul>

                    <div className="cf-nav-actions">
                        <Link to="/products" className="cf-icon-btn cf-hide-md" aria-label="Search the menu">
                            <i className="bi bi-search" />
                        </Link>
                        <Link to="/wishlist" className="cf-icon-btn cf-hide-md" aria-label={`Wishlist${wishlistCount ? `, ${wishlistCount} items` : ''}`}>
                            <i className="bi bi-heart" />
                            {wishlistCount > 0 && <span className="cf-count">{wishlistCount}</span>}
                        </Link>
                        <Link to="/cart" className="cf-icon-btn" aria-label={`Cart${cart.length ? `, ${cart.length} items` : ''}`}>
                            <i className="bi bi-bag" />
                            {cart.length > 0 && <span className="cf-count">{cart.length}</span>}
                        </Link>

                        {signedIn ? (
                            <div ref={menuRef} style={{ position: 'relative' }} className="cf-hide-md">
                                <button type="button" className="cf-signin" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} style={{ padding: '5px 12px 5px 5px' }}>
                                    <span className="cf-avatar">{initials(user?.name)}</span>
                                    <span>{user?.name?.split(' ')[0] || 'Account'}</span>
                                    <i className="bi bi-chevron-down" style={{ fontSize: '0.75rem' }} />
                                </button>
                                {menu && (
                                    <div className="cf-menu" role="menu">
                                        <div className="cf-menu-head">
                                            <b>{user?.name || 'Welcome back'}</b>
                                            <span>{user?.email}</span>
                                        </div>
                                        <Link to="/track" role="menuitem"><i className="bi bi-truck" /> My orders</Link>
                                        <Link to="/user/profile" role="menuitem"><i className="bi bi-person" /> My profile</Link>
                                        <Link to="/wishlist" role="menuitem"><i className="bi bi-heart" /> Wishlist</Link>
                                        <button type="button" role="menuitem" className="danger" onClick={doLogout}><i className="bi bi-box-arrow-right" /> Log out</button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <Link to="/login" className="cf-signin cf-hide-md">
                                <i className="bi bi-box-arrow-in-right" /> <span>Sign in</span>
                            </Link>
                        )}

                        <button type="button" className="cf-icon-btn cf-burger" aria-label="Open menu" aria-expanded={drawer} onClick={() => setDrawer(true)}>
                            <i className="bi bi-list" style={{ fontSize: '1.5rem' }} />
                        </button>
                    </div>
                </div>
            </nav>

            {drawer && (
                <>
                    <div className="cf-drawer-backdrop" onClick={() => setDrawer(false)} />
                    <aside className="cf-drawer" aria-label="Menu">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <img src={logo} alt="Cafe Fresco" style={{ height: 38 }} />
                            <button type="button" className="cf-icon-btn" aria-label="Close menu" onClick={() => setDrawer(false)}>
                                <i className="bi bi-x-lg" />
                            </button>
                        </div>
                        {LINKS.map(([to, label]) => (
                            <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>
                        ))}
                        <NavLink to="/wishlist">Wishlist{wishlistCount > 0 ? ` (${wishlistCount})` : ''}</NavLink>
                        <div style={{ height: 1, background: 'var(--cf-line)', margin: '8px 0' }} />
                        {signedIn ? (
                            <>
                                <NavLink to="/track">My orders</NavLink>
                                <NavLink to="/user/profile">My profile</NavLink>
                                <button type="button" className="cf-drawer-link" style={{ color: 'var(--cf-red-dark)' }} onClick={doLogout}>Log out</button>
                            </>
                        ) : (
                            <div style={{ display: 'grid', gap: 10, marginTop: 6 }}>
                                <Link to="/login" className="fh-btn fh-btn-red" style={{ color: '#fff' }}>Sign in</Link>
                                <Link to="/signup" className="fh-btn fh-btn-ghost">Create account</Link>
                            </div>
                        )}
                    </aside>
                </>
            )}
        </>
    );
};

export default Navbar;
