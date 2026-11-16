import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../api/client';
import { formatMoney } from '../../../utils/format';

// material-ui
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// project imports
import BajajAreaChartCard from './BajajAreaChartCard';
import MainCard from 'ui-component/cards/MainCard';
import SkeletonPopularCard from 'ui-component/cards/Skeleton/PopularCard';
import StatusPill from 'ui-component/StatusPill';
import { cardSx, ink, titleSx } from './styles';

// assets
import { IconChevronRight, IconShoppingCart } from '@tabler/icons-react';

export default function PopularCard({ isLoading }) {
  const navigate = useNavigate();
  const [latestSale, setLatestSale] = useState({});
  const [failed, setFailed] = useState(false);

  // apiFetch: an expired session goes to login like every other request
  useEffect(() => {
    apiFetch('/api/daily-report')
      .then(setLatestSale)
      .catch(() => {
        setLatestSale({});
        setFailed(true);
      });
  }, []);

  if (isLoading) return <SkeletonPopularCard />;

  const orders = latestSale.latestOrders || [];

  return (
    <MainCard content={false} sx={{ ...cardSx, height: 'auto' }}>
      <Box sx={{ p: 2.5, pb: 1 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
          <IconShoppingCart size={22} stroke={1.8} color="#222" />
          <Typography component="h2" sx={titleSx}>
            Today&apos;s latest orders
          </Typography>
        </Stack>

        {/* revenue = completed AND paid today, same rule as every other revenue number */}
        <BajajAreaChartCard totalAmount={latestSale.totalAmount || 0} series={latestSale.series} />

        <Box sx={{ mt: 1 }}>
          {orders.length === 0 ? (
            <Typography sx={{ fontSize: '0.8125rem', color: '#8A877F', textAlign: 'center', py: 2.5 }}>
              {failed ? "Couldn't load today's orders" : 'No orders yet today'}
            </Typography>
          ) : (
            orders.map((order) => (
              <ButtonBase
                key={order._id}
                onClick={() => navigate(`/admin/all-order?q=${order._id}`)}
                aria-label={`Order from ${order.userId?.name ?? 'deleted customer'}, ${formatMoney(order.totalAmount)}, ${order.orderStatus}`}
                sx={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  py: 1.25,
                  px: 1,
                  borderRadius: '10px',
                  borderBottom: '1px solid #F0EFEB',
                  '&:hover': { bgcolor: '#FBFAF7' }
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: ink }} noWrap>
                    {order.userId?.name ?? 'Deleted customer'}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#8A877F', mt: 0.25 }} noWrap>
                    #{String(order._id).slice(-6).toUpperCase()} · {new Date(order.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </Typography>
                </Box>
                <Stack sx={{ alignItems: 'flex-end', ml: 2, gap: 0.5 }}>
                  {/* a cancelled order is not a sale: show its amount struck through */}
                  <Typography
                    sx={{
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      color: order.orderStatus === 'cancelled' ? '#A3A19A' : ink,
                      textDecoration: order.orderStatus === 'cancelled' ? 'line-through' : 'none',
                      whiteSpace: 'nowrap',
                      fontVariantNumeric: 'tabular-nums'
                    }}
                  >
                    {formatMoney(order.totalAmount)}
                  </Typography>
                  <StatusPill status={order.orderStatus} />
                </Stack>
              </ButtonBase>
            ))
          )}
        </Box>
      </Box>
      <Stack sx={{ alignItems: 'center', pb: 2, pt: 1 }}>
        <ButtonBase
          onClick={() => navigate('/admin/all-order')}
          sx={{ fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600, color: '#B07D00', gap: 0.5, px: 1.5, py: 0.75, borderRadius: '8px', '&:hover': { bgcolor: '#FFF6DE' } }}
        >
          View all orders <IconChevronRight size={16} stroke={2} />
        </ButtonBase>
      </Stack>
    </MainCard>
  );
}

PopularCard.propTypes = { isLoading: PropTypes.bool };
