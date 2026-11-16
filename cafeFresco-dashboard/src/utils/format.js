// Money display shared by every dashboard page (SHARED_DECISIONS D1: same formula and currency as the shop)
const CURRENCY = import.meta.env.VITE_CURRENCY || 'USD';
const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: CURRENCY });

export const formatMoney = (amount) => formatter.format(Number(amount) || 0);

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const unitPrice = (product) => round2((product?.price || 0) * (1 - (product?.discount || 0) / 100));
