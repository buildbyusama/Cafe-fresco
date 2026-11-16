import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../../api/client';
import { useNotify } from '../../../../contexts/NotifyContext';
import { MainContext } from '../../../../views/context';

// material-ui
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// project imports
import Transitions from 'ui-component/extended/Transitions';
import NotificationList from './NotificationList';

// assets
import { IconBell, IconBellOff, IconChevronRight, IconRefresh } from '@tabler/icons-react';

const POLL_MS = 60000;

// ==============================|| NOTIFICATIONS DROPDOWN ||============================== //

export default function NotificationSection() {
  const theme = useTheme();
  const downMD = useMediaQuery(theme.breakpoints.down('md'));
  const notify = useNotify();
  const navigate = useNavigate();
  const { adminRole } = useContext(MainContext);

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [filter, setFilter] = useState('all'); // all | unread
  const [marking, setMarking] = useState(false);
  const anchorRef = useRef(null);

  // silent=true for background refreshes: keep the current list, never flash a loader or an error
  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) setStatus((s) => (s === 'ready' ? s : 'loading'));
    try {
      const data = await apiFetch('/admin/notify');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
      setStatus('ready');
    } catch {
      if (!silent) setStatus('error');
    }
  }, []);

  // Initial load + refresh every minute while the tab is visible (new orders show up without a reload)
  useEffect(() => {
    fetchNotifications(true);
    const tick = () => document.visibilityState === 'visible' && fetchNotifications(true);
    const id = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [fetchNotifications]);

  const handleToggle = () => {
    setOpen((prev) => {
      if (!prev) fetchNotifications();
      return !prev;
    });
  };

  const handleClose = (event) => {
    if (anchorRef.current && anchorRef.current.contains(event?.target)) return;
    setOpen(false);
  };

  // Return focus to the bell when the panel closes
  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current && !open) anchorRef.current?.focus();
    prevOpen.current = open;
  }, [open]);

  const markAllRead = async () => {
    if (!unreadCount || marking) return;
    setMarking(true);
    try {
      await apiFetch('/admin/mark-seen', { method: 'POST' });
      setUnreadCount(0);
      setNotifications((list) => list.map((n) => ({ ...n, unread: false })));
      notify.success('All notifications marked as read');
    } catch (error) {
      notify.error(error.message);
    } finally {
      setMarking(false);
    }
  };

  // Opening a notification marks it read and goes to the related page
  const openNotification = (n) => {
    if (n.unread) {
      setNotifications((list) => list.map((x) => (x._id === n._id ? { ...x, unread: false } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      apiFetch(`/admin/mark-seen/${n._id}`, { method: 'POST' })
        .then((data) => typeof data?.unreadCount === 'number' && setUnreadCount(data.unreadCount))
        .catch(() => fetchNotifications(true));
    }
    if (n.type === 'order') {
      setOpen(false);
      navigate(n.orderId ? `/admin/all-order?q=${n.orderId}` : '/admin/all-order');
    } else if (n.type === 'permission' && adminRole === 'admin') {
      setOpen(false);
      navigate('/admin/all-permission');
    }
  };

  const shown = filter === 'unread' ? notifications.filter((n) => n.unread) : notifications;

  const tab = (key, label) => (
    <ButtonBase
      onClick={() => setFilter(key)}
      aria-pressed={filter === key}
      sx={{
        px: 1.5,
        height: 26,
        borderRadius: '15px',
        fontFamily: 'inherit',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: filter === key ? '#1A1A1A' : '#6B6B6B',
        bgcolor: filter === key ? '#FDF1CC' : 'transparent',
        '&:hover': { bgcolor: filter === key ? '#FDF1CC' : '#F4F3EF' }
      }}
    >
      {label}
    </ButtonBase>
  );

  let body;
  if (status === 'loading' || status === 'idle') {
    body = (
      <Stack spacing={2} sx={{ p: 2.5 }} aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Stack key={i} direction="row" spacing={1.5}>
            <Skeleton variant="rounded" width={38} height={38} />
            <Box sx={{ flex: 1 }}>
              <Skeleton width="45%" />
              <Skeleton width="90%" />
            </Box>
          </Stack>
        ))}
      </Stack>
    );
  } else if (status === 'error') {
    body = (
      <Stack sx={{ alignItems: 'center', textAlign: 'center', p: 4 }} role="alert">
        <Typography sx={{ fontWeight: 600, color: '#111' }}>Couldn&apos;t load notifications</Typography>
        <Typography sx={{ fontSize: '0.875rem', color: '#6B6B6B', mt: 0.5 }}>Check your connection and try again.</Typography>
        <Button size="small" variant="outlined" color="inherit" startIcon={<IconRefresh size={16} />} onClick={() => fetchNotifications()} sx={{ mt: 2, borderColor: '#E3E2DD' }}>
          Try again
        </Button>
      </Stack>
    );
  } else if (shown.length === 0) {
    body = (
      <Stack sx={{ alignItems: 'center', textAlign: 'center', p: 4 }}>
        <Box sx={{ width: 52, height: 52, borderRadius: '50%', bgcolor: '#FFF3D1', color: '#E3A100', display: 'grid', placeItems: 'center', mb: 1.5 }}>
          <IconBellOff size={24} stroke={1.7} />
        </Box>
        <Typography sx={{ fontWeight: 700, color: '#111' }}>{filter === 'unread' ? "You're all caught up" : 'No notifications yet'}</Typography>
        <Typography sx={{ fontSize: '0.875rem', color: '#6B6B6B', mt: 0.5 }}>
          {filter === 'unread' ? 'No unread notifications.' : 'New orders and team changes will show up here.'}
        </Typography>
      </Stack>
    );
  } else {
    body = <NotificationList notifications={shown} onOpen={openNotification} />;
  }

  return (
    <>
      <Box sx={{ ml: 2 }}>
        <IconButton
          ref={anchorRef}
          onClick={handleToggle}
          aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={open ? 'notifications-panel' : undefined}
          sx={{ width: 42, height: 42, borderRadius: '10px', color: '#222', bgcolor: open ? '#EFEFEC' : 'transparent', '&:hover': { bgcolor: '#EFEFEC' } }}
        >
          <Badge
            variant="dot"
            invisible={unreadCount === 0}
            color="error"
            overlap="circular"
            sx={{ '& .MuiBadge-dot': { width: 9, height: 9, borderRadius: '50%', border: '2px solid #FAF9F6', top: 3, right: 4 } }}
          >
            <IconBell stroke={1.6} size="24px" />
          </Badge>
        </IconButton>
      </Box>
      <Popper
        placement={downMD ? 'bottom' : 'bottom-end'}
        open={open}
        anchorEl={anchorRef.current}
        role={undefined}
        transition
        disablePortal
        sx={{ zIndex: 1300 }}
        modifiers={[{ name: 'offset', options: { offset: [downMD ? 5 : 0, 12] } }]}
      >
        {({ TransitionProps }) => (
          <ClickAwayListener onClickAway={handleClose}>
            <Transitions position={downMD ? 'top' : 'top-right'} in={open} {...TransitionProps}>
              <Paper
                id="notifications-panel"
                role="dialog"
                aria-label="Notifications"
                onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
                sx={{ width: { xs: 'calc(100vw - 24px)', sm: 340 }, borderRadius: '16px', overflow: 'hidden', boxShadow: '0 16px 48px rgba(17,17,17,0.14)', border: '1px solid #EEEDE9' }}
              >
                <Box sx={{ px: 2, pt: 1.75, pb: 1.25, borderBottom: '1px solid #F0EFEB' }}>
                  <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#111' }}>Notifications</Typography>
                      {unreadCount > 0 && (
                        <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: '999px', bgcolor: '#F5B400', color: '#1A1A1A', fontSize: '0.75rem', fontWeight: 700 }}>
                          {unreadCount > 99 ? '99+' : unreadCount} new
                        </Box>
                      )}
                    </Stack>
                    <Button
                      size="small"
                      onClick={markAllRead}
                      disabled={!unreadCount || marking}
                      sx={{ color: '#8A5A00', fontWeight: 600, minHeight: 30, '&.Mui-disabled': { color: '#BDBAB2' } }}
                    >
                      {marking ? 'Marking…' : 'Mark all as read'}
                    </Button>
                  </Stack>
                  <Stack direction="row" spacing={0.75} sx={{ mt: 1.25 }}>
                    {tab('all', 'All')}
                    {tab('unread', `Unread${unreadCount ? ` (${unreadCount > 99 ? '99+' : unreadCount})` : ''}`)}
                  </Stack>
                </Box>

                <Box sx={{ maxHeight: { xs: 'calc(100vh - 230px)', sm: 360 }, overflowY: 'auto' }}>{body}</Box>

                <ButtonBase
                  onClick={() => {
                    setOpen(false);
                    navigate('/admin/all-order');
                  }}
                  sx={{ width: '100%', py: 1.25, gap: 0.5, fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: '#8A5A00', borderTop: '1px solid #F0EFEB', '&:hover': { bgcolor: '#FFF8E6' } }}
                >
                  View all orders <IconChevronRight size={16} />
                </ButtonBase>
              </Paper>
            </Transitions>
          </ClickAwayListener>
        )}
      </Popper>
    </>
  );
}
