import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

// Store facts from the backend (dashboard → Store Info). One request per page load, shared by every caller.
let cached = null;
let pending = null;
const load = () => {
    if (!pending) {
        pending = apiFetch('/settings/public').then(({ ok, data }) => {
            if (ok) cached = data;
            else pending = null; // let a later caller retry
            return cached;
        });
    }
    return pending;
};

export default function useStoreSettings() {
    const [settings, setSettings] = useState(cached);
    useEffect(() => {
        if (cached) return undefined;
        let alive = true;
        load().then((s) => alive && s && setSettings(s));
        return () => { alive = false; };
    }, []);
    return settings;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmt = (t) => {
    const h = Number(t.slice(0, 2));
    const m = t.slice(3);
    return `${((h + 11) % 12) + 1}${m === '00' ? '' : `:${m}`}${h < 12 ? 'am' : 'pm'}`;
};

// "Mon–Fri 9am – 11pm · Sat closed" (consecutive days with the same hours are grouped)
export function hoursSummary(hours) {
    if (!Array.isArray(hours) || !hours.length) return '';
    const label = (h) => (h.closed ? 'closed' : `${fmt(h.open)} – ${fmt(h.close)}`);
    const sorted = [...hours].sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7)); // Monday first
    const groups = [];
    for (const h of sorted) {
        const last = groups[groups.length - 1];
        if (last && last.text === label(h) && (last.end + 1) % 7 === h.day) last.end = h.day;
        else groups.push({ start: h.day, end: h.day, text: label(h) });
    }
    return groups.map((g) => `${DAYS[g.start]}${g.end !== g.start ? `–${DAYS[g.end]}` : ''} ${g.text}`).join(' · ');
}
