import PropTypes from 'prop-types';

// material-ui
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// project imports
import MainCard from 'ui-component/cards/MainCard';
import TotalIncomeCard from 'ui-component/cards/Skeleton/TotalIncomeCard';
import IconTile from './IconTile';
import { cardSx, ink, muted } from './styles';

// Compact count card with a tinted background: success (green) or amber
const TONES = {
    success: { bg: 'linear-gradient(90deg, #EAF6EE 0%, #F6FBF7 100%)', tileBg: '#D9F0E1', tileColor: '#2E9A57' },
    amber: { bg: 'linear-gradient(90deg, #FFF3D9 0%, #FFFAEE 100%)', tileBg: '#FFE7AE', tileColor: '#E3A100' }
};

export default function StatusCard({ isLoading, total, label, icon, adornment, tone = 'amber' }) {
    if (isLoading) return <TotalIncomeCard />;
    const t = TONES[tone];
    return (
        <MainCard content={false} sx={{ ...cardSx, background: t.bg }}>
            <Stack direction="row" spacing={2.5} sx={{ alignItems: 'center', px: 2.5, py: 1.5 }}>
                <IconTile bg={t.tileBg} color={t.tileColor}>
                    {icon}
                </IconTile>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography component="p" sx={{ fontSize: '1.375rem', fontWeight: 800, color: ink, lineHeight: 1.15 }}>
                        {total ?? 0}
                    </Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: muted, mt: 0.25 }} noWrap>
                        {label}
                    </Typography>
                </Box>
                {adornment}
            </Stack>
        </MainCard>
    );
}

StatusCard.propTypes = {
    isLoading: PropTypes.bool,
    total: PropTypes.number,
    label: PropTypes.string,
    icon: PropTypes.node,
    adornment: PropTypes.node,
    tone: PropTypes.oneOf(['success', 'amber'])
};
