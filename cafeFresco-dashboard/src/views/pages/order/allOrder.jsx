import React, { useContext, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    TextField, MenuItem, Select, FormControl, InputLabel, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Button, Dialog, IconButton, Alert, Stack, Typography, InputAdornment, LinearProgress, Divider
} from '@mui/material';
import { MainContext } from '../../context/index.jsx';
import { can } from '../../../config/permissions';
import { apiFetch } from '../../../api/client';
import { useNotify } from '../../../contexts/NotifyContext';
import { formatMoney } from '../../../utils/format';
import ActionIcon from 'ui-component/ActionIcon';
import EmptyState from 'ui-component/EmptyState';
import FormDialog from 'ui-component/FormDialog';
import ListFooter from 'ui-component/ListFooter';
import StatusPill from 'ui-component/StatusPill';
import TableSkeleton from 'ui-component/TableSkeleton';
import { IconCash, IconCreditCard, IconEdit, IconMapPin, IconSearch, IconX } from '@tabler/icons-react';

const SEARCH_DEBOUNCE_MS = 400;
const PER_PAGE = 10;
const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i).toLocaleString('default', { month: 'long' }));

// Who moved the order to cancelled, from statusHistory (customer / admin / system)
const CANCEL_LABEL = { customer: 'customer', admin: 'admin', system: 'system (unpaid timeout)' };
const cancelledBy = (order) => {
    const entry = [...(order.statusHistory || [])].reverse().find((h) => h.to === 'cancelled');
    return entry ? CANCEL_LABEL[entry.byType] || entry.byType : null;
};
const shortId = (id) => `#${String(id).slice(-8).toUpperCase()}`;
const fmtDateTime = (d) => new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

