import { memo, useMemo } from 'react';

import useMediaQuery from '@mui/material/useMediaQuery';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

// third party
import PerfectScrollbar from 'react-perfect-scrollbar';

// project imports
import MenuList from '../MenuList';
import LogoSection from '../LogoSection';
import MiniDrawerStyled from './MiniDrawerStyled';

import useConfig from 'hooks/useConfig';
import { drawerWidth, headerHeight, sidebarBg } from 'store/constant';

import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';

// assets
import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from '@tabler/icons-react';

// ==============================|| SIDEBAR DRAWER ||============================== //

function Sidebar() {
  const downMD = useMediaQuery((theme) => theme.breakpoints.down('md'));

  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster.isDashboardDrawerOpened;

  const { miniDrawer, mode } = useConfig();

  // Brand row: wordmark + collapse button when open, logo mark only when collapsed (whole mark expands)
  const toggle = (
    <Tooltip title={drawerOpen ? 'Collapse sidebar' : 'Expand sidebar'} placement="right">
      <ButtonBase
        aria-label="Toggle sidebar"
        onClick={() => handlerDrawerOpen(!drawerOpen)}
        sx={{
          width: 34,
          height: 34,
          borderRadius: '9px',
          color: '#55534E',
          border: '1px solid #E6E4DE',
          bgcolor: '#FFFFFF',
          flexShrink: 0,
          transition: 'background-color .15s, color .15s',
          '&:hover': { bgcolor: '#FDF1CC', color: '#2B2112', borderColor: '#F3DE9C' }
        }}
      >
        {drawerOpen ? <IconLayoutSidebarLeftCollapse size={18} stroke={1.7} /> : <IconLayoutSidebarLeftExpand size={18} stroke={1.7} />}
      </ButtonBase>
    </Tooltip>
  );

  const brand = (
    <Stack
      direction={drawerOpen ? 'row' : 'column'}
      spacing={drawerOpen ? 0 : 1}
      sx={{
        height: drawerOpen ? headerHeight : 'auto',
        minHeight: headerHeight,
        boxSizing: 'border-box',
        alignItems: 'center',
        justifyContent: drawerOpen ? 'space-between' : 'center',
        px: drawerOpen ? 2 : 0,
        py: drawerOpen ? 0 : 1.5,
        borderBottom: '1px solid #ECEBE6'
      }}
    >
      <LogoSection mark={!drawerOpen} height={drawerOpen ? 66 : 36} />
      {!downMD && toggle}
    </Stack>
  );

  const drawer = useMemo(() => {
    const drawerContent = (
      <Typography sx={{ textAlign: 'center', fontSize: '0.6875rem', color: '#A3A19A', py: 2 }}>v{import.meta.env.VITE_APP_VERSION}</Typography>
    );

    const drawerSX = drawerOpen ? { paddingLeft: '12px', paddingRight: '12px', paddingTop: '12px' } : { paddingLeft: '0px', paddingRight: '0px', paddingTop: '12px' };

    return (
      <>
        {downMD ? (
          <Box sx={drawerSX}>
            <MenuList />
            {drawerOpen && drawerContent}
          </Box>
        ) : (
          <PerfectScrollbar style={{ height: `calc(100vh - ${drawerOpen ? headerHeight : headerHeight + 50}px)`, ...drawerSX }}>
            <MenuList />
            {drawerOpen && drawerContent}
          </PerfectScrollbar>
        )}
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downMD, drawerOpen, mode]);

  return (
    <Box component="nav" sx={{ flexShrink: { md: 0 }, width: { xs: 'auto', md: drawerWidth } }} aria-label="Main navigation">
      {downMD || (miniDrawer && drawerOpen) ? (
        <Drawer
          variant={downMD ? 'temporary' : 'persistent'}
          anchor="left"
          open={drawerOpen}
          onClose={() => handlerDrawerOpen(!drawerOpen)}
          sx={{
            '& .MuiDrawer-paper': {
              zIndex: 1201,
              width: drawerWidth,
              bgcolor: sidebarBg,
              color: 'text.primary',
              borderRight: '1px solid #ECEBE6'
            }
          }}
          ModalProps={{ keepMounted: true }}
          color="inherit"
        >
          {brand}
          {drawer}
        </Drawer>
      ) : (
        <MiniDrawerStyled variant="permanent" open={drawerOpen}>
          {brand}
          {drawer}
        </MiniDrawerStyled>
      )}
    </Box>
  );
}

export default memo(Sidebar);
