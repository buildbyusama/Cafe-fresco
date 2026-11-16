import './CSS/landing.css';
import HomeHero from './home/HomeHero';
import HomeCategoryCarousel from './home/HomeCategoryCarousel';
import { HomeFreshPicks, HomeGetStarted, HomeOffer, HomePromo, HomeTopFoods } from './home/HomeSections';
import { useHomeData } from './home/useHomeData';

// the dish pictured in the hero (assets/Products/healthy.png) — kept out of the lists below
const HERO_DISH = 'Mediterranean Bowl';

// Landing page (layout from the "Foody" reference, Cafe Fresco logo colours, real menu data)
const Home = () => {
    // bestDeal = the menu's biggest live discount (server-side), drives the hero badge and the offer block
    const { menu, categoriesLoaded, featured, fresh, bestDeal } = useHomeData();
    const dishCount = menu.reduce((n, c) => n + c.productCount, 0);

    // never show the same dish twice on the page: hero dish → offer deal → Top Foods → Just Dropped
    const used = new Set(bestDeal ? [bestDeal._id] : []);
    const fresh4 = (list) => list.filter((p) => p.title !== HERO_DISH && !used.has(p._id));
    const top = featured ? fresh4(featured).slice(0, 4) : null;
    (top || []).forEach((p) => used.add(p._id));
    const newest = fresh ? fresh4(fresh) : null;

    return (
        <main className="fh">
            <HomeHero bestDeal={bestDeal} dishCount={dishCount} categoryCount={menu.length} />
            <HomeCategoryCarousel menu={menu} loaded={categoriesLoaded} />
            <HomePromo menu={menu} />
            <HomeGetStarted />
            <HomeTopFoods items={top} />
            <HomeFreshPicks items={newest} />
            <HomeOffer bestDeal={bestDeal} />
        </main>
    );
};

export default Home;