const OrderDashboard = () => {
    const { adminRole } = useContext(MainContext);
    const notify = useNotify();
    const [searchParams] = useSearchParams();

    // ?q= pre-fills the search (notifications, dashboard, customer history); ?status= / ?paymentStatus= pre-set filters
    const pick = (key, allowed) => (allowed.includes(searchParams.get(key)) ? searchParams.get(key) : '');
    const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
    const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('q') || '');
    const [paymentStatus, setPaymentStatus] = useState(() => pick('paymentStatus', ['paid', 'unpaid']));
    const [orderStatus, setOrderStatus] = useState(() => pick('status', ['pending', 'completed', 'cancelled']));
    const [year, setYear] = useState('');
    const [month, setMonth] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [orders, setOrders] = useState([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [firstLoad, setFirstLoad] = useState(true);
    const [error, setError] = useState('');
    const [reloadKey, setReloadKey] = useState(0);
    const [editOrder, setEditOrder] = useState(null);
    const [saving, setSaving] = useState(false);
    const [viewData, setViewData] = useState(null);

    useEffect(() => {
        const q = searchParams.get('q');
        if (q !== null) {
            setSearchTerm(q);
            setDebouncedSearch(q);
        }
    }, [searchParams]);

    // One request per pause in typing
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [searchTerm]);

    // Any filter change goes back to page 1
    const setFilter = (setter) => (value) => {
        setter(value);
        setCurrentPage(1);
    };

    useEffect(() => {
        const controller = new AbortController();
        const params = new URLSearchParams({ paymentStatus, status: orderStatus, year: String(year), month: String(month), page: String(currentPage), search: debouncedSearch });
        setLoading(true);
        setError('');
        apiFetch(`/order/fetch?${params}`, { signal: controller.signal })
            .then((data) => {
                setOrders(data.orders || []);
                setTotal(data.total || 0);
                setTotalPages(Math.max(1, data.totalPages || 1));
            })
            .catch((err) => {
                if (err.name !== 'AbortError') {
                    setOrders([]);
                    setError(err.message);
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false);
                    setFirstLoad(false);
                }
            });
        return () => controller.abort();
    }, [debouncedSearch, paymentStatus, orderStatus, year, month, currentPage, reloadKey]);

    const fetchOrders = () => setReloadKey((k) => k + 1);
    const hasFilters = !!(debouncedSearch || paymentStatus || orderStatus || year || month);
    const clearFilters = () => {
        setSearchTerm('');
        setDebouncedSearch('');
        setPaymentStatus('');
        setOrderStatus('');
        setYear('');
        setMonth('');
        setCurrentPage(1);
    };

    const handleUpdateOrder = async () => {
        if (saving) return;
        setSaving(true);
        try {
            const data = await apiFetch('/order/update-status', {
                method: 'POST',
                body: { orderId: editOrder.orderId, paymentStatus: editOrder.paymentStatus, orderStatus: editOrder.orderStatus }
            });
            notify.success(data?.message || 'Order updated');
            setEditOrder(null);
            fetchOrders();
        } catch (err) {
            notify.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const filterSelect = (label, value, onChange, options, minWidth = 130) => (
        <FormControl size="small" sx={{ minWidth }}>
            <InputLabel>{label}</InputLabel>
            <Select label={label} value={value} onChange={(e) => setFilter(onChange)(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                {options.map(([v, l]) => (
                    <MenuItem key={v} value={v}>{l}</MenuItem>
                ))}
            </Select>
        </FormControl>
    );

    const v = viewData;
    const unchanged = editOrder && editOrder.orderStatus === editOrder.fromStatus && editOrder.paymentStatus === editOrder.fromPayment;

    return (
        <Box>
            {/* filters */}
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} sx={{ mb: 2.5, mt: 0.5, alignItems: { lg: 'center' } }}>
                <TextField
                    size="small"
                    label="Search order #, customer name or email"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={18} color="#8A8A8A" /></InputAdornment> }}
                    sx={{ minWidth: { lg: 320 } }}
                />
                <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', rowGap: 1.5 }}>
                    {filterSelect('Status', orderStatus, setOrderStatus, [['pending', 'Pending'], ['completed', 'Completed'], ['cancelled', 'Cancelled']])}
                    {filterSelect('Payment', paymentStatus, setPaymentStatus, [['paid', 'Paid'], ['unpaid', 'Unpaid']])}
                    {filterSelect('Month', month, setMonth, MONTHS.map((m, i) => [i + 1, m]))}
                    {filterSelect('Year', year, setYear, Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => [y, y]), 110)}
                    {hasFilters && <Button size="small" onClick={clearFilters} sx={{ color: '#8A5A00' }}>Clear filters</Button>}
                </Stack>
                <Box sx={{ flex: 1 }} />
                {!firstLoad && !error && <Typography sx={{ fontSize: '0.875rem', color: '#6B6B6B', whiteSpace: 'nowrap' }}>{total} {total === 1 ? 'order' : 'orders'}</Typography>}
            </Stack>

            {loading && firstLoad ? (
                <TableSkeleton cols={8} />
            ) : error ? (
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={fetchOrders}>Retry</Button>}>{error}</Alert>
            ) : orders.length === 0 ? (
                <Box display="flex" flexDirection="column" alignItems="center" my={4} gap={1.5}>
                    <EmptyState title={hasFilters ? 'No data available' : 'No orders yet'} hint={hasFilters ? 'No orders match these filters.' : 'Orders from the shop will appear here.'} />
                    {hasFilters && <Button variant="outlined" color="inherit" onClick={clearFilters}>Clear filters</Button>}
                </Box>
            ) : (
                <>
                    <TableContainer sx={{ position: 'relative', opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }} aria-busy={loading}>
                        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2, height: 3 }} />}
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ pl: 2.5 }}>Order</TableCell>
                                    <TableCell>Customer</TableCell>
                                    <TableCell align="right">Amount</TableCell>
                                    <TableCell align="center">Status</TableCell>
                                    <TableCell align="center">Payment</TableCell>
                                    <TableCell>Date</TableCell>
                                    <TableCell align="right" sx={{ pr: 2.5 }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {orders.map((order) => (
                                    <TableRow key={order._id}>
                                        <TableCell sx={{ pl: 2.5 }}>
                                            <span title={order._id} style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{shortId(order._id)}</span>
                                            <Typography sx={{ fontSize: '0.75rem', color: '#8A877F', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                {order.paymentMethod === 'card' ? <IconCreditCard size={13} /> : <IconCash size={13} />}
                                                {order.paymentMethod === 'card' ? 'Card' : 'Cash'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{order.userId?.name ?? 'Deleted customer'}</Typography>
                                            <Typography sx={{ fontSize: '0.75rem', color: '#8A877F' }}>{order.userId?.email ?? '—'}</Typography>
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(order.totalAmount)}</TableCell>
                                        <TableCell align="center">
                                            <StatusPill status={order.orderStatus} />
                                            {order.orderStatus === 'cancelled' && cancelledBy(order) && <Typography sx={{ fontSize: '0.6875rem', color: '#8A877F', mt: 0.5, whiteSpace: 'nowrap' }}>by {cancelledBy(order)}</Typography>}
                                        </TableCell>
                                        <TableCell align="center">
                                            {order.orderStatus === 'cancelled' && order.paymentStatus === 'paid' ? <StatusPill tone="danger" label="Refund due" /> : <StatusPill status={order.paymentStatus} />}
                                        </TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(order.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</TableCell>
                                        <TableCell align="right" sx={{ pr: 2.5 }}>
                                            <ActionIcon kind="view" onClick={() => setViewData(order)} />
                                            {/* nothing left to change: cancelled, completed+paid, or a completed card order (Stripe marks it paid) */}
                                            <ActionIcon
                                                kind="edit"
                                                disabled={!can(adminRole, 'order.update') || order.orderStatus === 'cancelled' || (order.orderStatus === 'completed' && (order.paymentStatus === 'paid' || order.paymentMethod === 'card'))}
                                                onClick={() => setEditOrder({ orderId: order._id, orderStatus: order.orderStatus, paymentStatus: order.paymentStatus, fromStatus: order.orderStatus, fromPayment: order.paymentStatus, paymentMethod: order.paymentMethod, total: order.totalAmount })}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <ListFooter page={currentPage} totalPages={totalPages} total={total} perPage={PER_PAGE} onChange={setCurrentPage} disabled={loading} />
                </>
            )}

            {/* Edit status */}
            <FormDialog
                open={!!editOrder}
                onClose={() => setEditOrder(null)}
                onSubmit={handleUpdateOrder}
                saving={saving}
                submitDisabled={unchanged}
                maxWidth="xs"
                icon={<IconEdit size={20} />}
                title={`Update order ${editOrder ? shortId(editOrder.orderId) : ''}`}
                subtitle={editOrder ? `${formatMoney(editOrder.total)} · ${editOrder.paymentMethod === 'card' ? 'Card' : 'Cash on delivery'}` : ''}
                submitText="Update"
            >
                <FormControl fullWidth>
                    <InputLabel>Order Status</InputLabel>
                    <Select
                        label="Order Status"
                        value={editOrder?.orderStatus || ''}
                        // leaving "completed" undoes a "paid" picked for it (paid needs completed)
                        onChange={(e) => setEditOrder({ ...editOrder, orderStatus: e.target.value, ...(e.target.value !== 'completed' && { paymentStatus: editOrder.fromPayment }) })}
                    >
                        {/* Only moves allowed by the server: pending → completed | cancelled */}
                        <MenuItem value="pending" disabled={editOrder?.fromStatus !== 'pending'}>Pending</MenuItem>
                        {/* a card order can be completed only after Stripe has taken the payment */}
                        <MenuItem value="completed" disabled={editOrder?.fromStatus === 'cancelled' || (editOrder?.paymentMethod === 'card' && editOrder?.fromPayment !== 'paid')}>
                            {editOrder?.paymentMethod === 'card' && editOrder?.fromPayment !== 'paid' ? 'Completed (waiting for card payment)' : 'Completed'}
                        </MenuItem>
                        <MenuItem value="cancelled" disabled={editOrder?.fromStatus === 'completed'}>Cancelled (returns stock)</MenuItem>
                    </Select>
                </FormControl>
                <FormControl fullWidth>
                    <InputLabel>Payment Status</InputLabel>
                    <Select label="Payment Status" value={editOrder?.paymentStatus || ''} onChange={(e) => setEditOrder({ ...editOrder, paymentStatus: e.target.value })}>
                        {/* unpaid → paid only once completed; paid is final */}
                        <MenuItem value="paid" disabled={editOrder?.fromPayment !== 'paid' && (editOrder?.orderStatus !== 'completed' || editOrder?.paymentMethod === 'card')}>
                            Paid{editOrder?.paymentMethod === 'card' && editOrder?.fromPayment !== 'paid' ? ' (set by Stripe)' : ''}
                        </MenuItem>
                        <MenuItem value="unpaid" disabled={editOrder?.fromPayment === 'paid'}>Unpaid</MenuItem>
                    </Select>
                </FormControl>
                {editOrder?.orderStatus === 'cancelled' && editOrder?.fromStatus !== 'cancelled' && (
                    <Alert severity="warning" sx={{ borderRadius: '10px' }}>
                        Cancelling is final: stock goes back and any discount code is released.{editOrder.fromPayment === 'paid' ? ' This order was paid — refund the customer.' : ''}
                    </Alert>
                )}
            </FormDialog>

            {/* Order details */}
            <Dialog open={!!v} onClose={() => setViewData(null)} maxWidth="sm" fullWidth aria-labelledby="order-view-title">
                {v && (
                    <>
                        <Stack direction="row" sx={{ alignItems: 'flex-start', px: 3, pt: 2.5, pb: 1.5, gap: 1.5 }}>
                            <Box sx={{ flex: 1 }}>
                                <Typography id="order-view-title" sx={{ fontSize: '1.125rem', fontWeight: 800 }}>Order {shortId(v._id)}</Typography>
                                <Typography sx={{ fontSize: '0.8125rem', color: '#6B6B6B' }}>{fmtDateTime(v.createdAt)}</Typography>
                            </Box>
                            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                                <StatusPill status={v.orderStatus} />
                                {v.orderStatus === 'cancelled' && v.paymentStatus === 'paid' ? <StatusPill tone="danger" label="Refund due" /> : <StatusPill status={v.paymentStatus} />}
                            </Stack>
                            <IconButton aria-label="Close" onClick={() => setViewData(null)} size="small" sx={{ color: '#8A877F', mt: -0.25 }}><IconX size={18} /></IconButton>
                        </Stack>

                        <Box sx={{ px: 3, pb: 3, display: 'grid', gap: 2 }}>
                            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                                <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: '#FBFAF7', border: '1px solid #F0EFEB' }}>
                                    <Typography sx={{ fontSize: '0.75rem', color: '#8A877F' }}>Customer</Typography>
                                    <Typography sx={{ fontWeight: 700, fontSize: '0.875rem' }}>{v.userId?.name || 'Deleted customer'}</Typography>
                                    <Typography sx={{ fontSize: '0.8125rem', color: '#6B6B6B' }}>{v.userId?.email || '—'}</Typography>
                                </Box>
                                <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: '#FBFAF7', border: '1px solid #F0EFEB' }}>
                                    <Typography sx={{ fontSize: '0.75rem', color: '#8A877F' }}>Payment</Typography>
                                    <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                        {v.paymentMethod === 'card' ? <IconCreditCard size={16} /> : <IconCash size={16} />}
                                        {v.paymentMethod === 'card' ? 'Card' : 'Cash on delivery'}
                                    </Typography>
                                    {v.orderStatus === 'cancelled' && cancelledBy(v) && <Typography sx={{ fontSize: '0.8125rem', color: '#6B6B6B' }}>Cancelled by {cancelledBy(v)}</Typography>}
                                </Box>
                            </Box>

                            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', p: 1.5, borderRadius: '12px', border: '1px solid #F0EFEB' }}>
                                <IconMapPin size={18} color="#C98A00" style={{ marginTop: 2, flexShrink: 0 }} />
                                {v.shippingAddress?.fullName ? (
                                    <Typography sx={{ fontSize: '0.8125rem', color: '#333' }}>
                                        <b>{v.shippingAddress.fullName}</b> · {v.shippingAddress.phone}
                                        <br />
                                        {[v.shippingAddress.line1, v.shippingAddress.city, v.shippingAddress.zip].filter(Boolean).join(', ')}
                                    </Typography>
                                ) : (
                                    <Typography sx={{ fontSize: '0.8125rem', color: '#8A877F' }}>No delivery address (older order)</Typography>
                                )}
                            </Stack>

                            <Box>
                                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, mb: 1 }}>Items</Typography>
                                <Box sx={{ border: '1px solid #F0EFEB', borderRadius: '12px', overflow: 'hidden' }}>
                                    {(v.products || []).map((p, i) => {
                                        const unit = Number(p.unitPrice ?? p.productId?.price ?? 0);
                                        return (
                                            <Stack key={i} direction="row" sx={{ alignItems: 'center', px: 1.5, py: 1.25, gap: 1.5, borderTop: i ? '1px solid #F0EFEB' : 'none' }}>
                                                <Box sx={{ minWidth: 28, height: 28, borderRadius: '8px', bgcolor: '#FFF3D1', color: '#8A5A00', fontSize: '0.75rem', fontWeight: 800, display: 'grid', placeItems: 'center' }}>{p.quantity || 0}×</Box>
                                                <Typography sx={{ flex: 1, fontSize: '0.875rem', fontWeight: 500 }}>{p.title || p.productId?.title || 'Deleted product'}</Typography>
                                                <Typography sx={{ fontSize: '0.75rem', color: '#8A877F' }}>{formatMoney(unit)} each</Typography>
                                                <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, minWidth: 72, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(Number(p.lineTotal ?? unit * (p.quantity || 0)))}</Typography>
                                            </Stack>
                                        );
                                    })}
                                </Box>
                            </Box>

                            <Box sx={{ ml: 'auto', width: { xs: '100%', sm: 260 }, display: 'grid', gap: 0.5, fontSize: '0.875rem' }}>
                                {v.subtotal != null && (
                                    <Stack direction="row" sx={{ justifyContent: 'space-between', color: '#6B6B6B' }}><span>Subtotal</span><span>{formatMoney(v.subtotal)}</span></Stack>
                                )}
                                {v.discountAmount > 0 && (
                                    <Stack direction="row" sx={{ justifyContent: 'space-between', color: '#2E7D4F' }}><span>Discount{v.discountCode ? ` (${v.discountCode})` : ''}</span><span>−{formatMoney(v.discountAmount)}</span></Stack>
                                )}
                                <Divider sx={{ my: 0.5 }} />
                                <Stack direction="row" sx={{ justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem' }}><span>Total</span><span>{formatMoney(v.totalAmount)}</span></Stack>
                            </Box>
                        </Box>
                    </>
                )}
            </Dialog>
        </Box>
    );
};

export default OrderDashboard;
