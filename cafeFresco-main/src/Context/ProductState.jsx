import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import productContext from './ProductContext';
import toast from 'react-hot-toast';
import audio from '../assets/ringtone.mp3'
import { apiFetch } from '../api';
import { SOUND_ENABLED } from '../config/site';
import { round2 } from '../utils/price';


const ProductState = (props) => {
    // One Audio element for the whole app, only used when SOUND_ENABLED
    const audioRef = useRef(null);
    const playSound = useCallback(() => {
        if (!SOUND_ENABLED || typeof Audio === 'undefined') return;
        if (!audioRef.current) audioRef.current = new Audio(audio);
        audioRef.current.play()?.catch(() => {}); // blocked until the user interacts: ignore
    }, []);

    const [cart, setCart] = useState([]);
    // Wishlist products from the server; count and ids are derived so they never disagree
    const [wishlist, setWishlist] = useState([]);
    const [wishlistLoading, setWishlistLoading] = useState(false);
    const wishlistCount = wishlist.length;
    const wishlistIds = useMemo(() => wishlist.map((p) => String(p._id)), [wishlist]);
    const [categories, setCategories] = useState([])
    // Session comes from the server (httpOnly cookie): 'loading' | 'authenticated' | 'anonymous'
    const [user, setUser] = useState(null);
    const [authStatus, setAuthStatus] = useState('loading');
    // Code string sent with the order; the server re-validates and computes the discount
    // Kept for the browser tab (sessionStorage) so a refresh during checkout doesn't silently drop the
    // discount; it is re-validated with the server once the cart has loaded
    const [appliedCode, setAppliedCodeState] = useState(() => {
        try { return sessionStorage.getItem('checkoutCode') || ''; } catch { return ''; }
    });
    const setAppliedCode = (code) => {
        setAppliedCodeState(code);
        try {
            if (code) sessionStorage.setItem('checkoutCode', code);
            else sessionStorage.removeItem('checkoutCode');
        } catch { /* storage unavailable: keep in memory only */ }
    };
    // Server preview for appliedCode: {code, subtotal, discountAmount, total}
    const [discountPreview, setDiscountPreview] = useState(null);
    // Cart lines with a quantity request in flight (their +/- are locked)
    const [pendingIds, setPendingIds] = useState([]);
    // Delivery details from the Address step, sent with /order/create.
    // Survives a refresh during checkout (sessionStorage), cleared on logout and after an order
    const [shippingAddress, setShippingAddressState] = useState(() => {
        try { return JSON.parse(sessionStorage.getItem('checkoutAddress')) || null; } catch { return null; }
    });
    const setShippingAddress = (value) => {
        setShippingAddressState(value);
        try {
            if (value) sessionStorage.setItem('checkoutAddress', JSON.stringify(value));
            else sessionStorage.removeItem('checkoutAddress');
        } catch { /* storage unavailable: keep in memory only */ }
    };
    const [loading, setLoading] = useState(false)
    // True once the cart has been fetched for this session (checkout guards wait for it)
    const [cartLoaded, setCartLoaded] = useState(false);

    // Every piece of per-user state, so the next account on this browser starts clean
    const resetUserState = () => {
        setUser(null);
        setCart([]);
        setCartLoaded(false);
        setWishlist([]);
        setAppliedCode('');
        setDiscountPreview(null);
        setPendingIds([]);
        setShippingAddress(null);
    };

    // Totals are derived from the server cart, never stored separately
    const subtotal = useMemo(() => round2(cart.reduce((acc, item) => (item.available === false ? acc : acc + item.price * item.quantity), 0)), [cart]);
    const discountApplied = Boolean(appliedCode && discountPreview);
    const originalTotal = subtotal;
    const totalPrice = discountApplied ? discountPreview.total : subtotal;
    const discountAmount = discountApplied ? discountPreview.discountAmount : 0;
    // The cart changed since the code was last checked (the re-check is on its way): the total above
    // is from the old cart, so the UI shows it as updating and blocks checkout until it is fresh
    const discountStale = discountApplied && round2(discountPreview.subtotal) !== subtotal && !cart.some((i) => i.available === false);

    // Every cart endpoint returns the formatted cart; it replaces local state as-is
    const applyCartResponse = (data) => {
        if (!Array.isArray(data?.cart)) return;
        setCart(data.cart);
        if (data.removedCount) toast(`${data.removedCount} item(s) were removed from your cart because they no longer exist`);
    };

    const getCart = async () => {
        setLoading(true)
        try {
            const { ok, status, data } = await apiFetch('/cart/all');
            if (ok) {
                applyCartResponse(data);
            } else if (status === 404) {
                setCart([]); // no cart yet = empty cart
            } else if (status === 401) {
                refreshSession();
            }
        } finally {
            setLoading(false)
            setCartLoaded(true)
        }
    };

    const applyWishlistResponse = (data) => {
        if (Array.isArray(data?.wishlist)) setWishlist(data.wishlist.filter(Boolean));
    };

    const getWishlist = async () => {
        setWishlistLoading(true);
        const { ok, status, data } = await apiFetch('/wishlist/all');
        setWishlistLoading(false);
        if (ok) applyWishlistResponse(data);
        else if (status === 401) refreshSession();
        return ok;
    };

    // Returns { ok, needsLogin }; "already saved" counts as saved
    const addToWish = async (productId) => {
        const { ok, status, data } = await apiFetch('/wishlist/add', { method: 'POST', body: { productId } });
        playSound();
        if (status === 401) { toast.error('Please login to continue.'); refreshSession(); return { ok: false, needsLogin: true }; }
        applyWishlistResponse(data);
        if (ok) toast.success('Saved to your wishlist');
        else if (status === 400 && Array.isArray(data?.wishlist)) toast(data.message || 'Already in your wishlist');
        else { toast.error(data?.message || 'Something went wrong. Please try again.'); return { ok: false }; }
        return { ok: true };
    };

    // By productId, no optimistic change: the line shows the server's quantity once the request returns
    const updateCartItemQuantity = async (productId, newQuantity) => {
        const id = String(productId);
        if (pendingIds.includes(id)) return;
        setPendingIds((ids) => [...ids, id]);
        try {
            const { ok, status, data } = await apiFetch('/cart/update-quantity', { method: 'POST', body: { productId, quantity: newQuantity } });
            applyCartResponse(data);
            if (!ok) {
                toast.error(data.message || "Failed to update quantity");
                playSound();
                if (status === 401) refreshSession();
                else if (!Array.isArray(data?.cart)) getCart();
            }
        } finally {
            setPendingIds((ids) => ids.filter((x) => x !== id));
        }
    };

    // Returns { ok, needsLogin } so callers can navigate to login when needed
    const addToCart = async (product) => {
        const { ok, status, data } = await apiFetch('/cart/add', { method: 'POST', body: { productId: product.id, quantity: product.quantity } });
        if (status === 401) {
            toast.error('Please login to continue.');
            playSound();
            refreshSession();
            return { ok: false, needsLogin: true };
        }
        if (!ok) {
            toast.error(data.message || 'Could not add to cart');
            playSound();
            return { ok: false };
        }
        toast.success(data.message || 'Added to cart');
        playSound();
        applyCartResponse(data);
        return { ok: true };
    };

    const removeFromCart = async (productId) => {
        const { ok, data } = await apiFetch('/cart/remove', { method: 'POST', body: { productId } });
        applyCartResponse(data);
        if (ok) {
            toast.success('Removed from cart');
            playSound();
        } else {
            toast.error(data.message || 'Failed to remove');
            playSound();
        }
    };

    const clearDiscount = () => {
        setAppliedCode('');
        setDiscountPreview(null);
    };

    // Preview only: the server computes the discount from the saved cart and records nothing.
    // One code at a time; silent re-checks drop a code that no longer applies and say why.
    const applyDiscount = async (code, { silent = false } = {}) => {
        const { ok, data } = await apiFetch('/discount/apply', { method: 'POST', body: { code } });
        if (!ok) {
            clearDiscount();
            toast.error(silent ? `Discount removed: ${data.message || 'code no longer applies'}` : (data.message || 'Failed to apply'));
            playSound();
            return false;
        }
        setAppliedCode(data.code);
        setDiscountPreview({ code: data.code, subtotal: data.subtotal, discountAmount: data.discountAmount, total: data.total });
        if (!silent) { toast.success(data.message || 'Discount applied'); playSound(); }
        return true;
    };

    // D5: keep the applied code and re-check it whenever the server cart changes
    // (an empty cart only clears the code once the cart has really loaded — on a refresh it starts empty)
    useEffect(() => {
        if (!appliedCode || !cartLoaded) return;
        if (cart.length === 0) { clearDiscount(); return; }
        const t = setTimeout(() => applyDiscount(appliedCode, { silent: true }), 400);
        return () => clearTimeout(t);
    }, [cart, cartLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

    const removeFromWish = async (productId) => {
        const { ok, data } = await apiFetch('/wishlist/remove', { method: 'POST', body: { productId } });
        applyWishlistResponse(data);
        if (ok) {
            toast.success('Removed from wishlist');
            playSound();
        } else {
            toast.error(data.message || 'Failed to remove');
            playSound();
        }
    };

    const fetchCategories = async () => {
        const { ok, data } = await apiFetch('/category/fetch');
        if (ok) setCategories(data.categories || []);
        else console.error('Failed to fetch categories');
    };

    const refreshSession = useCallback(async () => {
        const { ok, status, data } = await apiFetch('/user/me');
        if (ok) {
            setUser(data.user);
            setAuthStatus('authenticated');
            getCart();
            getWishlist();
            return data.user;
        }
        if (status === 0) {
            // Network error: keep an existing session, resolve a first load as anonymous
            setAuthStatus((s) => (s === 'loading' ? 'anonymous' : s));
            return null;
        }
        resetUserState();
        setAuthStatus('anonymous');
        return null;
    }, []);

    const logout = async () => {
        await apiFetch('/user/logout', { method: 'POST' });
        resetUserState();
        setAuthStatus('anonymous');
    };

    useEffect(() => {
        fetchCategories();
        refreshSession();
    }, []);

    // Coming back to the tab re-checks the session, cart and wishlist (logout, a new login or an
    // order placed in another tab), at most every 30 s
    useEffect(() => {
        let last = Date.now();
        const onVisible = () => {
            if (document.visibilityState !== 'visible' || Date.now() - last < 30000) return;
            last = Date.now();
            refreshSession();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [refreshSession]);


    return (
        <productContext.Provider value={{ user, authStatus, cartLoaded, refreshSession, logout, cart, getCart, addToCart, updateCartItemQuantity, removeFromCart, pendingIds, wishlist, wishlistLoading, wishlistCount, wishlistIds, getWishlist, addToWish, removeFromWish, categories, fetchCategories, subtotal, totalPrice, originalTotal, discountAmount, discountApplied, discountStale, appliedCode, applyDiscount, clearDiscount, shippingAddress, setShippingAddress, playSound, loading }}>
            {props.children}
        </productContext.Provider>
    );
};

ProductState.propTypes = {
    children: PropTypes.node.isRequired
};

export default ProductState;
