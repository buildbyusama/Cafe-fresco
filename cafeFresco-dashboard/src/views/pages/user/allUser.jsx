import React, { useContext, useState, useEffect, useRef } from 'react';
import { Alert, Avatar, Box, Button, ButtonBase, Dialog, IconButton, InputAdornment, LinearProgress, Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { MainContext } from '../../context/index.jsx';
import { can, homeFor } from '../../../config/permissions';
import { useNavigate } from 'react-router';
import { apiFetch } from '../../../api/client';
import { formatMoney } from '../../../utils/format';
import ActionIcon from 'ui-component/ActionIcon';
import EmptyState from 'ui-component/EmptyState';
import ListFooter from 'ui-component/ListFooter';
import PageToolbar from 'ui-component/PageToolbar';
import StatusPill from 'ui-component/StatusPill';
import TableSkeleton from 'ui-component/TableSkeleton';
import { IconChevronRight, IconReceipt, IconSearch, IconX } from '@tabler/icons-react';

const PER_PAGE = 10;
const initials = (n = '') => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const AllUser = () => {
    const { adminRole } = useContext(MainContext);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [firstLoad, setFirstLoad] = useState(true);
    const [users, setUsers] = useState([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [currentPage, setCurrentPage] = useState(1);
    const [error, setError] = useState('');
    const [reloadKey, setReloadKey] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [debounced, setDebounced] = useState('');
    const [history, setHistory] = useState(null); // { user, status: loading|ready|error, orders, error }
    const historyFor = useRef(null);

    // One debounced fetch for both the list and search (same response shape)
    useEffect(() => {
        const t = setTimeout(() => setDebounced(searchQuery.trim()), 400);
        return () => clearTimeout(t);
    }, [searchQuery]);

    useEffect(() => {
        const controller = new AbortController();
        const params = new URLSearchParams({ page: String(currentPage), limit: String(PER_PAGE) });
        let path = `/user/all?${params}`;
        if (debounced) {
            params.set('query', debounced);
            path = `/user/search?${params}`;
        }
        setLoading(true);
        setError('');
        apiFetch(path, { signal: controller.signal })
            .then((data) => {
                setUsers(data.data || []);
                setTotal(data.totalUsers || 0);
                setTotalPages(Math.max(1, data.totalPages || 1));
            })
            .catch((err) => { if (err.name !== 'AbortError') setError(err.message); })
            .finally(() => { if (!controller.signal.aborted) { setLoading(false); setFirstLoad(false); } });
        return () => controller.abort();
    }, [debounced, currentPage, reloadKey]);

    const openHistory = async (user) => {
        historyFor.current = user._id;
        setHistory({ user, status: 'loading', orders: [] });
        try {
            const data = await apiFetch(`/order/history/${user._id}`);
            // ignore a slow answer for a customer the admin already closed / switched away from
            if (historyFor.current === user._id) setHistory({ user, status: 'ready', orders: data.orders || [] });
        } catch (err) {
            if (historyFor.current === user._id) setHistory({ user, status: 'error', orders: [], error: err.message });
        }
    };

    const closeHistory = () => {
        historyFor.current = null;
        setHistory(null);
    };

    const orders = history?.orders || [];
    const spent = orders.filter((o) => o.orderStatus === 'completed' && o.paymentStatus === 'paid').reduce((s, o) => s + (o.totalAmount || 0), 0);
    const stat = (label, value) => (
        <Box sx={{ flex: 1, p: 1.5, borderRadius: '12px', bgcolor: '#FBFAF7', border: '1px solid #F0EFEB' }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#8A877F' }}>{label}</Typography>
            <Typography sx={{ fontSize: '1.0625rem', fontWeight: 800, color: '#111', fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
        </Box>
    );

    return (
        <Box>
            <PageToolbar onBack={() => navigate(homeFor(adminRole))} summary={firstLoad ? 'Loading…' : `${total} ${total === 1 ? 'customer' : 'customers'}${debounced ? ' match' : ''}`}>
                <TextField
                    size="small"
                    placeholder="Search name, email or phone"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    inputProps={{ 'aria-label': 'Search Users' }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={18} color="#8A8A8A" /></InputAdornment> }}
                    sx={{ width: { xs: '100%', sm: 300 } }}
                />
            </PageToolbar>

            {loading && firstLoad ? (
                <TableSkeleton cols={6} />
            ) : error ? (
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>}>{error}</Alert>
            ) : users.length === 0 ? (
                <Box display="flex" justifyContent="center" my={4}>
                    <EmptyState title={debounced ? 'No customers match' : 'No customers yet'} hint={debounced ? `Nothing matches "${debounced}".` : 'Customers appear here after they sign up in the shop.'} />
                </Box>
            ) : (
                <>
                    <TableContainer sx={{ position: 'relative', opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }} aria-busy={loading}>
                        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2, height: 3 }} />}
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ width: 56, pl: 2.5 }}>No</TableCell>
                                    <TableCell>Customer</TableCell>
                                    <TableCell>Phone</TableCell>
                                    <TableCell>Joined</TableCell>
                                    <TableCell align="right" sx={{ pr: 2.5 }}>Orders</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {users.map((user, index) => (
                                    <TableRow key={user._id}>
                                        <TableCell sx={{ pl: 2.5, color: '#8A8A8A' }}>{(currentPage - 1) * PER_PAGE + index + 1}</TableCell>
                                        <TableCell>
                                            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                                                <Avatar sx={{ width: 34, height: 34, fontSize: '0.75rem', fontWeight: 700, bgcolor: '#F4F3EF', color: '#55534E' }}>{initials(user.name)}</Avatar>
                                                <Box sx={{ minWidth: 0 }}>
                                                    <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{user.name}</Typography>
                                                    <Typography sx={{ fontSize: '0.75rem', color: '#8A877F' }}>{user.email}</Typography>
                                                </Box>
                                            </Stack>
                                        </TableCell>
                                        <TableCell>{user.phone || <span style={{ color: '#B5B3AC' }}>—</span>}</TableCell>
                                        <TableCell>{fmtDate(user.createdAt)}</TableCell>
                                        <TableCell align="right" sx={{ pr: 2.5 }}>
                                            <ActionIcon kind="history" disabled={!can(adminRole, 'user.history')} onClick={() => openHistory(user)} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <ListFooter page={currentPage} totalPages={totalPages} total={total} onChange={setCurrentPage} disabled={loading} />
                </>
            )}

            {/* Order history */}
            <Dialog open={!!history} onClose={closeHistory} maxWidth="sm" fullWidth aria-labelledby="history-title">
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', px: 3, pt: 2.5, pb: 1.5 }}>
                    <Avatar sx={{ width: 42, height: 42, fontWeight: 700, bgcolor: '#FFF3D1', color: '#8A5A00' }}>{initials(history?.user?.name)}</Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography id="history-title" sx={{ fontSize: '1.0625rem', fontWeight: 700 }}>{history?.user?.name}</Typography>
                        <Typography sx={{ fontSize: '0.8125rem', color: '#6B6B6B' }} noWrap>{history?.user?.email} · joined {history && fmtDate(history.user.createdAt)}</Typography>
                    </Box>
                    <IconButton aria-label="Close" onClick={closeHistory} size="small" sx={{ color: '#8A877F' }}><IconX size={18} /></IconButton>
                </Stack>

                <Box sx={{ px: 3, pb: 3 }}>
                    {history?.status === 'loading' ? (
                        <Stack spacing={1.5}>
                            <Stack direction="row" spacing={1.5}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={58} sx={{ flex: 1 }} />)}</Stack>
                            {[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={56} />)}
                        </Stack>
                    ) : history?.status === 'error' ? (
                        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => openHistory(history.user)}>Retry</Button>}>{history.error}</Alert>
                    ) : (
                        <>
                            <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
                                {stat('Orders', orders.length)}
                                {stat('Completed', orders.filter((o) => o.orderStatus === 'completed').length)}
                                {stat('Spent', formatMoney(spent))}
                            </Stack>
                            {orders.length === 0 ? (
                                <Box sx={{ textAlign: 'center', py: 4, color: '#8A877F' }}>
                                    <IconReceipt size={28} stroke={1.5} />
                                    <Typography sx={{ fontSize: '0.875rem', mt: 1 }}>No orders yet</Typography>
                                </Box>
                            ) : (
                                <Box sx={{ maxHeight: '50vh', overflowY: 'auto', mx: -1, px: 1 }}>
                                    {orders.map((o) => (
                                        <ButtonBase
                                            key={o._id}
                                            onClick={() => navigate(`/admin/all-order?q=${o._id}`)}
                                            sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, mb: 1, borderRadius: '12px', border: '1px solid #F0EFEB', textAlign: 'left', fontFamily: 'inherit', '&:hover': { bgcolor: '#FBFAF7', borderColor: '#E6E4DE' } }}
                                        >
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography sx={{ fontSize: '0.875rem', fontWeight: 700 }}>#{String(o._id).slice(-6).toUpperCase()}</Typography>
                                                <Typography sx={{ fontSize: '0.75rem', color: '#8A877F' }}>
                                                    {fmtDate(o.createdAt)} · {(o.products || []).reduce((n, p) => n + (p.quantity || 0), 0)} items
                                                </Typography>
                                            </Box>
                                            <Stack sx={{ alignItems: 'flex-end', gap: 0.5 }}>
                                                <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(o.totalAmount)}</Typography>
                                                <Stack direction="row" spacing={0.5}>
                                                    <StatusPill status={o.orderStatus} />
                                                    {o.orderStatus === 'cancelled' && o.paymentStatus === 'paid' ? <StatusPill tone="danger" label="Refund due" /> : <StatusPill status={o.paymentStatus} />}
                                                </Stack>
                                            </Stack>
                                            <IconChevronRight size={16} color="#B5B3AC" />
                                        </ButtonBase>
                                    ))}
                                </Box>
                            )}
                        </>
                    )}
                </Box>
            </Dialog>
        </Box>
    );
};

export default AllUser;
