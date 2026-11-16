import PropTypes from 'prop-types';
import { formatMoney } from '../../../utils/format';

// material-ui
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// third party
import Chart from 'react-apexcharts';

// project imports
import chartData from './chart-data/bajaj-area-chart';

// ===========================|| DASHBOARD - TODAY'S SALES (pale amber panel) ||=========================== //

const options = {
  ...chartData.options,
  colors: ['#F5B400'],
  fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 100] } },
  stroke: { curve: 'smooth', width: 2 },
  tooltip: { ...chartData.options.tooltip, theme: 'light', y: { title: { formatter: () => 'Sales ' } } }
};

export default function BajajAreaChartCard({ totalAmount, series }) {
  return (
    <Box sx={{ bgcolor: '#FFF4D6', borderRadius: '14px', overflow: 'hidden' }}>
      <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between', px: 3, pt: 2.5 }}>
        <Box>
          <Typography sx={{ fontSize: '1.0625rem', fontWeight: 600, color: '#111' }}>Total Sale</Typography>
          <Typography sx={{ fontSize: '0.875rem', color: '#4A4A4A', mt: 0.5 }}>Daily Graph</Typography>
        </Box>
        <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#111', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(totalAmount)}</Typography>
      </Stack>
      {/* No sales yet → keep the panel clean instead of drawing a flat line at zero */}
      {(series || []).some((s) => (s.data || []).some((v) => Number(v) > 0)) ? (
        <Chart options={options} series={series} type={chartData.type} height={62} />
      ) : (
        <Box sx={{ height: 62 }} />
      )}
    </Box>
  );
}

BajajAreaChartCard.propTypes = { totalAmount: PropTypes.number, series: PropTypes.array };
