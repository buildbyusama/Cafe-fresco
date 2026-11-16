import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import {
    Button,
    FormControl,
    InputAdornment,
    InputLabel,
    OutlinedInput,
    Typography,
    Box,
    IconButton
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import AnimateButton from 'ui-component/extended/AnimateButton';
import { useNotify } from '../../../contexts/NotifyContext';

export default function AuthReset() {
    const notify = useNotify();
    const theme = useTheme();
    const { token } = useParams();
    const navigate = useNavigate();

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const BASE_URL = import.meta.env.VITE_BASE_URL;


    const handleClickShowPassword = () => {
        setShowPassword(!showPassword);
    };

    const handleMouseDownPassword = (event) => {
        event.preventDefault();
    };

    const handleReset = async (event) => {
        event?.preventDefault();
        if (loading) return;

        if (newPassword.length < 8) {
            notify.error("Password must be at least 8 characters.");
            return;
        }

        if (newPassword !== confirmPassword) {
            notify.error("Passwords do not match!");
            return;
        }

        if (!token) {
            notify.error("Invalid or missing token.");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${BASE_URL}/admin/reset-password/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Password reset failed');
            }

            notify.success(data.message || 'Password reset successful!');
            navigate('/admin/login', { replace: true });

        } catch (error) {
            console.error("Error:", error);
            notify.error(error.message || 'Something went wrong!');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleReset} noValidate>
            {/* New Password Field */}
            <FormControl fullWidth sx={{ ...theme.typography.customInput, mb: 2 }}>
                <InputLabel htmlFor="outlined-adornment-newPassword">New Password</InputLabel>
                <OutlinedInput
                    id="outlined-adornment-newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    endAdornment={
                        <InputAdornment position="end">
                            <IconButton
                                aria-label="toggle password visibility"
                                onClick={handleClickShowPassword}
                                onMouseDown={handleMouseDownPassword}
                                edge="end"
                            >
                                {showPassword ? <Visibility /> : <VisibilityOff />}
                            </IconButton>
                        </InputAdornment>
                    }
                    label="New Password"
                />
            </FormControl>

            {/* Confirm Password Field */}
            <FormControl fullWidth sx={{ ...theme.typography.customInput }}>
                <InputLabel htmlFor="outlined-adornment-confirmPassword">Confirm Password</InputLabel>
                <OutlinedInput
                    id="outlined-adornment-confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    endAdornment={
                        <InputAdornment position="end">
                            <IconButton
                                aria-label="toggle password visibility"
                                onClick={handleClickShowPassword}
                                onMouseDown={handleMouseDownPassword}
                                edge="end"
                            >
                                {showPassword ? <Visibility /> : <VisibilityOff />}
                            </IconButton>
                        </InputAdornment>
                    }
                    label="Confirm Password"
                />
            </FormControl>

            {/* Reset Password Button */}
            <Box sx={{ mt: 2 }}>
                <AnimateButton>
                    <Button
                        type="submit"
                        color="primary" sx={{ color: '#1A1A1A', py: 1.4, fontSize: '1rem' }}
                        fullWidth
                        size="large"
                        variant="contained"
                        disabled={loading}
                    >
                        {loading ? "Resetting..." : "Reset Password"}
                    </Button>
                </AnimateButton>
            </Box>
        </form>
    );
}
