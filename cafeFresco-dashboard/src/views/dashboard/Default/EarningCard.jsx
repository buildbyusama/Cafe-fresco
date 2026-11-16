import PropTypes from 'prop-types';

// material-ui
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

// project imports
import MainCard from 'ui-component/cards/MainCard';
import SkeletonEarningCard from 'ui-component/cards/Skeleton/EarningCard';
import { formatMoney } from '../../../utils/format';
import IconTile from './IconTile';
import { bigValueSx, cardSx, valueLabelSx } from './styles';

// assets
import { IconWallet } from '@tabler/icons-react';

// Soft amber wave in the bottom-right corner (decorative)
function Wave() {
    return (
        <Box
            component="svg"
            aria-hidden
            viewBox="0 0 300 160"
            preserveAspectRatio="none"
            sx={{ position: 'absolute', right: 0, bottom: 0, width: '55%', height: '75%', pointerEvents: 'none' }}
        >
            <defs>
                <linearGradient id="cf-earning-wave" x1="0" y1="1" x2="1" y2="0">
                    <stop offset="0%" stopColor="#FFF1CC" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#FAD47A" stopOpacity="0.95" />
                </linearGradient>
            </defs>
            <path d="M0 160 C70 150 120 120 165 80 C205 45 235 10 300 0 V160 Z" fill="url(#cf-earning-wave)" />
        </Box>
    );
}

export default function EarningCard({ isLoading, totalEarning }) {
    if (isLoading) return <SkeletonEarningCard />;
    return (
        <MainCard content={false} sx={cardSx}>
            <Wave />
            <Box sx={{ p: 2.5, pt: 2, position: 'relative', zIndex: 1 }}>
                <IconTile>
                    <IconWallet size={22} stroke={1.7} />
                </IconTile>
                <Typography component="p" sx={{ ...bigValueSx, mt: 1.75 }}>
                    {formatMoney(totalEarning)}
                </Typography>
                <Typography sx={valueLabelSx}>Total Earning</Typography>
            </Box>
        </MainCard>
    );
}

EarningCard.propTypes = { isLoading: PropTypes.bool, totalEarning: PropTypes.number };
