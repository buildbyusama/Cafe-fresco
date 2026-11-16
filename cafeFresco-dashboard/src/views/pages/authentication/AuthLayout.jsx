import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

// material-ui
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// project imports
import Logo from 'ui-component/Logo';
import { canvasBg } from 'store/constant';

// assets
import { IconChartBar, IconPackage, IconReceipt } from '@tabler/icons-react';

const FEATURES = [
    { icon: IconReceipt, title: 'Orders in one place', text: 'Track, complete and refund orders as they come in.' },
    { icon: IconPackage, title: 'Stock that stays right', text: 'Live inventory with low-stock alerts.' },
    { icon: IconChartBar, title: 'Clear daily numbers', text: 'Revenue and order trends at a glance.' }
];

// Split auth layout: warm brand panel (desktop) + form card on the canvas
export default function AuthLayout({ title, subtitle, children, footer }) {
    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: canvasBg }}>
            {/* brand panel */}
            <Box
                sx={{
                    display: { xs: 'none', md: 'flex' },
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    width: '46%',
                    maxWidth: 640,
                    p: 6,
                    position: 'relative',
                    overflow: 'hidden',
                    background: 'linear-gradient(160deg, #FFF8E6 0%, #FFEBB5 100%)'
                }}
            >
                <Box component="svg" aria-hidden viewBox="0 0 400 400" sx={{ position: 'absolute', right: -120, top: -120, width: 420, height: 420, opacity: 0.55 }}>
                    <circle cx="200" cy="200" r="200" fill="#FFD66B" />
                </Box>
                <Box component="svg" aria-hidden viewBox="0 0 400 300" preserveAspectRatio="none" sx={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: 220, opacity: 0.6 }}>
                    <path d="M0 300 V140 C90 90 170 170 260 120 C320 88 360 60 400 70 V300 Z" fill="#FFE29A" />
                </Box>

                <Box component={Link} to="/admin/login" aria-label="Cafe Fresco" sx={{ position: 'relative', display: 'inline-block' }}>
                    <Logo height={62} />
                </Box>

                <Box sx={{ position: 'relative' }}>
                    <Typography component="p" sx={{ fontSize: '2.375rem', fontWeight: 800, lineHeight: 1.15, color: '#1A1A1A', letterSpacing: '-0.02em', maxWidth: 420 }}>
                        Run your café with clarity.
                    </Typography>
                    <Typography sx={{ fontSize: '1.0625rem', color: '#5A4A22', mt: 1.5, maxWidth: 400 }}>
                        Everything you need to manage Cafe Fresco — orders, menu, stock and team — in one calm dashboard.
                    </Typography>
                    <Stack spacing={2.25} sx={{ mt: 4 }}>
                        {FEATURES.map(({ icon: Icon, title: t, text }) => (
                            <Stack key={t} direction="row" spacing={1.75} sx={{ alignItems: 'center' }}>
                                <Box sx={{ width: 42, height: 42, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.75)', color: '#C98A00', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                    <Icon size={22} stroke={1.8} />
                                </Box>
                                <Box>
                                    <Typography sx={{ fontWeight: 700, color: '#1A1A1A', fontSize: '0.98rem' }}>{t}</Typography>
                                    <Typography sx={{ color: '#6A5A30', fontSize: '0.875rem' }}>{text}</Typography>
                                </Box>
                            </Stack>
                        ))}
                    </Stack>
                </Box>

                <Typography sx={{ position: 'relative', color: '#7A6A40', fontSize: '0.8125rem' }}>© {new Date().getFullYear()} Cafe Fresco · Admin</Typography>
            </Box>

            {/* form side */}
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 2, sm: 4 } }}>
                <Box sx={{ width: '100%', maxWidth: 440 }}>
                    <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'center', mb: 3 }}>
                        <Logo height={62} />
                    </Box>
                    <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '20px', boxShadow: '0 8px 40px rgba(17,17,17,0.07)', p: { xs: 3, sm: 4.5 } }}>
                        <Typography component="h1" sx={{ fontSize: '1.75rem', fontWeight: 800, color: '#111', letterSpacing: '-0.02em' }}>
                            {title}
                        </Typography>
                        {subtitle && <Typography sx={{ color: '#6B6B6B', fontSize: '0.98rem', mt: 0.75, mb: 3 }}>{subtitle}</Typography>}
                        {children}
                    </Box>
                    {footer && <Box sx={{ textAlign: 'center', mt: 2.5 }}>{footer}</Box>}
                </Box>
            </Box>
        </Box>
    );
}

AuthLayout.propTypes = { title: PropTypes.node, subtitle: PropTypes.node, children: PropTypes.node, footer: PropTypes.node };
