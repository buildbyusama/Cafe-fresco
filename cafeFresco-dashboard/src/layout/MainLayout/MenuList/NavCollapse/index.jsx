import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';
import { matchPath, useLocation } from 'react-router-dom';

// material-ui
import { useTheme } from '@mui/material/styles';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Collapse from '@mui/material/Collapse';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project imports
import NavItem from '../NavItem';
import Transitions from 'ui-component/extended/Transitions';

import useConfig from 'hooks/useConfig';
import { useGetMenuMaster } from 'api/menu';

// third party

// assets
import { IconChevronDown, IconChevronRight, IconChevronUp } from '@tabler/icons-react';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

export default function NavCollapse({ menu, level, parentId }) {
  const theme = useTheme();
  const ref = useRef(null);

  const { borderRadius } = useConfig();
  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster.isDashboardDrawerOpened;

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleClickMini = (event) => {
    setAnchorEl(null);
    if (drawerOpen) {
      setOpen(!open);
      setSelected(!selected ? menu.id : null);
    } else {
      setAnchorEl(event?.currentTarget);
    }
  };

  const openMini = Boolean(anchorEl);

  const handleClosePopper = () => {
    setOpen(false);
    if (!openMini) {
      if (!menu.url) {
        setSelected(null);
      }
    }
    setAnchorEl(null);
  };

  const { pathname } = useLocation();

  const checkOpenForParent = (child, id) => {
    child.forEach((item) => {
      if (item.url === pathname) {
        setOpen(true);
        setSelected(id);
      }
    });
  };

  // menu collapse for sub-levels
  useEffect(() => {
    setOpen(false);
    openMini ? setAnchorEl(null) : setSelected(null);
    if (menu.children) {
      menu.children.forEach((item) => {
        if (item.children?.length) {
          checkOpenForParent(item.children, menu.id);
        }
        if (item.link && !!matchPath({ path: item?.link, end: false }, pathname)) {
          setSelected(menu.id);
          setOpen(true);
        }
        if (item.url === pathname) {
          setSelected(menu.id);
          setOpen(true);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, menu.children]);

  const [hoverStatus, setHover] = useState(false);

  const compareSize = () => {
    const compare = ref.current && ref.current.scrollWidth > ref.current.clientWidth;
    setHover(compare);
  };

  useEffect(() => {
    compareSize();
    window.addEventListener('resize', compareSize);
    window.removeEventListener('resize', compareSize);
  }, []);

  useEffect(() => {
    if (menu.url === pathname) {
      setSelected(menu.id);
      setAnchorEl(null);
      setOpen(true);
    }
  }, [pathname, menu]);

  // menu collapse & item
  const menus = menu.children?.map((item) => {
    switch (item.type) {
      case 'collapse':
        return <NavCollapse key={item.id} menu={item} level={level + 1} parentId={parentId} />;
      case 'item':
        return <NavItem key={item.id} item={item} level={level + 1} />;
      default:
        return (
          <Typography key={item.id} variant="h6" color="error" align="center">
            Menu Items Error
          </Typography>
        );
    }
  });

  const isSelected = selected === menu.id;

  const Icon = menu.icon;
  const menuIcon = menu.icon ? (
    <Icon strokeWidth={1.5} size={drawerOpen ? '19px' : '21px'} />
  ) : (
    <FiberManualRecordIcon
      sx={{
        width: isSelected ? 8 : 6,
        height: isSelected ? 8 : 6
      }}
      fontSize={level > 0 ? 'inherit' : 'medium'}
    />
  );

  const collapseIcon = drawerOpen ? (
    <IconChevronUp stroke={1.5} size="16px" style={{ marginTop: 'auto', marginBottom: 'auto' }} />
  ) : (
    <IconChevronRight stroke={1.5} size="16px" style={{ marginTop: 'auto', marginBottom: 'auto' }} />
  );

  const iconSelectedColor = '#2B2112';

  return (
    <>
      <ListItemButton
        sx={{
          zIndex: 1201,
          borderRadius: '10px',
          mb: 0.25,
          position: 'relative',
          ...(level === 1 && drawerOpen && { py: 0.85, px: 1.5 }),
          ...(drawerOpen && level !== 1 && { ml: `${level * 18}px` }),
          ...(!drawerOpen && { pl: 1.25 }),
          ...(drawerOpen &&
            level === 1 && {
              '&:hover': { bgcolor: '#EEEDE8' },
              '&.Mui-selected': {
                bgcolor: '#FFFFFF',
                boxShadow: '0 1px 3px rgba(17,17,17,0.06), 0 0 0 1px #EFEDE7',
                color: iconSelectedColor,
                '&::before': { content: '""', position: 'absolute', left: -12, top: 8, bottom: 8, width: 3, borderRadius: '0 3px 3px 0', bgcolor: '#F5B400' },
                '& .MuiListItemIcon-root': { color: '#D99A00' },
                '&:hover': { color: iconSelectedColor, bgcolor: '#FFFFFF' }
              }
            }),
          ...((!drawerOpen || level !== 1) && {
            py: level === 1 ? 0 : 1,
            '&:hover': { bgcolor: 'transparent' },
            '&.Mui-selected': { '&:hover': { bgcolor: 'transparent' }, bgcolor: 'transparent' }
          })
        }}
        selected={isSelected}
        {...(!drawerOpen && { onMouseEnter: handleClickMini, onMouseLeave: handleClosePopper })}
        onClick={handleClickMini}
      >
        {menuIcon && (
          <ListItemIcon
            sx={{
              minWidth: level === 1 ? 32 : 18,
              color: isSelected ? '#D99A00' : '#5A5852',
              ...(!drawerOpen &&
                level === 1 && {
                  borderRadius: `${borderRadius}px`,
                  width: 42,
                  height: 42,
                  alignItems: 'center',
                  justifyContent: 'center',
                  '&:hover': {
                    bgcolor: '#FDF1CC'
                  },
                  ...(isSelected && {
                    bgcolor: '#FDF1CC',
                    '&:hover': {
                      bgcolor: '#FDF1CC'
                    }
                  })
                })
            }}
          >
            {menuIcon}
          </ListItemIcon>
        )}
        {(drawerOpen || (!drawerOpen && level !== 1)) && (
          <Tooltip title={menu.title} disableHoverListener={!hoverStatus}>
            <ListItemText
              primary={
                <Typography
                  ref={ref}
                  noWrap
                  variant="body1"
                  color="inherit"
                  sx={{
                    fontSize: '0.875rem',
                    fontWeight: isSelected ? 600 : 500,
                    color: isSelected ? '#1A1A1A' : '#3A3935',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    width: 130
                  }}
                >
                  {menu.title}
                </Typography>
              }
              secondary={
                menu.caption && (
                  <Typography variant="caption" gutterBottom sx={{ display: 'block', ...theme.typography.subMenuCaption }}>
                    {menu.caption}
                  </Typography>
                )
              }
            />
          </Tooltip>
        )}

        {/* the collapsed rail only has room for the icon */}
        {drawerOpen && (open ? collapseIcon : <IconChevronDown stroke={1.5} size="16px" style={{ marginTop: 'auto', marginBottom: 'auto', color: '#8A877F' }} />)}

        {!drawerOpen && (
          <Popper
            open={openMini}
            anchorEl={anchorEl}
            placement="right-start"
            modifiers={[
              {
                name: 'offset',
                options: {
                  offset: [-12, 0]
                }
              }
            ]}
            sx={{
              overflow: 'visible',
              zIndex: 2001,
              minWidth: 180,
              '&:before': {
                content: '""',
                bgcolor: 'background.paper',
                transform: 'translateY(-50%) rotate(45deg)',
                zIndex: 120,
                borderLeft: `1px solid`,
                borderBottom: `1px solid`,
                borderColor: 'divider'
              }
            }}
          >
            {({ TransitionProps }) => (
              <Transitions in={openMini} {...TransitionProps}>
                <Paper
                  sx={{
                    overflow: 'hidden',
                    mt: 1.5,
                    boxShadow: theme.shadows[8],
                    backgroundImage: 'none'
                  }}
                >
                  <ClickAwayListener onClickAway={handleClosePopper}>
                    <Box>{menus}</Box>
                  </ClickAwayListener>
                </Paper>
              </Transitions>
            )}
          </Popper>
        )}
      </ListItemButton>
      {drawerOpen && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          {open && (
            <List
              disablePadding
              sx={{
                position: 'relative',
                '&:after': {
                  content: "''",
                  position: 'absolute',
                  left: '25px',
                  top: 0,
                  height: '100%',
                  width: '1px',
                  opacity: 1,
                  bgcolor: '#E6E4DE'
                }
              }}
            >
              {menus}
            </List>
          )}
        </Collapse>
      )}
    </>
  );
}

NavCollapse.propTypes = { menu: PropTypes.any, level: PropTypes.number, parentId: PropTypes.string };
