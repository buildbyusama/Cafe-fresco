import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { MainContext } from '../views/context/index.jsx';
import { homeFor } from '../config/permissions';

// /admin → the landing page for the current role
export default function HomeRedirect() {
    const { adminRole } = useContext(MainContext);
    return <Navigate to={homeFor(adminRole)} replace />;
}
