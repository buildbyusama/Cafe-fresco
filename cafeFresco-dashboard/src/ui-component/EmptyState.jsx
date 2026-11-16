import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { IconInbox } from '@tabler/icons-react';

// Friendly empty list: amber icon circle, title and a one-line hint (optional action)
export default function EmptyState({ title = 'Nothing here yet', hint, icon: Icon = IconInbox, action }) {
    return (
        <Box
            role="status"
            sx={{
                textAlign: 'center',
                py: 6,
                px: 2,
                my: 2,
                width: '100%',
                bgcolor: '#FFFFFF',
                borderRadius: '16px',
                boxShadow: '0 4px 24px rgba(17,17,17,0.05)'
            }}
        >
            <Box sx={{ width: 56, height: 56, mx: 'auto', mb: 2, borderRadius: '50%', bgcolor: '#FFF3D1', color: '#E3A100', display: 'grid', placeItems: 'center' }}>
                <Icon size={28} stroke={1.7} />
            </Box>
            <Typography sx={{ fontSize: '1.0625rem', fontWeight: 700, color: '#111' }}>{title}</Typography>
            {hint && <Typography sx={{ fontSize: '0.9375rem', color: '#6B6B6B', mt: 0.5, maxWidth: 420, mx: 'auto' }}>{hint}</Typography>}
            {action && <Box sx={{ mt: 2.5 }}>{action}</Box>}
        </Box>
    );
}

EmptyState.propTypes = { title: PropTypes.node, hint: PropTypes.node, icon: PropTypes.elementType, action: PropTypes.node };
