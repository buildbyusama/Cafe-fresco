import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../api/client';
import { formatMoney } from '../../../utils/format';

// material-ui
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

// project imports
import MainCard from 'ui-component/cards/MainCard';
import StatusPill from 'ui-component/StatusPill';
import { cardSx, titleSx } from './styles';
import { IconFlame } from '@tabler/icons-react';

const BASE_URL = import.meta.env.VITE_BASE_URL;
const RANGES = [['7d', '7 days'], ['30d', '30 days'], ['year', 'This year']];

// Best sellers by quantity in completed orders (SRS 4.7 "popular items")
export default function BestSellersCard() {
    const navigate = useNavigate();
    const [range, setRange] = useState('30d');
    const [data, setData] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setData(null);
        setFailed(false);
        apiFetch(`/api/popular?range=${range}`).then(setData).catch(() => setFailed(true));
    }, [range]);

    const max = data?.items?.[0]?.quantity || 1;

    return (
        <MainCard content={false} sx={{ ...cardSx, height: 'auto' }}>
            <Box sx={{ p: 2.5 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', mb: 2 }}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                        <IconFlame size={22} stroke={1.8} color="#E8262B" />
                        <Typography component="h2" sx={titleSx}>Popular items</Typography>
                    </Stack>
                    <ToggleButtonGroup size="small" exclusive value={range} onChange={(_, v) => v && setRange(v)} aria-label="Popular items range">
                        {RANGES.map(([v, l]) => <ToggleButton key={v} value={v}>{l}</ToggleButton>)}
                    </ToggleButtonGroup>
                </Stack>

                {failed ? (
                    <Typography sx={{ fontSize: '0.8125rem', color: '#8A877F', textAlign: 'center', py: 3 }}>Couldn&apos;t load popular items</Typography>
                ) : !data ? (
                    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} variant="rounded" height={56} />)}
                    </Box>
                ) : data.items.length === 0 ? (
                    <Typography sx={{ fontSize: '0.8125rem', color: '#8A877F', textAlign: 'center', py: 3 }}>No completed orders in this period yet</Typography>
                ) : (
                    <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                        {data.items.map((it, i) => (
                            <Box component="li" key={it.productId || i}>
                                <ButtonBase
                                    onClick={() => it.stillOnMenu && navigate(`/admin/edit-product/${it.productId}`)}
                                    disabled={!it.stillOnMenu}
                                    sx={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 1.5, p: 1, borderRadius: '12px', fontFamily: 'inherit', '&:hover': { bgcolor: '#FBFAF7' } }}
                                    aria-label={`${i + 1}. ${it.title}: ${it.quantity} sold`}
                                >
                                    <Typography sx={{ width: 20, fontWeight: 800, color: i < 3 ? '#E8262B' : '#A3A19A' }}>{i + 1}</Typography>
                                    <Avatar variant="rounded" src={it.image ? `${BASE_URL}${it.image}` : undefined} alt="" sx={{ width: 44, height: 44, borderRadius: '10px', bgcolor: '#FFF3D1', color: '#C98A00' }}>
                                        {it.title[0]}
                                    </Avatar>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                            <Typography noWrap sx={{ fontSize: '0.875rem', fontWeight: 600 }}>{it.title}</Typography>
                                            {!it.stillOnMenu && <StatusPill tone="neutral" label="Not on menu" />}
                                        </Stack>
                                        <Box sx={{ height: 5, borderRadius: 3, bgcolor: '#F0EFEB', mt: 0.75 }}>
                                            <Box sx={{ height: 5, borderRadius: 3, bgcolor: '#F5B400', width: `${(it.quantity / max) * 100}%` }} />
                                        </Box>
                                    </Box>
                                    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 800 }}>{it.quantity} sold</Typography>
                                        <Typography sx={{ fontSize: '0.75rem', color: '#8A877F' }}>{formatMoney(it.revenue)}</Typography>
                                    </Box>
                                </ButtonBase>
                            </Box>
                        ))}
                    </Box>
                )}
            </Box>
        </MainCard>
    );
}
