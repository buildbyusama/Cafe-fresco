import { Link } from 'react-router-dom';

// material-ui
import Typography from '@mui/material/Typography';

// project imports
import AuthLayout from './AuthLayout';
import AuthForget from '../auth-forms/AuthForget';

// ================================|| FORGOT PASSWORD ||================================ //

export default function Forget() {
  return (
    <AuthLayout
      title="Forgot password?"
      subtitle="Enter your email and we'll send you a link to reset it."
      footer={
        <Typography component={Link} to="/admin/login" sx={{ color: '#8A5A00', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
          ← Back to sign in
        </Typography>
      }
    >
      <AuthForget />
    </AuthLayout>
  );
}
