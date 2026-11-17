import { useContext } from 'react';
import PropTypes from 'prop-types';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import productContext from '../Context/ProductContext';
import { safeNext } from '../utils/safeNext';

const Spinner = () => (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: 'calc(100vh - 72px)' }}>
        <div className="spinner-border text-danger" role="status"><span className="visually-hidden">Loading...</span></div>
    </div>
);

// Private pages: wait for the session, then render or send to login with ?next=
export function RequireAuth({ children }) {
    const { authStatus } = useContext(productContext);
    const location = useLocation();
    if (authStatus === 'loading') return <Spinner />;
    if (authStatus !== 'authenticated') {
        return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
    }
    return children;
}

// Login / signup / forgot: logged-in users go where they were heading
export function GuestOnly({ children }) {
    const { authStatus } = useContext(productContext);
    const [searchParams] = useSearchParams();
    if (authStatus === 'loading') return <Spinner />;
    if (authStatus === 'authenticated') return <Navigate to={safeNext(searchParams.get('next'))} replace />;
    return children;
}

RequireAuth.propTypes = { children: PropTypes.node.isRequired };
GuestOnly.propTypes = { children: PropTypes.node.isRequired };
