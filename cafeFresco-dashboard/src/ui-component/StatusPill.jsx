import PropTypes from 'prop-types';
import Box from '@mui/material/Box';

// Soft status pill with a coloured dot: one colour per meaning across all tables
const TONES = {
    success: { bg: '#E8F6EE', fg: '#1E7A45', dot: '#2E9A57' },
    warning: { bg: '#FFF4D6', fg: '#8A5A00', dot: '#E3A100' },
    danger: { bg: '#FDECEC', fg: '#B42318', dot: '#E5484D' },
    neutral: { bg: '#F1F0EC', fg: '#55534E', dot: '#A3A09A' }
};
const STATUS_TONE = {
    completed: 'success',
    paid: 'success',
    active: 'success',
    pending: 'warning',
    cancelled: 'danger',
    unpaid: 'danger',
    inactive: 'neutral'
};

export default function StatusPill({ status, label, tone }) {
    const key = String(status || '').toLowerCase();
    const t = TONES[tone || STATUS_TONE[key] || 'neutral'];
    const text = label ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : '—');
    return (
        <Box
            component="span"
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.25,
                py: 0.4,
                borderRadius: '999px',
                bgcolor: t.bg,
                color: t.fg,
                fontSize: '0.8125rem',
                fontWeight: 600,
                lineHeight: 1.4,
                whiteSpace: 'nowrap'
            }}
        >
            <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: t.dot }} />
            {text}
        </Box>
    );
}

StatusPill.propTypes = { status: PropTypes.string, label: PropTypes.node, tone: PropTypes.oneOf(['success', 'warning', 'danger', 'neutral']) };
