import PropTypes from 'prop-types';
import React from 'react';

// material-ui
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// third party
import Chart from 'react-apexcharts';

// project imports
import MainCard from 'ui-component/cards/MainCard';
import SkeletonTotalOrderCard from 'ui-component/cards/Skeleton/EarningCard';
import { apiFetch } from '../../../api/client';
import IconTile from './IconTile';
import { bigValueSx, cardSx, valueLabelSx } from './styles';

// assets
import { IconShoppingBag } from '@tabler/icons-react';

const sparkline = {
    chart: { sparkline: { enabled: true }, dropShadow: { enabled: true, top: 6, left: 0, blur: 6, color: '#F5B400', opacity: 0.18 } },
    colors: ['#F5B400'],
    stroke: { curve: 'smooth', width: 3 },
    dataLabels: { enabled: false },
    yaxis: { labels: { show: false } },
    tooltip: { fixed: { enabled: false }, x: { show: false }, y: { title: { formatter: () => 'Orders' } }, marker: { show: false } }
};

// Month / Year pill toggle
function RangeToggle({ value, onChange }) {
    const item = (key, label) => {
        const active = value === key;
        return (
            <ButtonBase
                onClick={() => onChange(key)}
                aria-pressed={active}
                sx={{
                    px: 2,
                    height: 28,
                    borderRadius: '16px',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    fontFamily: 'inherit',
                    color: active ? '#FFFFFF' : '#333333',
                    bgcolor: active ? '#FFC21A' : 'transparent',
                    transition: 'background-color .2s, color .2s'
                }}
            >
                {label}
            </ButtonBase>
        );
    };
    return (
        <Stack direction="row" sx={{ p: '3px', border: '1px solid #ECEAE5', borderRadius: '20px', bgcolor: '#FFFFFF' }}>
            {item('month', 'Month')}
            {item('year', 'Year')}
        </Stack>
    );
}

RangeToggle.propTypes = { value: PropTypes.string, onChange: PropTypes.func };

export default function TotalOrderLineChartCard({ isLoading, monthlyOrder, yearlyOrder }) {
    const [range, setRange] = React.useState('year');
    const [trend, setTrend] = React.useState({ month: null, year: null });

    // Real order counts per day (month) / per month (year)
    React.useEffect(() => {
        if (trend[range]) return;
        apiFetch(`/api/order-trend?range=${range}`)
            .then((data) => setTrend((t) => ({ ...t, [range]: data.series })))
            .catch(() => setTrend((t) => ({ ...t, [range]: [{ name: 'Orders', data: [] }] })));
    }, [range]); // eslint-disable-line react-hooks/exhaustive-deps

    if (isLoading) return <SkeletonTotalOrderCard />;

    const series = trend[range] || [{ name: 'Orders', data: [] }];
    return (
        <MainCard content={false} sx={cardSx}>
            <Box sx={{ p: 2.5, pt: 2 }}>
                <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <IconTile>
                        <IconShoppingBag size={22} stroke={1.7} />
                    </IconTile>
                    <RangeToggle value={range} onChange={setRange} />
                </Stack>
                <Stack direction="row" sx={{ alignItems: 'flex-end', justifyContent: 'space-between', mt: 1.75 }}>
                    <Box>
                        <Typography component="p" sx={bigValueSx}>
                            {range === 'month' ? monthlyOrder ?? 0 : yearlyOrder ?? 0}
                        </Typography>
                        <Typography sx={valueLabelSx}>Total Order</Typography>
                    </Box>
                    <Box sx={{ width: '52%', mb: -1 }}>
                        <Chart key={range} type="line" height={56} options={sparkline} series={series} />
                    </Box>
                </Stack>
            </Box>
        </MainCard>
    );
}

TotalOrderLineChartCard.propTypes = { isLoading: PropTypes.bool, monthlyOrder: PropTypes.number, yearlyOrder: PropTypes.number };
