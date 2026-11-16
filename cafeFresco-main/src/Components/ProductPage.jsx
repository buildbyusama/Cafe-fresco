import { useState, useContext, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import productContext from '../Context/ProductContext';
import { apiFetch } from '../api';
import './CSS/landing.css';
import './CSS/menu.css';
import DishCard from './home/DishCard';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { colorFor, imgUrl, onImgError } from './home/useHomeData';

const PER_PAGE = 16;

// Page numbers with gaps: 1 … 4 5 6 … 12
const pageList = (current, total) => {
    const pages = new Set([1, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total));
    const sorted = [...pages].sort((a, b) => a - b);
    return sorted.flatMap((n, i) => (i && n - sorted[i - 1] > 1 ? ['…', n] : [n]));
};

const Products = () => {
    const { categories } = useContext(productContext);
    const [products, setProducts] = useState([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [firstLoad, setFirstLoad] = useState(true);
    const [error, setError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    // category chips: fade the right edge only while there is more to scroll
    const chipsRef = useRef(null);
    const [chipsAtEnd, setChipsAtEnd] = useState(false);
    useEffect(() => {
        const el = chipsRef.current;
        const check = () => el && setChipsAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, [categories]);

    // Filters, sort and page live in the URL (?category=<id>&q=&sort=&page=) so they can be shared and Back restores them
    const [searchParams, setSearchParams] = useSearchParams();
    const selectedCategory = searchParams.get('category') || '';
    const searchTerm = searchParams.get('q') || '';
    // '' = Recommended (featured first); 'new' = newest; low / high = price
    const sort = ['low', 'high', 'new'].includes(searchParams.get('sort')) ? searchParams.get('sort') : '';
    const currentPage = Math.max(1, parseInt(searchParams.get('page')) || 1);

    // Changing a filter or the sort goes back to page 1
    // Every update starts from the live URL (not a value captured at render), so the delayed
    // search update can't undo a chip click made in the meantime
    const updateParam = (key, value) => {
        setSearchParams(
            () => {
                const next = new URLSearchParams(window.location.search);
                if (value) next.set(key, value);
                else next.delete(key);
                next.delete('page');
                return next;
            },
            { replace: key === 'q' }
        );
    };

    // Typing updates the input at once; the URL (and the request) follows 300 ms later
    const [searchInput, setSearchInput] = useState(searchTerm);
    useEffect(() => {
        setSearchInput(searchTerm);
    }, [searchTerm]);
    useEffect(() => {
        if (searchInput === searchTerm) return undefined;
        const t = setTimeout(() => updateParam('q', searchInput.trim()), 300);
        return () => clearTimeout(t);
    }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // Filtering, sorting and paging happen on the server (/product/fetch)
    useEffect(() => {
        const ctrl = new AbortController();
        const qs = new URLSearchParams({ page: String(currentPage), limit: String(PER_PAGE) });
        if (selectedCategory) qs.set('category', selectedCategory);
        if (searchTerm) qs.set('name', searchTerm);
        qs.set('sort', sort === 'new' ? '' : sort || 'recommended');
        setLoading(true);
        setError(false);
        apiFetch(`/product/fetch?${qs}`, { signal: ctrl.signal })
            .then((r) => {
                if (ctrl.signal.aborted) return;
                if (r.ok) {
                    const pages = r.data.totalPages || 1;
                    // page past the end (old link, or a filter shrank the list): go to the last real page
                    if (currentPage > pages && (r.data.total || 0) > 0) {
                        setSearchParams(() => {
                            const next = new URLSearchParams(window.location.search);
                            if (pages > 1) next.set('page', String(pages));
                            else next.delete('page');
                            return next;
                        }, { replace: true });
                        return;
                    }
                    setProducts(r.data.products || []);
                    setTotal(r.data.total || 0);
                    setTotalPages(pages);
                } else {
                    setProducts([]);
                    setError(true);
                }
                setLoading(false);
                setFirstLoad(false);
            })
            .catch(() => {
                // aborted because a newer filter/page replaced this request
                if (!ctrl.signal.aborted) {
                    setProducts([]);
                    setError(true);
                    setLoading(false);
                    setFirstLoad(false);
                }
            });
        return () => ctrl.abort();
    }, [currentPage, selectedCategory, searchTerm, sort, reloadKey]);

    const goToPage = (n) => {
        if (n < 1 || n > totalPages || n === currentPage) return;
        setSearchParams(() => {
            const next = new URLSearchParams(window.location.search);
            if (n > 1) next.set('page', String(n));
            else next.delete('page');
            return next;
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // same order and colours as the home page cards; keep a selected category even if it is empty
    const menu = (categories || []).filter((c) => c.productCount > 0 || c._id === selectedCategory).sort((a, b) => b.productCount - a.productCount);
    const active = menu.find((c) => c._id === selectedCategory);
    const dishTotal = menu.reduce((n, c) => n + (c.productCount || 0), 0);
    const filtered = !!(selectedCategory || searchTerm);
    useDocumentTitle(active ? `${active.title} · Menu` : 'Menu');
    const clearAll = () => setSearchParams(new URLSearchParams(sort ? { sort } : {}));

    return (
        <main className="fh">
            <section className="fm-hero">
                <div className="fh-wrap">
                    <nav className="fm-crumbs" aria-label="Breadcrumb">
                        <Link to="/">Home</Link> <i className="bi bi-chevron-right" style={{ fontSize: '0.7rem' }} /> <span>{active ? active.title : 'Menu'}</span>
                    </nav>
                    <h1 className="fm-title">
                        {active ? (
                            <>
                                {active.title.split(' ').slice(0, -1).join(' ')} <em>{active.title.split(' ').slice(-1)}</em>
                            </>
                        ) : (
                            <>
                                Our <em>Menu</em>
                            </>
                        )}
                    </h1>
                    <p className="fm-sub">{active?.description ? `${active.description}.` : 'Breakfast stacks, healthy bowls, burgers, grills and sweet treats — cooked fresh and delivered hot.'}</p>
                    <div className="fm-search">
                        <i className="bi bi-search" />
                        <input
                            className="inputWidth"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            aria-label="Search products"
                            placeholder="Search dishes, e.g. burger, pancakes, salad"
                        />
                        {searchInput && (
                            <button type="button" aria-label="Clear search" onClick={() => setSearchInput('')}>
                                <i className="bi bi-x-lg" style={{ position: 'static', transform: 'none', fontSize: '0.8rem' }} />
                            </button>
                        )}
                    </div>
                </div>
            </section>

            <section className="fh-wrap">
                <div
                    className={`fm-chips${chipsAtEnd ? ' at-end' : ''}`}
                    role="group"
                    aria-label="Filter by category"
                    ref={chipsRef}
                    onScroll={(e) => setChipsAtEnd(e.currentTarget.scrollLeft + e.currentTarget.clientWidth >= e.currentTarget.scrollWidth - 4)}
                >
                    <button type="button" aria-pressed={!selectedCategory} className={`fm-chip${!selectedCategory ? ' is-active' : ''}`} style={{ '--c': 'var(--cf-red)' }} onClick={() => updateParam('category', '')}>
                        <span className="fm-chip-ico">
                            <i className="bi bi-grid-fill" style={{ color: 'var(--cf-red)' }} />
                        </span>
                        All <small>{dishTotal || ''}</small>
                    </button>
                    {menu.map((c, i) => {
                        const on = c._id === selectedCategory;
                        return (
                            <button key={c._id} type="button" aria-pressed={on} className={`fm-chip${on ? ' is-active' : ''}`} style={{ '--c': colorFor(c.title, i) }} onClick={() => updateParam('category', on ? '' : c._id)}>
                                <span className="fm-chip-ico">
                                    <img src={imgUrl(c.image || c.cover)} alt="" onError={onImgError} />
                                </span>
                                {c.title} <small>{c.productCount}</small>
                            </button>
                        );
                    })}
                </div>

                <div className="fm-toolbar">
                    <div className="fm-count" aria-live="polite">
                        {firstLoad ? 'Loading dishes…' : (
                            <>
                                <b>{total}</b> {total === 1 ? 'dish' : 'dishes'}
                                {searchTerm && <> for “{searchTerm}”</>}
                                {filtered && (
                                    <button type="button" className="fm-clear" onClick={clearAll}>
                                        Clear filters
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                    <label className="fm-sort">
                        Sort by
                        <select aria-label="Sort products" value={sort} onChange={(e) => updateParam('sort', e.target.value)}>
                            <option value="">Recommended</option>
                            <option value="new">Newest</option>
                            <option value="low">Price: low to high</option>
                            <option value="high">Price: high to low</option>
                        </select>
                    </label>
                </div>

                {firstLoad ? (
                    <div className="fh-dish-grid">
                        {Array.from({ length: 8 }, (_, i) => (
                            <div key={i}>
                                <div className="fh-skel" style={{ aspectRatio: '4 / 4.3', borderRadius: 24 }} />
                                <div className="fh-skel" style={{ height: 16, width: '70%', marginTop: 14 }} />
                                <div className="fh-skel" style={{ height: 12, width: '40%', marginTop: 8 }} />
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="fm-empty">
                        <div className="fm-empty-ico"><i className="bi bi-wifi-off" /></div>
                        <h3>Couldn&apos;t load the menu</h3>
                        <p>Please check your connection and try again.</p>
                        <button type="button" className="fh-btn fh-btn-red" onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
                    </div>
                ) : products.length === 0 ? (
                    <div className="fm-empty">
                        <div className="fm-empty-ico"><i className="bi bi-egg-fried" /></div>
                        <h3>No products found</h3>
                        <p>{searchTerm ? `Nothing matches “${searchTerm}”${active ? ` in ${active.title}` : ''}.` : 'There are no dishes here yet.'}</p>
                        {filtered && <button type="button" className="fh-btn fh-btn-red" onClick={clearAll}>See the full menu</button>}
                    </div>
                ) : (
                    <div className={`fm-grid-wrap${loading ? ' is-loading' : ''}`} aria-busy={loading}>
                        <div className="fh-dish-grid">
                            {products.map((p) => (
                                <DishCard key={p._id} product={p} />
                            ))}
                        </div>
                    </div>
                )}

                {!firstLoad && totalPages > 1 && products.length > 0 && (
                    <nav className="fm-pages" aria-label="Pages">
                        <ul className="pagination">
                            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                                <a className="page-link" href="#" aria-label="Previous page" onClick={(e) => { e.preventDefault(); goToPage(currentPage - 1); }}>
                                    <i className="bi bi-chevron-left" />
                                </a>
                            </li>
                            {pageList(currentPage, totalPages).map((n, i) =>
                                n === '…' ? (
                                    <li key={`gap${i}`} className="page-item disabled"><span className="page-link">…</span></li>
                                ) : (
                                    <li key={n} className={`page-item ${currentPage === n ? 'active' : ''}`}>
                                        <a className="page-link" href="#" aria-current={currentPage === n ? 'page' : undefined} onClick={(e) => { e.preventDefault(); goToPage(n); }}>
                                            {n}
                                        </a>
                                    </li>
                                )
                            )}
                            <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                                <a className="page-link" href="#" aria-label="Next page" onClick={(e) => { e.preventDefault(); goToPage(currentPage + 1); }}>
                                    <i className="bi bi-chevron-right" />
                                </a>
                            </li>
                        </ul>
                    </nav>
                )}

                <div className="fm-help">
                    <div>
                        <h3>Ordering for a group?</h3>
                        <p>Catering, office lunches or a big family order — tell us and we&apos;ll plan it with you.</p>
                    </div>
                    <Link to="/contact" className="fh-btn">Talk to us <i className="bi bi-arrow-right" /></Link>
                </div>
            </section>
        </main>
    );
};

export default Products;
