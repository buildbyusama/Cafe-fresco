// Same formula and currency as the backend (utils/price.js) and the dashboard (src/utils/format.js) — SHARED D1
const CURRENCY = import.meta.env.VITE_CURRENCY || 'USD';
const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: CURRENCY });

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// unitPrice = round2(price × (1 − discount/100))
export const unitPrice = (product) => round2((Number(product?.price) || 0) * (1 - (Number(product?.discount) || 0) / 100));

export const formatMoney = (amount) => formatter.format(Number(amount) || 0);
