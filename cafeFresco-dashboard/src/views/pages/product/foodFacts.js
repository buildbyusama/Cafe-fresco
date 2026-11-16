// Tags, dietary info and allergens: form defaults, load from the API, and send as multipart fields
export const ALLERGENS = ['gluten', 'dairy', 'egg', 'nuts', 'peanut', 'soy', 'fish', 'shellfish', 'sesame'];

export const FOOD_EMPTY = { tags: [], vegetarian: 'unknown', vegan: 'unknown', spicyLevel: '', allergens: [], allergensVerified: false };

const tri = (v) => (v === true ? 'true' : v === false ? 'false' : 'unknown');

export const foodFromProduct = (p) => ({
    tags: p.tags || [],
    vegetarian: tri(p.dietary?.vegetarian),
    vegan: tri(p.dietary?.vegan),
    spicyLevel: p.dietary?.spicyLevel ?? '',
    allergens: p.allergens || [],
    allergensVerified: !!p.allergensVerified
});

const dietary = (d) => JSON.stringify({ vegetarian: d.vegetarian, vegan: d.vegan, spicyLevel: d.spicyLevel === '' ? null : Number(d.spicyLevel) });
const FOOD_KEYS = Object.keys(FOOD_EMPTY);

// Appends the food fields; with `original`, only what changed
export function appendFood(formData, data, original) {
    const changed = (k) => !original || JSON.stringify(data[k]) !== JSON.stringify(original[k]);
    if (changed('tags')) formData.append('tags', JSON.stringify(data.tags));
    if (changed('allergens')) formData.append('allergens', JSON.stringify(data.allergens));
    if (changed('allergensVerified')) formData.append('allergensVerified', String(data.allergensVerified));
    if (changed('vegetarian') || changed('vegan') || changed('spicyLevel')) formData.append('dietary', dietary(data));
}

export const isFoodKey = (k) => FOOD_KEYS.includes(k);
