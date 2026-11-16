import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@mui/material/Button';
import { MainContext } from '../context/index.jsx';
import { homeFor } from '../../config/permissions';


const AccessDenied = () => {
    const navigate = useNavigate();
    const { adminRole } = useContext(MainContext);

    return (

        <div style={styles.container}>
            <h1 style={styles.heading}>Access Denied</h1>
            <hr style={styles.hr} />
            <h3 style={styles.message}>You don't have permission to view this.</h3>
            <h3 style={styles.icons}>🚫🚫🚫🚫</h3>
            <Button variant="contained" color="secondary" onClick={() => navigate(homeFor(adminRole), { replace: true })}>
                Go to my home
            </Button>
        </div>
    );
};

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: 15,
        justifyContent: 'center',
        alignItems: 'center',
        height: '70vh',
        color: 'white',
        textAlign: 'center',
    },
    heading: {
        fontSize: '3rem',
        fontWeight: 'bold',
        color: 'red',
        animation: 'fadeInDown 1s',
    },
    hr: {
        width: '50%',
        border: '1px solid black',
        animation: 'slideInLeft 1s',
    },
    message: {
        fontSize: '1.5rem',
        animation: 'fadeInRight 1s',
        color: "black"
    },
    icons: {
        fontSize: '2rem',
        animation: 'zoomIn 1s',
    },

};

export default AccessDenied;
