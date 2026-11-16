import side1 from '../assets/logo/Rectangle 5.png';
import side2 from '../assets/logo/Rectangle 6.png';
import left from '../assets/logo/left-banner.png';
import hot from '../assets/logo/recipe.png';
import badge from '../assets/logo/Badge.png';

// Hero: yellow copy panel + photo; the rotating badge and side photos are decorative and only shown on wide screens
const Banner = () => {
    return (
        <div className="container-xxl mt-4 position-relative">
            <img className="hero-side hero-side-left hero-side-wide" src={side1} alt="" />
            <div className="row g-0 hero position-relative">
                <img className="hero-badge d-none d-lg-block" src={badge} alt="" />
                <div className="col-12 col-lg-6 hero-copy d-flex flex-column justify-content-center gap-4 p-4 p-md-5">
                    <div className="bannerBtn d-flex align-items-center justify-content-center gap-1 bg-white fw-bold" style={{ boxShadow: "0px 2px 5px rgba(0, 0, 0, 0.3)", width: 'auto', maxWidth: 170 }}>
                        <img src={hot} alt="" />
                        <span>Hot Recipes</span>
                    </div>
                    <h2 className="hero-title">Spicy delicious <span>Fresco Bombs</span></h2>
                    <p className="mb-0">Experience an array of mouthwatering dishes and delightful treats, expertly crafted to satisfy your cravings and elevate your dining experience.</p>
                    <div className="d-flex flex-wrap gap-2">
                        <div className="d-flex gap-1 bannerBtn">
                            <box-icon type='solid' name='time'></box-icon>30 Minutes
                        </div>
                        <div className="d-flex gap-1 bannerBtn">
                            <box-icon name='fork'></box-icon>Dining
                        </div>
                    </div>
                </div>
                <div className="col-12 col-lg-6">
                    <img className="hero-photo" src={left} alt="Spicy Fresco Bombs on a plate" />
                </div>
            </div>
            <img className="hero-side hero-side-right hero-side-wide" src={side2} alt="" />
        </div>
    );
};

export default Banner;
