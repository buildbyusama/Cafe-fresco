import { Link } from 'react-router-dom';

// material-ui
import Typography from '@mui/material/Typography';

// project imports
import AuthLayout from './AuthLayout';
import AuthReset from '../auth-forms/AuthReset';

// ================================|| RESET PASSWORD ||================================ //

export default function Reset() {
  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose a strong password you haven't used before."
      footer={
        <Typography component={Link} to="/admin/login" sx={{ color: '#8A5A00', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
          ← Back to sign in
        </Typography>
      }
    >
      <AuthReset />
    </AuthLayout>
  );
}
