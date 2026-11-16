// Curate the imported demo dishes so the menu reads like one café (run after seedMealDb.js).
// Renames to clear café names, moves dishes to the right category, hides ones that don't fit (isActive=false).
// Idempotent: matches on the original or the new title.
require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/category');
const Product = require('../models/product');

// original title → [new title, category (or null = keep), description] | 'hide'
const CURATE = {
    // Breakfast
    'Antiguan Breakfast (Chop Up and ‘Saltfish’)': ['Island Breakfast Plate', null, 'Scrambled eggs, sautéed greens, plantain, avocado and toast — a hearty morning plate.'],
    'Bread omelette': ['Masala Bread Omelette', null, 'Fluffy spiced omelette folded around toasted bread, served with ketchup.'],
    'Breakfast Potatoes': ['Crispy Breakfast Potatoes', null, 'Golden pan-fried potatoes with peppers, onion and herbs.'],
    'Dutch poffertjes (mini pancakes)': ['Mini Pancake Bites', null, 'Little puffed pancakes with butter and powdered sugar.'],
    'English Breakfast': ['Full English Breakfast', null, 'Eggs, beef sausages, beans, mushrooms, grilled tomato and toast.'],
    // Burgers & Wraps
    '15-minute chicken & halloumi burgers': ['Chicken Halloumi Burger', null, 'Grilled chicken and golden halloumi with salad in a toasted bun.'],
    'Grilled Mac and Cheese Sandwich': ['Mac & Cheese Toastie', 'Burgers & Wraps', 'Creamy mac and cheese pressed in buttery grilled bread.'],
    'Ayam Percik': ['Spiced Grilled Chicken', 'Grills', 'Chargrilled chicken in a mild coconut-chilli glaze.'],
    'Belgian Waterzooi Chicken': 'hide',
    'Bengali Chicken Curry with Potatoes': 'hide',
    'Brown Stew Chicken': 'hide',
    // Desserts
    'Æbleskiver': ['Sugar Pancake Puffs', null, 'Round, fluffy pancake puffs dusted with sugar and served with jam.'],
    'Alfajores': ['Caramel Sandwich Cookies', null, 'Soft butter cookies sandwiched with caramel and dusted with sugar.'],
    'Anzac biscuits': ['Oat & Honey Cookies', null, 'Chewy oat cookies baked with golden syrup and coconut.'],
    'Apam balik': ['Peanut Pancake Fold', null, 'Crisp-edged pancake folded around crushed peanuts and sugar.'],
    'Apple & Blackberry Crumble': ['Apple & Berry Crumble', null, 'Warm apples and blackberries under a buttery crumble topping.'],
    'Apple cake': ['Spiced Apple Cake', null, 'Moist apple cake with cinnamon, served warm.'],
    // Drinks
    'Afterglow': ['Sunset Orange Cooler', null, 'Orange, pineapple and a splash of grenadine over ice.'],
    'Alice Cocktail': ['Strawberry Cream Cooler', null, 'Chilled strawberry and cream blend — sweet and silky.'],
    'Aloha Fruit punch': ['Tropical Fruit Punch', null, 'Pineapple, orange and passion fruit over crushed ice.'],
    'Apello': ['Fresh Orange Juice', null, 'Freshly squeezed orange juice, served chilled.'],
    'Apple Berry Smoothie': ['Apple Berry Smoothie', null, 'Apple, mixed berries and yoghurt blended smooth.'],
    'Apple Karate': 'hide',
    'Banana Cantaloupe Smoothie': ['Banana Melon Smoothie', null, 'Banana and sweet melon blended with milk and honey.'],
    // Grills
    'Algerian Kefta (Meatballs)': ['Spiced Kofta Meatballs', null, 'Grilled beef kofta in a rich tomato and pepper sauce.'],
    'Asado': ['Chargrilled Beef Platter', null, 'Slow-grilled beef cuts with chimichurri and grilled vegetables.'],
    'Adana kebab': ['Seekh Kebab Platter', null, 'Spiced minced lamb skewers with salad, chillies and lemon.'],
    'Chilli ginger lamb chops': ['Chilli Ginger Lamb Chops', null, 'Lamb chops marinated in chilli, ginger and garlic, flame-grilled.'],
    'Arepa Pabellón': 'hide',
    'Arepa pelua': 'hide',
    'Chorba Hamra bel Frik (Algerian Lamb, Tomato, and Freekeh Soup)': 'hide',
    // Healthy Bowls
    'Air fryer patatas bravas': ['Spicy Roasted Potatoes', null, 'Crispy roasted potatoes with a smoky tomato sauce.'],
    'Algerian Flafla (Bell Pepper Salad)': ['Roasted Pepper Salad', null, 'Charred red and green peppers with garlic, olive oil and herbs.'],
    'Aubergine & hummus grills': ['Aubergine & Hummus Plate', null, 'Grilled aubergine on creamy hummus with herbs and pomegranate.'],
    'Aubergine couscous salad': ['Aubergine Couscous Salad', null, 'Fluffy couscous with roasted aubergine, herbs and lemon.'],
    'Fasoliyyeh Bi Z-Zayt (Syrian Green Beans with Olive Oil)': ['Garlic Green Beans', null, 'Tender green beans with tomato, garlic and olive oil.'],
    'Padron peppers': ['Blistered Green Peppers', null, 'Pan-blistered green peppers with sea salt.'],
    // Pizza & Pasta
    'Chilli prawn linguine': ['Chilli Prawn Linguine', null, 'Linguine with king prawns, chilli, garlic and cherry tomatoes.'],
    'Fettuccine Alfredo': ['Fettuccine Alfredo', null, 'Ribbon pasta in a rich, creamy parmesan sauce.'],
    'Fettucine alfredo': 'hide', // duplicate
    'Lasagna Sandwiches': 'hide',
    // Seafood
    'Acaraje black-eyed pea fritters with shrimp filling': 'hide',
    'Amok Trey – Cambodian Fish Curry': ['Coconut Fish Curry', null, 'Fish fillet simmered in a fragrant coconut curry.'],
    'Arroz con gambas y calamar': ['Prawn & Calamari Rice', null, 'Saffron rice with prawns, calamari and peppers.'],
    'Bahia-style Moqueca prawn stew': ['Coconut Prawn Stew', null, 'Prawns in a coconut, tomato and pepper stew.'],
    'Baked salmon with fennel & tomatoes': ['Baked Salmon & Tomatoes', null, 'Oven-baked salmon with fennel, tomatoes and herbs.'],
    'Balchi di Pisca': ['Spicy Goan Fish', null, 'Fish in a tangy, spicy Goan-style masala.']
};

(async () => {
    await mongoose.connect(process.env.DB_URI);
    const cats = new Map((await Category.find().lean()).map((c) => [c.title.toLowerCase(), c._id]));
    let renamed = 0, hidden = 0, moved = 0, missing = 0;
    for (const [orig, rule] of Object.entries(CURATE)) {
        const names = rule === 'hide' ? [orig] : [orig, rule[0]];
        const p = await Product.findOne({ title: { $in: names } });
        if (!p) { missing++; continue; }
        if (rule === 'hide') {
            if (p.isActive !== false) { p.isActive = false; await p.save(); hidden++; }
            continue;
        }
        const [title, category, description] = rule;
        if (p.title !== title || p.description !== description) { p.title = title; p.description = description; renamed++; }
        if (category) {
            const id = cats.get(category.toLowerCase());
            if (id && String(p.category) !== String(id)) { p.category = id; moved++; }
        }
        await p.save();
    }
    console.log(`renamed ${renamed}, moved ${moved}, hidden ${hidden}, not found ${missing}`);
    await mongoose.disconnect();
})().catch(async (e) => { console.error(e); await mongoose.disconnect(); process.exit(1); });
