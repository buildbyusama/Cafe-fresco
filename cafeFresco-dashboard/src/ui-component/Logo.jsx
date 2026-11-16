import PropTypes from 'prop-types';

// material-ui
import Box from '@mui/material/Box';

// project imports
import logo from 'assets/images/logo.png';

// ==============================|| LOGO ||============================== //

// Full wordmark, or `mark` = just the burger + cup icon cropped from the same image (collapsed sidebar)
export default function Logo({ mark = false, height = 44 }) {
  if (mark) {
    // logo.png is 740x290; the burger + cup icon sits in x 55–240, y 40–235, so crop to that box at `height`
    const scale = height / 195;
    return (
      <Box
        role="img"
        aria-label="Cafe Fresco"
        sx={{
          width: Math.round(185 * scale),
          height,
          backgroundImage: `url(${logo})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${Math.round(740 * scale)}px ${Math.round(290 * scale)}px`,
          backgroundPosition: `-${Math.round(55 * scale)}px -${Math.round(40 * scale)}px`,
          mixBlendMode: 'multiply'
        }}
      />
    );
  }
  return <img src={logo} alt="Cafe Fresco" height={height} style={{ display: 'block', width: 'auto', mixBlendMode: 'multiply' }} />;
}

Logo.propTypes = { mark: PropTypes.bool, height: PropTypes.number };
