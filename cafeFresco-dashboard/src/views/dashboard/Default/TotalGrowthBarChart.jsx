import PropTypes from 'prop-types';
import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../api/client';
import { formatMoney } from '../../../utils/format';

// material-ui
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

// third party
import ApexCharts from 'apexcharts';
import Chart from 'react-apexcharts';

// project imports
import SkeletonTotalGrowthBarChart from 'ui-component/cards/Skeleton/TotalGrowthBarChart';
import MainCard from 'ui-component/cards/MainCard';
import { cardSx, titleSx } from './styles';

// assets
import { IconArrowDownRight, IconArrowUpRight, IconDots } from '@tabler/icons-react';

// Year selector: this year and the two before it
const thisYear = new Date().getFullYear();
const thisMonth = new Date().getMonth();
const years = [thisYear, thisYear - 1, thisYear - 2];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EMPTY = { orders: new Array(12).fill(0), revenue: new Array(12).fill(0) };

// One measure at a time (revenue and order counts have different scales, so they never share an axis)
const METRICS = {
  revenue: { label: 'Revenue', format: (v) => formatMoney(v), short: (v) => (v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `$${Math.round(v)}`) },
  orders: { label: 'Orders', format: (v) => `${v} ${v === 1 ? 'order' : 'orders'}`, short: (v) => String(Math.round(v)) }
};

const AMBER = '#F5B400';
const AMBER_SOFT = '#FBE3A1';

const download = (href, name) => {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
};

const toSeries = (res) => ({
  orders: res?.find((s) => /order/i.test(s.name))?.data || EMPTY.orders,
  revenue: res?.find((s) => /revenue/i.test(s.name))?.data || EMPTY.revenue
});

const sum = (a) => a.reduce((t, v) => t + (Number(v) || 0), 0);

// Axis top = 4 equal "nice" steps (1, 2, 2.5, 5 × 10ⁿ, whole steps of at least 1) so tick labels never repeat
const niceMax = (max) => {
  const raw = Math.max(max, 1) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 2.5, 5, 10].map((n) => n * pow).find((s) => s >= raw));
  return Math.ceil(step) * 4;
};

