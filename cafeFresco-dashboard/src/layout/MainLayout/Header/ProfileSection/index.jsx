import { useEffect, useRef, useState, useContext } from 'react';
import { useNavigate } from 'react-router';

// material-ui
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { playTone, setSoundEnabled, soundEnabled } from '../../../../utils/sound';

// project imports
import Transitions from 'ui-component/extended/Transitions';
import { MainContext } from '../../../../views/context';
import { homeFor } from '../../../../config/permissions';
import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';

// assets
import { IconExternalLink, IconHome, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand, IconLogout, IconSettings, IconVolume, IconVolumeOff } from '@tabler/icons-react';

const SHOP_URL = import.meta.env.VITE_SHOP_URL || 'http://localhost:3001';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || 'A';

const ROLE_TONE = {
  admin: { bg: '#FDF1CC', color: '#8A5A00' },
  manager: { bg: '#E7F0FD', color: '#1E5BB8' },
  editor: { bg: '#EAF6EE', color: '#2E7D4F' }
};

// ==============================|| SETTINGS MENU ||============================== //

export default function ProfileSection() {
  const theme = useTheme();
  const downMD = useMediaQuery(theme.breakpoints.down('md'));
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [sound, setSound] = useState(soundEnabled);
  const { adminName, adminEmail, adminRole, logout } = useContext(MainContext);
  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster?.isDashboardDrawerOpened;
  const navigate = useNavigate();
  const anchorRef = useRef(null);

  const handleClose = (event) => {
    if (anchorRef.current && anchorRef.current.contains(event?.target)) return;
    setOpen(false);
  };

  // Return focus to the button when the menu closes
  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current && !open) anchorRef.current?.focus();
    prevOpen.current = open;
  }, [open]);

  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setOpen(false);
      navigate('/admin/login', { replace: true });
    }
  };

  const tone = ROLE_TONE[adminRole] || { bg: '#F1F0EC', color: '#55534E' };
  const item = { borderRadius: '10px', py: 1, px: 1.25, fontSize: '0.8125rem', fontWeight: 500, color: '#2A2A2A', minHeight: 0, '& .MuiListItemIcon-root': { minWidth: 30, color: '#6B6963' }, '&:hover, &.Mui-focusVisible': { bgcolor: '#FFF6DE' } };

  return (
    <>
      <IconButton
        ref={anchorRef}
        onClick={() => setOpen((o) => !o)}
        aria-label="Settings"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? 'settings-menu' : undefined}
        sx={{
          ml: 1,
          width: 38,
          height: 38,
          borderRadius: '10px',
          color: '#222',
          bgcolor: open ? '#EFEFEC' : 'transparent',
          '&:hover': { bgcolor: '#EFEFEC' },
          '& svg': { transition: 'transform .3s' },
          ...(open && { '& svg': { transform: 'rotate(45deg)', transition: 'transform .3s' } })
        }}
      >
        <IconSettings stroke={1.6} size={22} />
      </IconButton>
      <Popper
        placement="bottom-end"
        open={open}
        anchorEl={anchorRef.current}
        role={undefined}
        transition
        disablePortal
        sx={{ zIndex: 1300 }}
        modifiers={[{ name: 'offset', options: { offset: [0, 12] } }]}
      >
        {({ TransitionProps }) => (
          <ClickAwayListener onClickAway={handleClose}>
            <Transitions position="top-right" in={open} {...TransitionProps}>
              <Paper sx={{ width: 272, borderRadius: '16px', overflow: 'hidden', boxShadow: '0 16px 48px rgba(17,17,17,0.14)', border: '1px solid #EEEDE9' }}>
                {/* account card */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, background: 'linear-gradient(135deg, #FFF8E6 0%, #FFFFFF 70%)', borderBottom: '1px solid #F0EFEB' }}>
                  <Avatar sx={{ width: 42, height: 42, bgcolor: '#F5B400', color: '#1A1A1A', fontSize: '0.9375rem', fontWeight: 700 }}>{initials(adminName)}</Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontSize: '0.6875rem', color: '#8A877F' }}>{greeting()}</Typography>
                    <Typography noWrap sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#111' }} title={adminName}>
                      {adminName || 'Admin'}
                    </Typography>
                    {adminEmail && (
                      <Typography noWrap sx={{ fontSize: '0.75rem', color: '#6B6B6B' }} title={adminEmail}>
                        {adminEmail}
                      </Typography>
                    )}
                    {adminRole && (
                      <Box component="span" sx={{ display: 'inline-block', mt: 0.75, px: 1, py: 0.25, borderRadius: '999px', fontSize: '0.6875rem', fontWeight: 700, textTransform: 'capitalize', bgcolor: tone.bg, color: tone.color }}>
                        {adminRole}
                      </Box>
                    )}
                  </Box>
                </Box>

                <MenuList
                  id="settings-menu"
                  autoFocusItem={open}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' || e.key === 'Tab') {
                      e.preventDefault();
                      setOpen(false);
                    }
                  }}
                  sx={{ p: 1 }}
                >
                  <MenuItem sx={item} onClick={() => go(homeFor(adminRole))}>
                    <ListItemIcon>
                      <IconHome size={18} stroke={1.7} />
                    </ListItemIcon>
                    My home
                  </MenuItem>
                  {!downMD && (
                    <MenuItem
                      sx={item}
                      onClick={() => {
                        handlerDrawerOpen(!drawerOpen);
                        setOpen(false);
                      }}
                    >
                      <ListItemIcon>{drawerOpen ? <IconLayoutSidebarLeftCollapse size={18} stroke={1.7} /> : <IconLayoutSidebarLeftExpand size={18} stroke={1.7} />}</ListItemIcon>
                      {drawerOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                    </MenuItem>
                  )}
                  <MenuItem sx={item} component="a" href={SHOP_URL} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
                    <ListItemIcon>
                      <IconExternalLink size={18} stroke={1.7} />
                    </ListItemIcon>
                    Visit shop
                  </MenuItem>
                  <MenuItem
                    sx={item}
                    role="menuitemcheckbox"
                    aria-checked={sound}
                    onClick={() => {
                      setSoundEnabled(!sound);
                      setSound(!sound);
                      if (!sound) playTone('success');
                    }}
                  >
                    <ListItemIcon>{sound ? <IconVolume size={18} stroke={1.7} /> : <IconVolumeOff size={18} stroke={1.7} />}</ListItemIcon>
                    <Box sx={{ flex: 1 }}>Notification sound</Box>
                    <Switch size="small" checked={sound} tabIndex={-1} sx={{ mr: -1 }} inputProps={{ 'aria-hidden': true }} />
                  </MenuItem>
                  <Box sx={{ height: '1px', bgcolor: '#F0EFEB', my: 0.75, mx: 0.5 }} />
                  <MenuItem
                    sx={{ ...item, color: '#C62828', '& .MuiListItemIcon-root': { minWidth: 30, color: '#C62828' }, '&:hover, &.Mui-focusVisible': { bgcolor: '#FDECEC' } }}
                    onClick={handleLogout}
                    disabled={loggingOut}
                  >
                    <ListItemIcon>
                      <IconLogout size={18} stroke={1.7} />
                    </ListItemIcon>
                    {loggingOut ? 'Logging out…' : 'Log out'}
                  </MenuItem>
                </MenuList>
              </Paper>
            </Transitions>
          </ClickAwayListener>
        )}
      </Popper>
    </>
  );
}
