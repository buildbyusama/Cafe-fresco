import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatMoney } from '../../utils/price';
import { colorFor, imgUrl, onImgError } from './useHomeData';

const LIGHT = new Set(['#F2B705']); // dark text on yellow

// Coloured category cards with a round dish photo, in a white rounded panel with side arrows
export default function HomeCategoryCarousel({ menu, loaded }) {
    const navigate = useNavigate();
    const track = useRef(null);
    const [edge, setEdge] = useState({ start: true, end: false });

    const update = () => {
        const el = track.current;
        if (!el) return;
        setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
    };

    useEffect(() => {
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, [menu.length]);

    const scroll = (dir) => track.current?.scrollBy({ left: dir * (track.current.clientWidth * 0.8), behavior: 'smooth' });

    return (
        <section className="fh-wrap fh-cats" aria-label="Menu categories">
            <div className="fh-cats-shell">
                <button type="button" className="fh-arrow fh-arrow-left" onClick={() => scroll(-1)} disabled={edge.start} aria-label="Previous categories">
                    <i className="bi bi-chevron-left" />
                </button>
                <div className="fh-cats-panel">
                    <div className="fh-cats-track" ref={track} onScroll={update}>
                        {!loaded
                            ? Array.from({ length: 5 }, (_, i) => <div key={i} className="fh-skel" style={{ height: 230 }} />)
                            : menu.map((c, i) => {
                                  const color = colorFor(c.title, i);
                                  const to = `/products?category=${c._id}`;
                                  return (
                                      <article
                                          key={c._id}
                                          className={`fh-cat${LIGHT.has(color) ? ' is-light' : ''}`}
                                          style={{ '--c': color }}
                                          onClick={() => navigate(to)}
                                      >
                                          <div className="fh-cat-img">
                                              <img src={imgUrl(c.cover || c.image)} alt="" onError={onImgError} />
                                          </div>
                                          <h3 title={c.title}>{c.title}</h3>
                                          <div className="fh-cat-price">
                                              <div>
                                                  <b><small>from </small>{c.fromPrice != null ? formatMoney(c.fromPrice) : '—'}</b>
                                              </div>
                                              <span className="fh-cat-heart" aria-hidden>
                                                  <i className="bi bi-heart-fill" />
                                              </span>
                                          </div>
                                          <div className="fh-cat-foot">
                                              <Link to={to} className="fh-cat-order" onClick={(e) => e.stopPropagation()}>
                                                  Order Now <i className="bi bi-chevron-right" />
                                              </Link>
                                              <span>
                                                  <i className="bi bi-star-fill" style={{ fontSize: '0.6rem' }} /> {c.productCount}
                                              </span>
                                          </div>
                                      </article>
                                  );
                              })}
                    </div>
                </div>
                <button type="button" className="fh-arrow fh-arrow-right" onClick={() => scroll(1)} disabled={edge.end} aria-label="Next categories">
                    <i className="bi bi-chevron-right" />
                </button>
            </div>
        </section>
    );
}

HomeCategoryCarousel.propTypes = { menu: PropTypes.array.isRequired, loaded: PropTypes.bool };
