// material-ui
import { styled } from '@mui/material/styles';

// project imports
import { drawerWidth, headerHeight } from 'store/constant';

// ==============================|| MAIN LAYOUT - STYLED ||============================== //
// Content sits directly on the warm canvas (no grey panel); cards carry their own surfaces.

const MainContentStyled = styled('main', {
  shouldForwardProp: (prop) => prop !== 'open' && prop !== 'borderRadius'
})(({ theme, open }) => ({
  backgroundColor: 'transparent',
  position: 'relative',
  zIndex: 1,
  minWidth: '1%',
  width: '100%',
  minHeight: `calc(100vh - ${headerHeight}px)`,
  flexGrow: 1,
  padding: '8px 24px 24px 28px',
  marginTop: headerHeight,
  ...(!open && {
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.shorter + 200
    }),
    [theme.breakpoints.up('md')]: {
      marginLeft: -(drawerWidth - 72),
      width: `calc(100% - ${drawerWidth}px)`,
      marginTop: headerHeight
    }
  }),
  ...(open && {
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.shorter + 200
    }),
    marginLeft: 0,
    marginTop: headerHeight,
    width: `calc(100% - ${drawerWidth}px)`,
    [theme.breakpoints.up('md')]: {
      marginTop: headerHeight
    }
  }),
  [theme.breakpoints.down('md')]: {
    marginLeft: 0,
    padding: 16,
    marginTop: headerHeight,
    ...(!open && {
      width: '100%'
    })
  },
  [theme.breakpoints.down('sm')]: {
    padding: 12
  }
}));

export default MainContentStyled;
