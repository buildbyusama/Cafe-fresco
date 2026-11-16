// Seed the Cafe Fresco menu (categories + dishes + stock) using the photos shipped with the shop.
// Idempotent: existing categories/products (same title) are left alone.
// Also hides QA test products from the shop (isActive=false; nothing deleted â€” some have orders).
// Usage: node scripts/seedMenu.js [path to cafeFresco-main/src/assets]
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Category = require('../models/category');
const Product = require('../models/product');
const Inventory = require('../models/inventory');

const ASSETS = process.argv[2] || path.join(__dirname, '..', '..', 'cafeFresco-main', 'src', 'assets');
const PUBLIC = path.join(__dirname, '..', 'public');

// copy a shop asset into public/images/<kind>/ and return its public path
function publish(rel, kind) {
    const src = path.join(ASSETS, rel);
    if (!fs.existsSync(src)) throw new Error(`Missing asset ${src}`);
    const name = 'seed-' + rel.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
    const dir = path.join(PUBLIC, 'images', kind);
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, name);
    if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
    return `/images/${kind}/${name}`;
}

// [title, description, icon] â€” products follow per category
const MENU = [
    ['Breakfast', 'Fluffy stacks, toasts and bagels to start the day', 'Catagories/breakfast.png', [
        ['Honey Butter Pancakes', 'Three fluffy buttermilk pancakes with whipped butter and warm honey syrup.', 'Products/image17.png', 6.5, 0, { featured: true }],
        ['Berry Pancake Stack', 'Tall pancake stack with fresh berries, maple syrup and a dusting of sugar.', 'Products/breakfast.png', 7.25, 10, { newRelease: true }],
        ['Cinnamon French Toast', 'Thick brioche dipped in cinnamon custard, pan-fried and drizzled with caramel.', 'Products/image19.jpeg', 6.0, 0],
        ['Smoked Salmon Bagel', 'Toasted bagel with cream cheese, smoked salmon, capers and red onion.', 'Products/image23.jpeg', 8.5, 0]
    ]],
    ['Healthy Bowls', 'Fresh salads and bowls packed with greens', 'Catagories/vegan.png', [
        ['Grilled Chicken Salad', 'Chargrilled chicken, avocado, sweetcorn, peppers and greens with lemon dressing.', 'Products/image25.jpg', 9.5, 20, { featured: true }],
        ['Mediterranean Bowl', 'Falafel, hummus, chickpeas, cucumber, tomato and herbs over leafy greens.', 'Products/healthy.png', 9.0, 0, { newRelease: true }],
        ['Halloumi Garden Salad', 'Golden grilled halloumi with tomatoes, olives and crisp lettuce.', 'Products/image38.jpg', 8.75, 0],
        ['Rainbow Fruit Bowl', 'AÃ§aÃ­ base topped with mango, strawberries, kiwi, blueberries and granola.', 'Products/Mask Group (7).png', 7.5, 15, { featured: true }],
        ['Quinoa Power Salad', 'Quinoa, black beans, corn, peppers and lime-coriander dressing.', 'Products/image30.jpg', 8.25, 0],
        ['Egg & Avocado Bowl', 'Soft-boiled eggs, avocado, rice and fresh herbs.', 'Products/Mask Group 8.png', 8.0, 0, { newRelease: true }]
    ]],
    ['Burgers & Wraps', 'Stacked burgers, wraps and sandwiches', 'Catagories/Lunch.png', [
        ['Classic Beef Burger', 'Juicy beef patty, cheddar, lettuce, tomato and house sauce in a toasted bun.', 'Products/maskgroup2.jpeg', 8.99, 0, { featured: true }],
        ['Crispy Chicken Burger', 'Crunchy fried chicken, pickles and spicy mayo in a brioche bun.', 'Products/Mask Group.png', 8.49, 10, { newRelease: true }],
        ['Pulled Chicken Burger', 'Slow-cooked BBQ pulled chicken with crunchy slaw.', 'Products/image35.jpg', 9.25, 0],
        ['Grilled Chicken Wrap', 'Grilled chicken, peppers and garlic sauce wrapped in a toasted tortilla.', 'Products/image20.jpg', 7.5, 0],
        ['Veggie Wrap', 'Roasted vegetables, hummus and greens in a soft wrap.', 'Products/image26.jpg', 6.75, 0],
        ['Bean & Rice Burrito', 'Spiced beans, rice, salsa and cheese rolled up and grilled.', 'Products/image39.jpg', 7.25, 0],
        ['Triple Club Sandwich', 'Chicken, egg, lettuce and tomato stacked three layers high with fries.', 'Products/Mask Group (4).png', 8.25, 0]
    ]],
    ['Grills', 'Steaks, ribs and chargrilled plates', 'Catagories/meat.png', [
        ['Pepper Steak & Fries', 'Grilled sirloin with herb butter and crispy fries.', 'Products/image31.jpg', 17.5, 0, { featured: true }],
        ['Smoky BBQ Ribs', 'Slow-cooked beef ribs glazed with smoky BBQ sauce.', 'Products/image32.jpg', 15.99, 10],
        ['Herb Lamb Chops', 'Rosemary and garlic marinated lamb chops, grilled to order.', 'Products/image34.jpg', 16.5, 0, { newRelease: true }],
        ['Grilled Salmon Fillet', 'Salmon fillet with lemon, herbs and seasonal greens.', 'Products/fish.png', 14.75, 0],
        ['Beef Meatballs', 'Hand-rolled meatballs on fresh rocket with tomato dip.', 'Products/meat.png', 10.5, 0]
    ]],
    ['Pizza & Pasta', 'Stone-baked pizza and fresh pasta', 'Products/image40.jpg', [
        ['Garden Veggie Pizza', 'Stone-baked pizza with peppers, olives, basil and mozzarella.', 'Products/image40.jpg', 11.5, 0, { featured: true }],
        ['Mini Margherita Bites', 'Crispy mini pizzas with tomato sauce and melted mozzarella.', 'Products/image36.jpg', 6.5, 0],
        ['Creamy Chicken Pasta', 'Ribbon pasta in a creamy mushroom and chicken sauce.', 'Products/image33.jpeg', 10.25, 0, { newRelease: true }],
        ['Spaghetti Pomodoro', 'Spaghetti tossed in slow-cooked tomato and basil sauce.', 'Products/Noddle.png', 8.5, 0]
    ]],
    ['Desserts', 'Cakes, brownies and sweet treats', 'Catagories/desert.png', [
        ['Chocolate Fudge Cake', 'Rich layered chocolate cake with glossy fudge frosting.', 'Products/image42.jpg', 5.5, 0, { featured: true }],
        ['Fudgy Brownies', 'Dense chocolate brownies, dusted with cocoa.', 'Products/image43.jpg', 4.25, 0, { newRelease: true }],
        ['Orange Blossom Pancake', 'Sweet pancake with orange slices and berry compote.', 'Products/sweet.png', 5.75, 0]
    ]],
    ['Drinks', 'Coffee, mochas and chilled drinks', 'Catagories/chochlate.png', [
        ['Iced Mocha', 'Espresso, chocolate and cold milk over ice, topped with cream.', 'Products/image45.jpg', 4.5, 0, { featured: true, newRelease: true }]
    ]]
];

