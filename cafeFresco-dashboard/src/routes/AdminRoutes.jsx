import { useContext, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Loader from 'ui-component/Loader';
import { MainContext } from '../views/context/index.jsx';

// The admin cookie is httpOnly, so access is decided by the server session (/admin/me).
const AdminRoute = () => {
    const { sessionStatus, refreshSession } = useContext(MainContext);
    const location = useLocation();

    // Re-validate on navigation so an expired or deleted account is sent to login
    useEffect(() => {
        if (sessionStatus === 'authenticated') refreshSession();
    }, [location.pathname]);

    if (sessionStatus === 'loading') return <Loader />;
    if (sessionStatus !== 'authenticated') {
        const next = encodeURIComponent(location.pathname + location.search);
        return <Navigate to={`/admin/login?next=${next}`} replace />;
    }
    return <Outlet />;
};

export default AdminRoute;
