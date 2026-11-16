import { useContext } from 'react';
import Loader from 'ui-component/Loader';
import AccessDenied from '../views/Error/AccessDenied.jsx';
import { MainContext } from '../views/context/index.jsx';
import { canAccess } from '../config/permissions';

// Route-level role check, so pages never call hooks after a conditional return
export default function RequireRole({ route, children }) {
    const { adminRole, sessionStatus } = useContext(MainContext);

    if (sessionStatus === 'loading') return <Loader />;
    if (!canAccess(adminRole, route)) return <AccessDenied />;
    return children;
}
