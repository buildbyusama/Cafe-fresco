// material-ui
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';

// project imports
import LogoSection from '../LogoSection';
import ProfileSection from './ProfileSection';
import NotificationSection from './NotificationSection';

import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';
import { MainContext } from '../../../views/context';

// assets
import { IconMenu2 } from '@tabler/icons-react';
import { useContext } from 'react';

// ==============================|| MAIN NAVBAR / HEADER ||============================== //

export default function Header() {
  const theme = useTheme();
  const downMD = useMediaQuery(theme.breakpoints.down('md'));

  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster.isDashboardDrawerOpened;
  const { adminRole } = useContext(MainContext);

  return (
    <>
      {/* on desktop the sidebar holds the logo & toggle; on mobile the drawer is hidden, so show them here */}
      {downMD && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ButtonBase
            aria-label="Toggle sidebar"
            onClick={() => handlerDrawerOpen(!drawerOpen)}
            sx={{ width: 38, height: 38, borderRadius: '10px', bgcolor: '#EFEFEC', color: '#222', '&:hover': { bgcolor: '#E6E5E1' } }}
          >
            <IconMenu2 stroke={1.8} size="20px" />
          </ButtonBase>
          <LogoSection height={38} />
        </Box>
      )}

      <Box sx={{ flexGrow: 1 }} />

      {/* notification */}
      {['admin', 'manager'].includes(adminRole) && <NotificationSection />}

      {/* profile */}
      <ProfileSection />
    </>
  );
}
