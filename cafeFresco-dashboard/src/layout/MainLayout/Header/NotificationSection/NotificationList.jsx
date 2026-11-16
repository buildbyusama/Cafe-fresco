import PropTypes from 'prop-types';

// material-ui
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// assets
import { IconShieldCheck, IconShoppingBag, IconX } from '@tabler/icons-react';

// "just now", "5 min ago", "3 h ago", "Yesterday", "2 d ago", then a date
export function timeAgo(value) {
    const t = new Date(value).getTime();
    if (Number.isNaN(t)) return '';
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 45) return 'just now';
    const m = Math.round(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} h ago`;
    const d = Math.round(h / 24);
    if (d === 1) return 'Yesterday';
    if (d < 7) return `${d} d ago`;
    return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const KIND = {
    order: { icon: IconShoppingBag, bg: '#FFF3D1', color: '#C98A00' },
    cancel: { icon: IconX, bg: '#FDECEC', color: '#D32F2F' },
    permission: { icon: IconShieldCheck, bg: '#F1ECFA', color: '#6B4FB3' }
};

// ==============================|| NOTIFICATION LIST ||============================== //

export default function NotificationList({ notifications, onOpen }) {
    return (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {notifications.map((n) => {
                const kind = n.type === 'permission' ? 'permission' : /cancel/i.test(n.message || '') ? 'cancel' : 'order';
                const k = KIND[kind];
                const Icon = k.icon;
                return (
                    <Box component="li" key={n._id}>
                        <ButtonBase
                            onClick={() => onOpen(n)}
                            aria-label={`${n.unread ? 'Unread: ' : ''}${n.message}`}
                            sx={{
                                width: '100%',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 1.5,
                                px: 2,
                                py: 1.25,
                                fontFamily: 'inherit',
                                bgcolor: n.unread ? '#FFFBF0' : 'transparent',
                                borderBottom: '1px solid #F0EFEB',
                                transition: 'background-color .15s',
                                '&:hover': { bgcolor: n.unread ? '#FFF6DE' : '#FAFAF8' },
                                '&.Mui-focusVisible': { bgcolor: '#FFF6DE' }
                            }}
                        >
                            <Box sx={{ width: 32, height: 32, borderRadius: '10px', bgcolor: k.bg, color: k.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                <Icon size={17} stroke={1.8} />
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
                                    <Typography noWrap sx={{ fontSize: '0.8125rem', fontWeight: n.unread ? 700 : 600, color: '#111' }}>
                                        {n.name || 'System'}
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.6875rem', color: '#8A8A8A', whiteSpace: 'nowrap', flexShrink: 0 }} title={new Date(n.time).toLocaleString()}>
                                        {timeAgo(n.time)}
                                    </Typography>
                                </Stack>
                                <Typography sx={{ fontSize: '0.78rem', color: '#555', mt: 0.25, lineHeight: 1.45 }}>{n.message}</Typography>
                            </Box>
                            {n.unread && <Box aria-hidden sx={{ width: 8, height: 8, mt: 0.75, borderRadius: '50%', bgcolor: '#F5B400', flexShrink: 0 }} />}
                        </ButtonBase>
                    </Box>
                );
            })}
        </Box>
    );
}

NotificationList.propTypes = { notifications: PropTypes.array, onOpen: PropTypes.func };
