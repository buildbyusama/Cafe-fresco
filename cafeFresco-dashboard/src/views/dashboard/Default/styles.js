// Shared look for the dashboard home cards (matches the Cafe Fresco reference design)
import { cardRadius, cardShadow } from 'store/constant';

export const cardSx = {
    bgcolor: '#FFFFFF',
    borderRadius: `${cardRadius}px`,
    boxShadow: cardShadow,
    border: 'none',
    position: 'relative',
    overflow: 'hidden',
    height: '100%'
};

export const ink = '#111111';
export const muted = '#4A4A4A';
export const amberIconBox = { bgcolor: '#FFF3D1', color: '#E3A100' };
export const titleSx = { fontSize: '1.2rem', fontWeight: 700, color: ink, letterSpacing: '-0.01em', lineHeight: 1.25 };
export const bigValueSx = { fontSize: '2.125rem', fontWeight: 800, color: ink, lineHeight: 1, letterSpacing: '-0.02em' };
export const valueLabelSx = { fontSize: '1rem', fontWeight: 400, color: muted, mt: 0.75 };
