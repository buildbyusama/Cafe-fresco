import { useContext, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { safeNext } from '../../../routes/safeNext';
import { useTheme } from '@mui/material/styles';
import {
  Button,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  OutlinedInput,
  Typography,
  Box
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import AnimateButton from 'ui-component/extended/AnimateButton';
import { MainContext } from '../../context/index'

export default function AuthLogin() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const BASE_URL = import.meta.env.VITE_BASE_URL;
  const { refreshSession } = useContext(MainContext)



  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleMouseDownPassword = (event) => {
    event.preventDefault();
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    if (submitting) return;

    if (!email.trim() || !password) {
      setError('Email and password are required');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(`${BASE_URL}/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // The server set an httpOnly cookie; load the session from the server
      const session = await refreshSession();
      if (!session) {
        throw new Error('Login succeeded but the session could not be loaded. Check that cookies are allowed.');
      }
      navigate(safeNext(searchParams.get('next')), { replace: true });
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <form onSubmit={handleLogin} noValidate>
      <FormControl fullWidth sx={{ ...theme.typography.customInput }}>
        <InputLabel htmlFor="outlined-adornment-email-login">Email Address </InputLabel>
        <OutlinedInput
          id="outlined-adornment-email-login"
          type="email"
          value={email}
          name="email"
          onChange={(e) => setEmail(e.target.value)}
          label="Email Address "
        />
      </FormControl>

      <FormControl fullWidth sx={{ ...theme.typography.customInput }}>
        <InputLabel htmlFor="outlined-adornment-password-login">Password</InputLabel>
        <OutlinedInput
          id="outlined-adornment-password-login"
          type={showPassword ? 'text' : 'password'}
          value={password}
          name="password"
          onChange={(e) => setPassword(e.target.value)}
          endAdornment={
            <InputAdornment position="end">
              <IconButton
                aria-label="toggle password visibility"
                onClick={handleClickShowPassword}
                onMouseDown={handleMouseDownPassword}
                edge="end"
                size="large"
              >
                {showPassword ? <Visibility /> : <VisibilityOff />}
              </IconButton>
            </InputAdornment>
          }
          label="Password"
        />
      </FormControl>

      {error && (
        <Typography color="error" variant="body2" sx={{ mt: 1 }} role="alert">
          {error}
        </Typography>
      )}

      <Grid container alignItems="center" justifyContent="flex-end" sx={{ mt: 1 }}>
        <Grid item>
          <Typography variant="subtitle1" component={Link} to='/admin/forget-password' sx={{ textDecoration: 'none', color: '#8A5A00', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}>
            Forgot Password?
          </Typography>
        </Grid>
      </Grid>

      <Box sx={{ mt: 2 }}>
        <AnimateButton>
          <Button disabled={submitting} color="primary" fullWidth size="large" type="submit" variant="contained" sx={{ color: '#1A1A1A', py: 1.4, fontSize: '1rem' }}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </Button>
        </AnimateButton>
      </Box>
    </form>
  );
}
