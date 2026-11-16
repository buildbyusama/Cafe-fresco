import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

// material-ui
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';

// project imports
import Footer from './Footer';
import Header from './Header';
import Sidebar from './Sidebar';
import MainContentStyled from './MainContentStyled';
import Loader from 'ui-component/Loader';
import Breadcrumbs from 'ui-component/extended/Breadcrumbs';

import useConfig from 'hooks/useConfig';
import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';
import { canvasBg, drawerWidth, headerHeight } from 'store/constant';

// Soft amber shapes in the canvas corners (decorative only)
function CanvasDecor() {
  return (
    <Box aria-hidden sx={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <Box
        component="svg"
        viewBox="0 0 500 160"
        preserveAspectRatio="none"
        sx={{ position: 'absolute', top: 0, right: { xs: -220, md: 300 }, width: 460, height: 130, opacity: 0.7 }}
      >
        <defs>
          <linearGradient id="cf-blob-top" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#FFF6DF" />
            <stop offset="100%" stopColor="#FFE9B0" />
          </linearGradient>
        </defs>
        {/* soft diagonal swoosh entering from the top edge */}
        <path d="M60 160 C150 120 250 60 330 0 H500 C430 70 330 130 200 160 Z" fill="url(#cf-blob-top)" />
      </Box>
      <Box
        component="svg"
        viewBox="0 0 400 300"
        preserveAspectRatio="none"
        sx={{ position: 'absolute', bottom: -40, right: -40, width: 420, height: 260, opacity: 0.6 }}
      >
        <defs>
          <linearGradient id="cf-blob-bottom" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#FFF4D6" />
            <stop offset="100%" stopColor="#FFE3A0" />
          </linearGradient>
        </defs>
        <path d="M400 0 V300 H0 C60 260 120 250 190 210 C260 170 300 90 400 0 Z" fill="url(#cf-blob-bottom)" />
      </Box>
    </Box>
  );
}

// ==============================|| MAIN LAYOUT ||============================== //

export default function MainLayout() {
  const theme = useTheme();
  const { pathname } = useLocation();
  const downMD = useMediaQuery(theme.breakpoints.down('md'));

  const { borderRadius, miniDrawer } = useConfig();
  const { menuMaster, menuMasterLoading } = useGetMenuMaster();
  const drawerOpen = menuMaster?.isDashboardDrawerOpened;

  useEffect(() => {
    handlerDrawerOpen(!miniDrawer);
  }, [miniDrawer]);

  useEffect(() => {
    downMD && handlerDrawerOpen(false);
  }, [downMD]);

  if (menuMasterLoading) return <Loader />;

  return (
    <Box sx={{ display: 'flex', bgcolor: canvasBg, minHeight: '100vh' }}>
      <CanvasDecor />

      {/* header: translucent canvas over the content only; the sidebar owns the logo & toggle */}
      <AppBar
        enableColorOnDark
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          background: 'rgba(250,249,246,0.82)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(0,0,0,0.04)',
          ...(!downMD && {
            left: drawerOpen ? drawerWidth : 72,
            width: `calc(100% - ${drawerOpen ? drawerWidth : 72}px)`,
            transition: theme.transitions.create(['left', 'width'], { duration: theme.transitions.duration.shorter + 200 })
          })
        }}
      >
        <Toolbar sx={{ px: { xs: 2, md: 3.5 }, py: 0, height: headerHeight, minHeight: `${headerHeight}px !important` }}>
          <Header />
        </Toolbar>
      </AppBar>

      {/* menu / drawer */}
      <Sidebar />

      {/* main content */}
      <MainContentStyled {...{ borderRadius, open: drawerOpen }}>
        <Box sx={{ minHeight: `calc(100vh - ${headerHeight + 40}px)`, display: 'flex', flexDirection: 'column' }}>
          <Breadcrumbs />
          {/* each page fades up in; keyed by path so it replays on navigation */}
          <Box
            key={pathname}
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              animation: 'cfPageIn .28s ease-out',
              '@keyframes cfPageIn': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' }
            }}
          >
            <Outlet />
          </Box>
          <Footer />
        </Box>
      </MainContentStyled>
    </Box>
  );
}
