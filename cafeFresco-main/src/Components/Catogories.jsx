import { Link, useNavigate } from 'react-router-dom';
import productContext from '../Context/ProductContext';
import { useContext, useRef } from 'react';

const Categories = () => {
    const navigate = useNavigate();
    const context = useContext(productContext);
    const { categories } = context;
    const BASE_URL = import.meta.env.VITE_BASE_URL;
    const scrollRef = useRef(null);

    const handleClick = (category) => {
        navigate(`/products?category=${category._id}`);
    };

    const CARD_WIDTH = 130 + 20;
    const VISIBLE_COUNT = 6;
    const SCROLL_AMOUNT = CARD_WIDTH * VISIBLE_COUNT;

    const scroll = (direction) => {
        if (scrollRef.current) {
            scrollRef.current.scrollBy({
                left: direction === 'left' ? -SCROLL_AMOUNT : SCROLL_AMOUNT,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div className="container MobileCategory position-relative">
            <div className="d-flex justify-content-between align-items-center">
                <h1 style={{ fontWeight: 700 }}>Categories</h1>
                <Link to="/products" className='bannerBtn text-decoration-none' style={{ width: "170px", fontWeight: 650, textAlign: 'center' }}>
                    View All Categories
                </Link>
            </div>

            <div className="position-relative mt-4">
                {/* Left Arrow */}
                {categories.length > VISIBLE_COUNT && (
                    <button
                        onClick={() => scroll('left')}
                        className="btn btn-light position-absolute"
                        aria-label="Scroll categories left"
                        style={{ left: 0, top: '45%', transform: 'translateY(-50%)', zIndex: 1 }}
                    >
                        &#8592;
                    </button>
                )}

                {/* Scrollable container */}
                <div
                    ref={scrollRef}
                    className="d-flex category-strip"
                    style={{
                        gap: "24px",
                        flexWrap: "nowrap",
                        scrollBehavior: "smooth",
                    }}
                >
                    {categories.map((cat, index) => (
                        <div
                            key={index}
                            style={{ flex: "0 0 auto", width: "130px", cursor: "pointer" }}
                            onClick={() => handleClick(cat)}
                        >
                            <div
                                className="card catogory-card"
                                style={{
                                    fontWeight: 700,
                                    padding: "2px",
                                    alignItems: "center",
                                    width: '130px',
                                    height: "150px",
                                    border: "none",
                                    borderRadius: "20px"
                                }}
                            >
                                <img
                                    style={{ marginTop: "10px", width: 70, height: 70 }}
                                    src={`${BASE_URL}/${cat.image}`}
                                    alt={cat.title}
                                />
                                <div className="card-body text-center">
                                    <p className="card-text">{cat.title}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Right Arrow */}
                {categories.length > VISIBLE_COUNT && (
                    <button
                        onClick={() => scroll('right')}
                        className="btn btn-light position-absolute"
                        aria-label="Scroll categories right"
                        style={{ right: 0, top: '45%', transform: 'translateY(-50%)', zIndex: 1 }}
                    >
                        &#8594;
                    </button>
                )}
            </div>
        </div>
    );
};

export default Categories;
