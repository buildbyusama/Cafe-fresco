import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';

// material-ui
import Link from '@mui/material/Link';

// project imports
import { DASHBOARD_PATH } from 'config';
import Logo from 'ui-component/Logo';

// ==============================|| MAIN LOGO ||============================== //

export default function LogoSection({ mark = false, height }) {
  return (
    <Link component={RouterLink} to={DASHBOARD_PATH} aria-label="Cafe Fresco home" sx={{ display: 'block', lineHeight: 0 }}>
      <Logo mark={mark} height={height} />
    </Link>
  );
}

LogoSection.propTypes = { mark: PropTypes.bool, height: PropTypes.number };