export default function TotalGrowthBarChart({ isLoading }) {
  const [year, setYear] = useState(thisYear);
  const [metric, setMetric] = useState('revenue');
  const [data, setData] = useState({ cur: EMPTY, prev: EMPTY });
  const [menuAnchor, setMenuAnchor] = useState(null);

  // Selected year plus the year before it, for the "vs last year" comparison
  useEffect(() => {
    Promise.all([apiFetch(`/api/yearly-report?year=${year}`).catch(() => null), apiFetch(`/api/yearly-report?year=${year - 1}`).catch(() => null)]).then(
      ([cur, prev]) => setData({ cur: toSeries(cur), prev: toSeries(prev) })
    );
  }, [year]);

  const m = METRICS[metric];
  const values = data.cur[metric];
  const total = sum(values);
  const prevTotal = sum(data.prev[metric]);
  const change = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;
  // months that have happened so far in the selected year
  const monthsElapsed = year === thisYear ? thisMonth + 1 : 12;
  const average = total / monthsElapsed;
  const best = values.reduce((bi, v, i) => (v > values[bi] ? i : bi), 0);
  const focus = year === thisYear ? thisMonth : best;
  const yMax = niceMax(Math.max(...values.map((v) => Number(v) || 0)));

  const options = useMemo(
    () => ({
      chart: {
        id: 'bar-chart',
        toolbar: { show: false },
        zoom: { enabled: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 450 }
      },
      // the focus month (current month, or the best month of a past year) is solid; the rest recede
      colors: [({ dataPointIndex }) => (dataPointIndex === focus ? AMBER : AMBER_SOFT)],
      plotOptions: { bar: { columnWidth: '52%', borderRadius: 6, borderRadiusApplication: 'end' } },
      xaxis: {
        categories: MONTHS,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: { colors: MONTHS.map((_, i) => (i === focus ? '#111' : '#8A877F')), fontSize: '12px', fontWeight: 500 } },
        crosshairs: { fill: { color: '#FFF8E6' } },
        tooltip: { enabled: false }
      },
      yaxis: { min: 0, max: yMax, tickAmount: 4, labels: { style: { colors: '#8A877F', fontSize: '11px' }, formatter: m.short } },
      grid: { borderColor: '#F0EFEB', strokeDashArray: 4, xaxis: { lines: { show: false } }, padding: { left: 8, right: 8 } },
      annotations: average
        ? {
            yaxis: [
              {
                y: average,
                borderColor: '#B5B2AA',
                strokeDashArray: 5,
                label: {
                  text: `Avg ${metric === 'orders' ? average.toFixed(1) : m.short(average)}`,
                  position: 'left',
                  textAnchor: 'start',
                  offsetX: 4,
                  borderWidth: 0,
                  style: { background: '#F4F3EF', color: '#55534E', fontSize: '11px', fontWeight: 600, padding: { left: 6, right: 6, top: 2, bottom: 2 } }
                }
              }
            ]
          }
        : {},
      legend: { show: false },
      dataLabels: { enabled: false },
      states: { hover: { filter: { type: 'darken', value: 0.9 } }, active: { filter: { type: 'none' } } },
      tooltip: {
        theme: 'light',
        custom: ({ dataPointIndex, w }) => {
          const v = w.globals.series[0][dataPointIndex];
          return `<div style="padding:8px 12px;font-family:inherit"><div style="font-size:11px;color:#8A877F">${MONTHS[dataPointIndex]} ${year}</div><div style="font-size:14px;font-weight:700;color:#111">${m.format(v)}</div></div>`;
        }
      }
    }),
    [focus, average, metric, year, yMax] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const exportPng = () => {
    setMenuAnchor(null);
    ApexCharts.exec('bar-chart', 'dataURI').then(({ imgURI }) => download(imgURI, `${metric}-${year}.png`));
  };
  const exportCsv = () => {
    setMenuAnchor(null);
    const rows = [['Month', 'Completed orders', 'Revenue'], ...MONTHS.map((mo, i) => [mo, data.cur.orders[i] ?? 0, data.cur.revenue[i] ?? 0])];
    const csv = '﻿' + rows.map((r) => r.join(',')).join('\n');
    download(URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), `orders-revenue-${year}.csv`);
  };

  if (isLoading) return <SkeletonTotalGrowthBarChart />;

  const stat = (label, value, extra) => (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: '0.75rem', color: '#8A877F', fontWeight: 500 }}>{label}</Typography>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'baseline', mt: 0.25 }}>
        <Typography sx={{ fontSize: '1.125rem', fontWeight: 800, color: '#111', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }} noWrap>
          {value}
        </Typography>
        {extra}
      </Stack>
    </Box>
  );

  const up = change !== null && change >= 0;

  return (
    <MainCard content={false} sx={cardSx}>
      <Box sx={{ p: 2.5, pb: 0 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 1.5 }}>
          <Box>
            <Typography component="h2" sx={titleSx}>
              Sales overview
            </Typography>
            <Typography sx={{ fontSize: '0.8125rem', color: '#8A877F', mt: 0.25 }}>Completed orders by month</Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {/* segmented metric switch */}
            <Box role="group" aria-label="Metric" sx={{ display: 'flex', p: 0.5, borderRadius: '10px', bgcolor: '#F4F3EF' }}>
              {Object.entries(METRICS).map(([key, def]) => (
                <ButtonBase
                  key={key}
                  onClick={() => setMetric(key)}
                  aria-pressed={metric === key}
                  sx={{
                    px: 1.5,
                    height: 28,
                    borderRadius: '8px',
                    fontFamily: 'inherit',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: metric === key ? '#111' : '#7A776F',
                    bgcolor: metric === key ? '#FFF' : 'transparent',
                    boxShadow: metric === key ? '0 1px 3px rgba(17,17,17,0.08)' : 'none',
                    transition: 'all .15s'
                  }}
                >
                  {def.label}
                </ButtonBase>
              ))}
            </Box>
            <TextField
              select
              size="small"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              aria-label="Year"
              sx={{
                minWidth: 92,
                '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#FFF', fontSize: '0.8125rem', fontWeight: 600, height: 36 },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E6E5E1' }
              }}
            >
              {years.map((y) => (
                <MenuItem key={y} value={y}>
                  {y}
                </MenuItem>
              ))}
            </TextField>
            <IconButton aria-label="Chart options" aria-haspopup="menu" onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ color: '#333' }}>
              <IconDots size={20} />
            </IconButton>
            <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
              <MenuItem onClick={exportPng}>Download PNG</MenuItem>
              <MenuItem onClick={exportCsv}>Download CSV</MenuItem>
            </Menu>
          </Stack>
        </Stack>

        {/* summary row */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 2, mt: 2, p: 1.75, borderRadius: '12px', bgcolor: '#FBFAF7', border: '1px solid #F0EFEB' }}>
          {stat(
            `Total ${year}`,
            m.format(total),
            change !== null && (
              <Stack
                direction="row"
                sx={{ alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: up ? '#2E9A57' : '#D32F2F', whiteSpace: 'nowrap' }}
                aria-label={`${up ? 'Up' : 'Down'} ${Math.abs(change).toFixed(0)}% vs ${year - 1}`}
              >
                {up ? <IconArrowUpRight size={14} stroke={2.2} /> : <IconArrowDownRight size={14} stroke={2.2} />}
                {Math.abs(change).toFixed(0)}%
              </Stack>
            )
          )}
          {stat('Monthly average', m.format(Math.round(average * 100) / 100))}
          {stat('Best month', values[best] ? `${MONTHS[best]} · ${m.short(values[best])}` : '—')}
        </Box>
      </Box>
      <Box sx={{ px: 1, pb: 1, pt: 1, position: 'relative' }}>
        {!total && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 1, pointerEvents: 'none' }}>
            <Box sx={{ textAlign: 'center', px: 2.5, py: 1.5, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.9)', border: '1px solid #F0EFEB' }}>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#111' }}>No {m.label.toLowerCase()} in {year} yet</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#8A877F', mt: 0.25 }}>
                {metric === 'revenue' ? 'Revenue counts completed, paid orders.' : 'Completed orders will show up here.'}
              </Typography>
            </Box>
          </Box>
        )}
        <Chart options={options} series={[{ name: m.label, data: values }]} type="bar" height={280} />
      </Box>
    </MainCard>
  );
}

TotalGrowthBarChart.propTypes = { isLoading: PropTypes.bool };
