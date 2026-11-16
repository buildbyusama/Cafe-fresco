import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { MainContext } from '../context/index.jsx';
import { homeFor } from '../../config/permissions';

export default function NotFound() {
    const navigate = useNavigate();
    const { adminRole, sessionStatus } = useContext(MainContext);
    const target = sessionStatus === 'authenticated' ? homeFor(adminRole) : '/admin/login';

    return (
        <Box sx={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textAlign: 'center', p: 3 }}>
            <Typography variant="h1">404</Typography>
            <Typography variant="h4">Page not found</Typography>
            <Typography color="text.secondary">The page you are looking for doesn&apos;t exist or was moved.</Typography>
            <Button variant="contained" color="secondary" onClick={() => navigate(target, { replace: true })}>
                {sessionStatus === 'authenticated' ? 'Go to my home' : 'Go to login'}
            </Button>
        </Box>
    );
}
