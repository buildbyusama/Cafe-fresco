import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import Grid from '@mui/material/Grid2';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';

// project imports
import EarningCard from './EarningCard';
import PopularCard from './PopularCard';
import TotalOrderLineChartCard from './TotalOrderLineChartCard';
import StatusCard from './StatusCard';
import TotalGrowthBarChart from './TotalGrowthBarChart';
import { apiFetch } from '../../../api/client';

// assets
import { IconBuildingStore, IconCheck, IconClock, IconTable } from '@tabler/icons-react';

const SPACING = 2;

// ==============================|| DEFAULT DASHBOARD ||============================== //

export default function Dashboard() {
  const navigate = useNavigate();
  const [isLoading, setLoading] = useState(true);
  const [DashboardApi, setDashboardApi] = useState({});

  // Real loading state: skeletons until the numbers arrive; 401 is handled by the API client
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    setLoading(true);
    setError('');
    apiFetch('/api/dashboard')
      .then(setDashboardApi)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [reloadKey]);

  return (
    <Box>
      <Box sx={{ px: 2.5, mb: 2.5 }}>
        <Typography component="h1" sx={{ fontSize: '1.625rem', fontWeight: 800, color: '#111', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          Welcome Back!{' '}
          <Box component="span" role="img" aria-label="waving hand">
            👋
          </Box>
        </Typography>
        <Typography sx={{ fontSize: '0.9375rem', color: '#4A4A4A', mt: 0.5 }}>Here&apos;s what&apos;s happening at Cafe Fresco today.</Typography>
      </Box>

      {/* cancelled orders that were already paid: money to give back, easy to miss otherwise */}
      {!error && DashboardApi.refundDue > 0 && (
        <Alert
          severity="warning"
          sx={{ mb: 2, borderRadius: '12px' }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/admin/all-order?status=cancelled&paymentStatus=paid')}>
              Review
            </Button>
          }
        >
          {DashboardApi.refundDue} cancelled {DashboardApi.refundDue === 1 ? 'order was' : 'orders were'} already paid — refund due.
        </Alert>
      )}

      {error ? (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>}>
          {error}
        </Alert>
      ) : (
        <Grid container spacing={SPACING}>
          <Grid size={{ lg: 4, md: 6, sm: 6, xs: 12 }}>
            <EarningCard isLoading={isLoading} totalEarning={DashboardApi.totalEarnings} />
          </Grid>
          <Grid size={{ lg: 4, md: 6, sm: 6, xs: 12 }}>
            <TotalOrderLineChartCard isLoading={isLoading} monthlyOrder={DashboardApi.totalOrdersThisMonth} yearlyOrder={DashboardApi.totalOrdersThisYear} />
          </Grid>
          <Grid size={{ lg: 4, md: 12, sm: 12, xs: 12 }}>
            <Grid container spacing={2} sx={{ height: '100%' }}>
              <Grid size={{ sm: 6, xs: 12, md: 6, lg: 12 }} sx={{ height: { lg: 'calc(50% - 8px)' } }}>
                <StatusCard
                  tone="success"
                  isLoading={isLoading}
                  total={DashboardApi.totalCompletedOrders}
                  label="Total Completed Order"
                  icon={<IconTable size={22} stroke={1.7} />}
                  adornment={
                    <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: '#D4EFDD', color: '#2E9A57', display: 'grid', placeItems: 'center' }}>
                      <IconCheck size={16} stroke={2.2} />
                    </Box>
                  }
                />
              </Grid>
              <Grid size={{ sm: 6, xs: 12, md: 6, lg: 12 }} sx={{ height: { lg: 'calc(50% - 8px)' } }}>
                <StatusCard
                  tone="amber"
                  isLoading={isLoading}
                  total={DashboardApi.totalPendingOrders}
                  label="Total Pending Order"
                  icon={<IconBuildingStore size={22} stroke={1.7} />}
                  adornment={<IconClock size={28} stroke={1.6} color="#F5B400" />}
                />
              </Grid>
            </Grid>
          </Grid>

          <Grid size={{ xs: 12, md: 8 }} sx={{ mt: 0.5 }}>
            <TotalGrowthBarChart isLoading={isLoading} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }} sx={{ mt: 0.5 }}>
            <PopularCard isLoading={isLoading} />
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
