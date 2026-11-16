// Demo data from TheMealDB (free food database for development / education — https://www.themealdb.com).
// - gives the seeded menu categories transparent cut-out images (the landing page cards use them)
// - adds dishes with real photos to each category (+ a Seafood category)
// Idempotent: dishes are matched by title; images are downloaded once into public/images.
// Usage: node scripts/seedMealDb.js   (run seedMenu.js first)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Category = require('../models/category');
const Product = require('../models/product');
const Inventory = require('../models/inventory');

const API = 'https://www.themealdb.com/api/json/v1/1';
const PUBLIC = path.join(__dirname, '..', 'public', 'images');

// our category → TheMealDB cut-out + which TheMealDB categories feed it and how many dishes
const PLAN = [
    { title: 'Breakfast', cutout: 'breakfast', from: [['Breakfast', 5]], price: [5.5, 9] },
    { title: 'Healthy Bowls', cutout: 'vegan', from: [['Vegetarian', 4], ['Vegan', 2]], price: [7, 11] },
    { title: 'Burgers & Wraps', cutout: 'chicken', from: [['Chicken', 5]], price: [7.5, 12] },
    { title: 'Grills', cutout: 'beef', from: [['Beef', 4], ['Lamb', 3]], price: [12, 19] },
    { title: 'Pizza & Pasta', cutout: 'pasta', from: [['Pasta', 5]], price: [8, 13] },
    { title: 'Desserts', cutout: 'dessert', from: [['Dessert', 6]], price: [3.5, 7] },
    { title: 'Seafood', cutout: 'seafood', from: [['Seafood', 6]], price: [11, 18], description: 'Fresh fish, prawns and seafood plates', create: true }
];

const getJson = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.json();
};

async function download(url, kind, name) {
    const dir = path.join(PUBLIC, kind);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status} ${url}`);
        fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    }
    return `/images/${kind}/${name}`;
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// stable pseudo-random from a string, so prices don't change between runs
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function describe(meal, kind) {
    const area = meal.strArea && meal.strArea !== 'Unknown' ? meal.strArea : '';
    const ingredients = Array.from({ length: 20 }, (_, i) => meal[`strIngredient${i + 1}`])
        .map((x) => (x || '').trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 4);
    const base = `${area ? `${area}-style ` : ''}${kind.toLowerCase()} favourite, freshly made to order`;
    return ingredients.length ? `${base} with ${ingredients.slice(0, -1).join(', ')}${ingredients.length > 1 ? ' and ' : ''}${ingredients.slice(-1)}.` : `${base}.`;
}

(async () => {
    await mongoose.connect(process.env.DB_URI);
    let added = 0, catsUpdated = 0;

    for (const plan of PLAN) {
        let cat = await Category.findOne({ title: new RegExp(`^${plan.title.replace(/[&]/g, '\\&')}$`, 'i') });
        const cutout = await download(`https://www.themealdb.com/images/category/${plan.cutout}.png`, 'category', `mealdb-${plan.cutout}.png`);
        if (!cat && plan.create) cat = await Category.create({ title: plan.title, description: plan.description, image: cutout });
        if (!cat) {
            console.log(`skip ${plan.title}: run seedMenu.js first`);
            continue;
        }
        // only replace images this seeding put there (never an admin-uploaded one)
        if (!cat.image || /\/seed-|mealdb-/.test(cat.image)) {
            if (cat.image !== cutout) {
                cat.image = cutout;
                await cat.save();
                catsUpdated++;
            }
        }

        for (const [mealCat, count] of plan.from) {
            const { meals } = await getJson(`${API}/filter.php?c=${encodeURIComponent(mealCat)}`);
            for (const m of (meals || []).slice(0, count)) {
                const title = m.strMeal.trim();
                if (await Product.exists({ title: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })) continue;
                const { meals: full } = await getJson(`${API}/lookup.php?i=${m.idMeal}`);
                const meal = full?.[0] || m;
                const image = await download(m.strMealThumb, 'product', `mealdb-${slug(title)}.jpg`);
                const h = hash(title);
                const [lo, hi] = plan.price;
                const price = Math.round((lo + (h % 1000) / 1000 * (hi - lo)) * 4) / 4 - 0.01; // x.24 / x.49 / x.74 / x.99
                const discount = [0, 0, 0, 10, 0, 15, 0, 20][h % 8];
                const p = await Product.create({
                    title,
                    description: describe(meal, mealCat),
                    image,
                    price: Math.max(1, Number(price.toFixed(2))),
                    discount,
                    category: cat._id,
                    featured: h % 5 === 0,
                    newRelease: h % 4 === 1,
                    isActive: true
                });
                const inv = await Inventory.create({ productId: p._id, quantityInStock: 8 + (h % 40), restockDate: new Date() });
                p.inventory = inv._id;
                await p.save();
                added++;
            }
        }
        console.log(`${plan.title}: done`);
    }
    // Drinks: TheMealDB has none, so use its sister site TheCocktailDB (non-alcoholic only) + a coffee cut-out
    const drinks = await Category.findOne({ title: /^drinks$/i });
    if (drinks) {
        const cutout = await download('https://www.thecocktaildb.com/images/ingredients/Coffee.png', 'category', 'cocktaildb-coffee.png');
        if (!drinks.image || /\/seed-|mealdb-|cocktaildb-/.test(drinks.image)) {
            if (drinks.image !== cutout) { drinks.image = cutout; await drinks.save(); catsUpdated++; }
        }
        const { drinks: list } = await getJson('https://www.thecocktaildb.com/api/json/v1/1/filter.php?a=Non_Alcoholic');
        for (const d of (list || []).slice(0, 7)) {
            const title = d.strDrink.trim();
            if (await Product.exists({ title: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })) continue;
            const image = await download(d.strDrinkThumb, 'product', `cocktaildb-${slug(title)}.jpg`);
            const h = hash(title);
            const p = await Product.create({
                title,
                description: 'Chilled, alcohol-free and made fresh at the bar — the perfect match for any meal.',
                image,
                price: Number((3.49 + (h % 4) * 0.5).toFixed(2)),
                discount: h % 6 === 0 ? 10 : 0,
                category: drinks._id,
                featured: h % 5 === 0,
                newRelease: h % 4 === 1,
                isActive: true
            });
            const inv = await Inventory.create({ productId: p._id, quantityInStock: 20 + (h % 30), restockDate: new Date() });
            p.inventory = inv._id;
            await p.save();
            added++;
        }
        console.log('Drinks: done');
    }
    console.log(`dishes added: ${added}, category images updated: ${catsUpdated}`);
    await mongoose.disconnect();
})().catch(async (e) => {
    console.error(e);
    await mongoose.disconnect();
    process.exit(1);
});
