import PropTypes from 'prop-types';
import Box from '@mui/material/Box';

// Rounded square holding a card's icon (tinted background + matching icon colour)
export default function IconTile({ children, bg = '#FFF3D1', color = '#E3A100', size = 50 }) {
    return (
        <Box sx={{ width: size, height: size, borderRadius: '12px', bgcolor: bg, color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            {children}
        </Box>
    );
}

IconTile.propTypes = { children: PropTypes.node, bg: PropTypes.string, color: PropTypes.string, size: PropTypes.number };
