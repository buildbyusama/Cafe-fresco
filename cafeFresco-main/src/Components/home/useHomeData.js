import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import productContext from '../../Context/ProductContext';

const BASE_URL = import.meta.env.VITE_BASE_URL;

// One colour per category, used by the carousel cards and the category list icons.
// Logo reds / orange / yellow by default; a few categories get a colour that means something.
const BRAND = ['#E8262B', '#FF8A1F', '#F2B705', '#C8102E', '#F2672E', '#D9480F'];
const BY_NAME = [
    [/healthy|salad|vegan|bowl/i, '#3E9B48'],
    [/drink|coffee|juice|shake/i, '#8A4B2A'],
    [/sea ?food|fish/i, '#1C8C9E']
];
export const colorFor = (title, i) => (BY_NAME.find(([rx]) => rx.test(title)) || [null, BRAND[i % BRAND.length]])[1];

// Shown when a category / dish has no photo or the photo fails to load (soft cream tile with a plate icon)
export const FALLBACK_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#FFF1DC"/><circle cx="60" cy="62" r="30" fill="#fff" stroke="#F5B400" stroke-width="4"/><circle cx="60" cy="62" r="17" fill="#FDE6A8"/><path d="M28 30v20M24 30v12a4 4 0 0 0 8 0V30M92 30c-6 4-6 16 0 20v20" stroke="#E8262B" stroke-width="4" fill="none" stroke-linecap="round"/></svg>'
);

// Product / category images are stored as "/images/…" on the API server
export const imgUrl = (path) => (!path ? FALLBACK_IMG : /^(https?:|data:)/.test(path) ? path : `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`);

// <img onError={onImgError}>: swap a broken photo for the fallback once
export const onImgError = (e) => {
    if (e.currentTarget.src !== FALLBACK_IMG) e.currentTarget.src = FALLBACK_IMG;
};

// Featured + new releases for the landing page (one load), categories from the shared context
export function useHomeData() {
    const { categories } = useContext(productContext);
    const [featured, setFeatured] = useState(null);
    const [fresh, setFresh] = useState(null);
    const [bestDeal, setBestDeal] = useState(null);

    useEffect(() => {
        let alive = true;
        const load = (path, set, isList = true) =>
            fetch(`${BASE_URL}${path}`)
                .then((r) => (r.ok ? r.json() : null))
                .catch(() => null)
                .then((d) => alive && set(isList ? (Array.isArray(d) ? d : []) : d && d._id ? d : null));
        load('/product/featured', setFeatured);
        load('/product/new-releases', setFresh);
        // the whole menu's best live deal, so the badge / offer are the same on every visit
        load('/product/best-deal', setBestDeal, false);
        return () => { alive = false; };
    }, []);

    // only categories that have something to sell, biggest first
    const menu = (categories || []).filter((c) => c.productCount > 0).sort((a, b) => b.productCount - a.productCount);
    return { menu, categoriesLoaded: (categories || []).length > 0, featured, fresh, bestDeal };
}

// Fade sections in as they scroll into view.
// Callback ref: a section may render nothing until its data arrives, so observe whenever the element appears.
// Cleanup happens when React calls the ref with null (no effect cleanup: StrictMode would disconnect it for good).
export function useReveal() {
    const io = useRef(null);
    return useCallback((el) => {
        io.current?.disconnect();
        if (!el) return;
        if (!('IntersectionObserver' in window)) {
            el.classList.add('is-in');
            return;
        }
        io.current = new IntersectionObserver(([entry]) => {
            // a fast scroll can jump right past a section: reveal anything already above the viewport too
            if (entry.isIntersecting || entry.boundingClientRect.top < 0) {
                el.classList.add('is-in');
                io.current.disconnect();
            }
        }, { threshold: 0.12 });
        io.current.observe(el);
    }, []);
}
