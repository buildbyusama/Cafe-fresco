import { useContext } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

// project imports
import AuthLayout from './AuthLayout';
import AuthLogin from '../auth-forms/AuthLogin';
import Loader from 'ui-component/Loader';
import { MainContext } from '../../context/index.jsx';
import { safeNext } from '../../../routes/safeNext';

// ================================|| LOGIN ||================================ //

export default function Login() {
  const { sessionStatus } = useContext(MainContext);
  const [searchParams] = useSearchParams();

  // Already logged in → skip the login form
  if (sessionStatus === 'loading') return <Loader />;
  if (sessionStatus === 'authenticated') return <Navigate to={safeNext(searchParams.get('next'))} replace />;

  return (
    <AuthLayout title="Welcome back 👋" subtitle="Sign in to manage Cafe Fresco.">
      <AuthLogin />
    </AuthLayout>
  );
}
