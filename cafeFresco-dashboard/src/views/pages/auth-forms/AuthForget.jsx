import { useState } from 'react';
import { useTheme } from '@mui/material/styles';
import {
    Button,
    FormControl,
    InputLabel,
    OutlinedInput,
    Box
} from '@mui/material';
import AnimateButton from 'ui-component/extended/AnimateButton';
import { useNotify } from '../../../contexts/NotifyContext';

export default function AuthForget() {
    const notify = useNotify();
    const theme = useTheme();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const BASE_URL = import.meta.env.VITE_BASE_URL;


    const handleForget = async (event) => {
        event?.preventDefault();
        if (loading) return;
        if (!email.trim()) {
            notify.error("Please enter your email!");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${BASE_URL}/admin/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Password reset failed');
            }

            notify.success(data.message || 'Password reset link sent!');

        } catch (error) {
            console.error("Error:", error);
            notify.error(error.message || 'Something went wrong!');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleForget} noValidate>
            <FormControl fullWidth sx={{ ...theme.typography.customInput }}>
                <InputLabel htmlFor="outlined-adornment-email-login">Email address</InputLabel>
                <OutlinedInput
                    id="outlined-adornment-email-login"
                    type="email"
                    value={email}
                    name="email"
                    onChange={(e) => setEmail(e.target.value)}
                    label="Email Address "
                />
            </FormControl>

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
                        {loading ? "Sending…" : "Send reset link"}
                    </Button>
                </AnimateButton>
            </Box>
        </form>
    );
}
