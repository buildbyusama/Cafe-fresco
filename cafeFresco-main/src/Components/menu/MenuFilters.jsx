import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../api';
import { formatMoney } from '../../utils/price';

const QUICK = [
    ['Under $5', '', '5'],
    ['$5 – $10', '5', '10'],
    ['$10 – $15', '10', '15'],
    ['$15+', '15', '']
];

// Price range, tags and diet. Edits stay local until "Show results" (one request, not one per keystroke).
export default function MenuFilters({ value, onApply, onClose }) {
    const [draft, setDraft] = useState(value);
    const [tags, setTags] = useState([]);
    const [error, setError] = useState('');
    const panel = useRef(null);

    useEffect(() => {
        apiFetch('/product/tags').then((r) => r.ok && setTags((r.data.tags || []).slice(0, 14)));
        panel.current?.focus();
        const onKey = (e) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const set = (patch) => {
        setDraft((d) => ({ ...d, ...patch }));
        setError('');
    };
    const toggleTag = (t) => set({ tags: draft.tags.includes(t) ? draft.tags.filter((x) => x !== t) : [...draft.tags, t] });

    const apply = () => {
        const min = draft.min === '' ? null : Number(draft.min);
        const max = draft.max === '' ? null : Number(draft.max);
        if ((min !== null && !(min >= 0)) || (max !== null && !(max >= 0))) return setError('Prices must be 0 or more');
        if (min !== null && max !== null && min > max) return setError('Minimum is above the maximum');
        onApply(draft);
    };

    return (
        <>
            <div className="fm-sheet-backdrop" onClick={onClose} aria-hidden />
            <div className="fm-filters" role="dialog" aria-modal="true" aria-label="Filters" tabIndex={-1} ref={panel}>
                <div className="fm-filters-head">
                    <h2>Filters</h2>
                    <button type="button" className="fm-x" onClick={onClose} aria-label="Close filters"><i className="bi bi-x-lg" /></button>
                </div>

                <fieldset>
                    <legend>Price</legend>
                    <div className="fm-quick">
                        {QUICK.map(([label, min, max]) => {
                            const on = draft.min === min && draft.max === max;
                            return (
                                <button key={label} type="button" className={`fm-pill${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => set(on ? { min: '', max: '' } : { min, max })}>
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                    <div className="fm-range">
                        <label>
                            Min
                            <input type="number" inputMode="decimal" min="0" step="0.5" value={draft.min} placeholder="0" onChange={(e) => set({ min: e.target.value })} aria-label="Minimum price" />
                        </label>
                        <span aria-hidden>–</span>
                        <label>
                            Max
                            <input type="number" inputMode="decimal" min="0" step="0.5" value={draft.max} placeholder="Any" onChange={(e) => set({ max: e.target.value })} aria-label="Maximum price" />
                        </label>
                    </div>
                    {error && <p className="fm-ferr" role="alert">{error}</p>}
                </fieldset>

                <fieldset>
                    <legend>Diet</legend>
                    <div className="fm-quick">
                        {[['vegetarian', 'Vegetarian'], ['vegan', 'Vegan']].map(([k, label]) => (
                            <button key={k} type="button" className={`fm-pill${draft.diet === k ? ' is-on' : ''}`} aria-pressed={draft.diet === k} onClick={() => set({ diet: draft.diet === k ? '' : k })}>
                                <i className="bi bi-flower1" /> {label}
                            </button>
                        ))}
                    </div>
                </fieldset>

                {tags.length > 0 && (
                    <fieldset>
                        <legend>Tags</legend>
                        <div className="fm-quick">
                            {tags.map(({ tag, count }) => (
                                <button key={tag} type="button" className={`fm-pill${draft.tags.includes(tag) ? ' is-on' : ''}`} aria-pressed={draft.tags.includes(tag)} onClick={() => toggleTag(tag)}>
                                    #{tag} <small>{count}</small>
                                </button>
                            ))}
                        </div>
                    </fieldset>
                )}

                <div className="fm-filters-foot">
                    <button type="button" className="fh-btn fh-btn-ghost" onClick={() => set({ min: '', max: '', tags: [], diet: '' })}>Reset</button>
                    <button type="button" className="fh-btn fh-btn-red" onClick={apply}>Show results</button>
                </div>
            </div>
        </>
    );
}

MenuFilters.propTypes = { value: PropTypes.object.isRequired, onApply: PropTypes.func.isRequired, onClose: PropTypes.func.isRequired };

// Labels for the active-filter chips under the toolbar
export const filterChips = (f) => [
    ...(f.min || f.max ? [['price', f.min && f.max ? `${formatMoney(f.min)} – ${formatMoney(f.max)}` : f.min ? `From ${formatMoney(f.min)}` : `Up to ${formatMoney(f.max)}`]] : []),
    ...(f.diet ? [['diet', f.diet === 'vegan' ? 'Vegan' : 'Vegetarian']] : []),
    ...f.tags.map((t) => [`tag:${t}`, `#${t}`])
];