const STOCK = [24, 18, 30, 12, 40, 16, 22, 35];

(async () => {
    await mongoose.connect(process.env.DB_URI);
    let cats = 0, prods = 0, i = 0;
    for (const [title, description, icon, items] of MENU) {
        let cat = await Category.findOne({ title: new RegExp(`^${title}$`, 'i') });
        if (!cat) {
            cat = await Category.create({ title, description, image: publish(icon, 'category') });
            cats++;
        }
        for (const [ptitle, pdesc, img, price, discount, flags = {}] of items) {
            i++;
            if (await Product.exists({ title: new RegExp(`^${ptitle}$`, 'i') })) continue;
            const p = await Product.create({ title: ptitle, description: pdesc, image: publish(img, 'product'), price, discount, category: cat._id, featured: !!flags.featured, newRelease: !!flags.newRelease, isActive: true });
            const inv = await Inventory.create({ productId: p._id, quantityInStock: STOCK[i % STOCK.length], restockDate: new Date() });
            p.inventory = inv._id;
            await p.save();
            prods++;
        }
    }
    // QA products from automated test runs: hide from the shop (kept for their orders)
    const hidden = await Product.updateMany({ title: /^(qa|qae2e)/i, isActive: { $ne: false } }, { $set: { isActive: false } });
    console.log(`categories added: ${cats}, products added: ${prods}, QA products hidden: ${hidden.modifiedCount}`);
    await mongoose.disconnect();
})().catch(async (e) => {
    console.error(e);
    await mongoose.disconnect();
    process.exit(1);
});

