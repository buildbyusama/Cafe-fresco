import { useContext, useEffect, useRef, useState } from 'react';
import productContext from '../../Context/ProductContext';
import { apiFetch } from '../../api';

// Trending for everyone; "for you" from the shopper's own history (account or guest cookie).
// Both load at once on arrival (the server reads identity from cookies); for-me reloads only when the
// shopper actually logs in or out, so it never shows the previous person's picks.
export function useRecommendations() {
    const { authStatus } = useContext(productContext);
    const [trending, setTrending] = useState(null);
    const [forYou, setForYou] = useState(null);
    const [loadKey, setLoadKey] = useState(0);
    const settled = useRef(null); // first resolved login state

    useEffect(() => {
        let alive = true;
        apiFetch('/reco/trending').then((r) => alive && setTrending(r.ok ? r.data.products || [] : []));
        return () => { alive = false; };
    }, []);

    useEffect(() => {
        if (authStatus === 'loading') return;
        if (settled.current === null) settled.current = authStatus;
        else if (settled.current !== authStatus) {
            settled.current = authStatus;
            setLoadKey((k) => k + 1);
        }
    }, [authStatus]);

    useEffect(() => {
        let alive = true;
        setForYou(null);
        apiFetch('/reco/for-me').then((r) => {
            if (!alive) return;
            // only a real personal list earns its own row (otherwise it would repeat "Trending now")
            setForYou(r.ok && r.data.personal ? r.data.products || [] : []);
        });
        return () => { alive = false; };
    }, [loadKey]);

    return { trending, forYou };
}
