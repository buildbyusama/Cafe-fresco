import React, { useContext, useState, useEffect, useRef } from 'react';
import {
    TextField, MenuItem, Select, FormControl, InputLabel, Box, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Button, Chip, ToggleButton, ToggleButtonGroup, Alert, Typography, Stack, InputAdornment, LinearProgress, Avatar
} from '@mui/material';
import { MainContext } from '../../context/index.jsx';
import { apiFetch } from '../../../api/client';
import { useNotify } from '../../../contexts/NotifyContext';
import { formatMoney, unitPrice } from '../../../utils/format';
import EmptyState from 'ui-component/EmptyState';
import FormDialog from 'ui-component/FormDialog';
import ListFooter from 'ui-component/ListFooter';
import StatusPill from 'ui-component/StatusPill';
import TableSkeleton from 'ui-component/TableSkeleton';
import { IconPackage, IconSearch } from '@tabler/icons-react';

const SEARCH_DEBOUNCE_MS = 400;
const LOW_STOCK = Number(import.meta.env.VITE_LOW_STOCK || 5);

const stockChip = (qty) => {
    if (qty == null) return <Chip size="small" label="No stock record" />;
    if (qty <= 0) return <Chip size="small" color="error" label="Out of stock" />;
    if (qty <= LOW_STOCK) return <Chip size="small" color="warning" label={`Low: ${qty}`} />;
    return <Chip size="small" color="success" variant="outlined" label={qty} />;
};

const InventoryPage = () => {
    const { categories } = useContext(MainContext);
    const notify = useNotify();
    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [category, setCategory] = useState('All');
    const [stockFilter, setStockFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reloadKey, setReloadKey] = useState(0);
    const [editing, setEditing] = useState(null); // product being restocked
    const [mode, setMode] = useState('add'); // add | remove | set
    const [quantity, setQuantity] = useState('');
    const [saving, setSaving] = useState(false);
    const [total, setTotal] = useState(0);
    const [firstLoad, setFirstLoad] = useState(true);
    const latest = useRef(null);
    const BASE_URL = import.meta.env.VITE_BASE_URL;

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [searchTerm]);

    useEffect(() => {
        latest.current?.abort();
        const controller = new AbortController();
        latest.current = controller;
        const params = new URLSearchParams({ page: String(currentPage), name: debouncedSearch, includeInactive: 'true' });
        if (category !== 'All') params.set('category', category);
        if (stockFilter !== 'all') params.set('stock', stockFilter);
        setLoading(true);
        setError('');
        apiFetch(`/product/fetch?${params}`, { signal: controller.signal })
            .then((data) => {
                setProducts(data.products || []);
                setTotalPages(Math.max(1, data.totalPages || 1));
                setTotal(data.total || 0);
            })
            .catch((err) => { if (err.name !== 'AbortError') setError(err.message); })
            .finally(() => { if (latest.current === controller) { setLoading(false); setFirstLoad(false); } });
        return () => controller.abort();
    }, [debouncedSearch, category, stockFilter, currentPage, reloadKey]);

    const resetPage = (setter) => (value) => { setter(value); setCurrentPage(1); };

    const openRestock = (product) => {
        setEditing(product);
        setMode('add');
        setQuantity('');
    };

    const current = editing?.inventory?.quantityInStock ?? 0;
    const qty = Number(quantity);
    const validQty = quantity !== '' && Number.isInteger(qty) && (mode === 'set' ? qty >= 0 : qty > 0);
    const resulting = !validQty ? null : mode === 'set' ? qty : mode === 'add' ? current + qty : current - qty;

    const handleSave = async () => {
        if (!validQty || saving) return;
        if (resulting < 0) return notify.error(`Only ${current} in stock — cannot remove ${qty}`);
        setSaving(true);
        try {
            // 'set' carries the stock shown here so sales made meanwhile are never overwritten
            const body = mode === 'set' ? { mode: 'set', quantity: qty, expectedStock: current } : { mode: 'adjust', quantity: mode === 'add' ? qty : -qty };
            await apiFetch(`/product/inventory/update/${editing._id}`, { method: 'POST', body });
            notify.success('Stock updated');
            setEditing(null);
            setReloadKey((k) => k + 1);
        } catch (err) {
            notify.error(err.message);
            // stale numbers: refresh the list so the admin sees the real stock
            if (err.status === 409) {
                setEditing(null);
                setReloadKey((k) => k + 1);
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2.5, mt: 0.5, alignItems: { md: 'center' } }}>
                <TextField
                    size="small"
                    label="Search by name"
                    value={searchTerm}
                    onChange={(e) => resetPage(setSearchTerm)(e.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={18} color="#8A8A8A" /></InputAdornment> }}
                    sx={{ minWidth: { md: 280 } }}
                />
                <FormControl size="small" sx={{ minWidth: 170 }}>
                    <InputLabel>Category</InputLabel>
                    <Select value={category} label="Category" onChange={(e) => resetPage(setCategory)(e.target.value)}>
                        <MenuItem value="All">All categories</MenuItem>
                        {(categories || []).map((c) => (
                            <MenuItem key={c._id} value={c._id}>{c.title}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel>Stock</InputLabel>
                    <Select value={stockFilter} label="Stock" onChange={(e) => resetPage(setStockFilter)(e.target.value)}>
                        <MenuItem value="all">All stock levels</MenuItem>
                        <MenuItem value="low">Low stock (≤ {LOW_STOCK})</MenuItem>
                        <MenuItem value="out">Out of stock</MenuItem>
                    </Select>
                </FormControl>
                <Box sx={{ flex: 1 }} />
                {!firstLoad && <Typography sx={{ fontSize: '0.875rem', color: '#6B6B6B' }}>{total} {total === 1 ? 'product' : 'products'}</Typography>}
            </Stack>

            {/* first load: skeleton; later loads keep the rows visible (dimmed) so paging never jumps */}
            {loading && firstLoad ? (
                <TableSkeleton cols={8} />
            ) : error ? (
                <Box my={4}><Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>}>{error}</Alert></Box>
            ) : products.length === 0 ? (
                <EmptyState title="No products found" hint="Try another search, category or stock filter." />
            ) : (
                <>
                    <TableContainer sx={{ position: 'relative', opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }} aria-busy={loading}>
                        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2, height: 3 }} />}
                        <Table>
                            <TableHead>
                                <TableRow>
                                    {['No', 'Product', 'Category', 'Final price', 'Status', 'Stock', 'Last update', 'Actions'].map((h, i) => (
                                        <TableCell key={h} align={i === 1 ? 'left' : i === 7 ? 'right' : 'center'} sx={i === 7 ? { pr: 2.5 } : undefined}>{h}</TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {products.map((product, index) => (
                                    <TableRow key={product._id}>
                                        <TableCell align="center" sx={{ color: '#8A8A8A' }}>{(currentPage - 1) * 10 + index + 1}</TableCell>
                                        <TableCell>
                                            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                                                <Avatar variant="rounded" src={product.image ? `${BASE_URL}${product.image}` : undefined} alt="" sx={{ width: 36, height: 36, borderRadius: '8px', bgcolor: '#FFF3D1', color: '#C98A00' }}>
                                                    <IconPackage size={18} />
                                                </Avatar>
                                                <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{product.title}</Typography>
                                            </Stack>
                                        </TableCell>
                                        <TableCell align="center">{product.category?.title ?? 'Uncategorised'}</TableCell>
                                        <TableCell align="center">{formatMoney(unitPrice(product))}</TableCell>
                                        <TableCell align="center"><StatusPill status={product.isActive === false ? 'inactive' : 'active'} /></TableCell>
                                        <TableCell align="center">{stockChip(product.inventory?.quantityInStock)}</TableCell>
                                        <TableCell align="center">
                                            {product.inventory?.lastUpdated ? <span style={{ whiteSpace: 'nowrap' }}>{new Date(product.inventory.lastUpdated).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span> : '—'}
                                        </TableCell>
                                        <TableCell align="right" sx={{ pr: 2.5 }}>
                                            <Button onClick={() => openRestock(product)} variant="outlined" size="small" sx={{ whiteSpace: 'nowrap', borderColor: '#F0D58A', color: '#8A5A00', bgcolor: '#FFF8E6', '&:hover': { bgcolor: '#FFF0C7', borderColor: '#E3A100' } }}>
                                                Update stock
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <ListFooter page={currentPage} totalPages={totalPages} total={total} onChange={setCurrentPage} disabled={loading} />
                </>
            )}

            <FormDialog
                open={!!editing}
                onClose={() => setEditing(null)}
                onSubmit={handleSave}
                saving={saving}
                submitDisabled={!validQty}
                maxWidth="xs"
                icon={<IconPackage size={20} />}
                title="Update stock"
                subtitle={editing?.title}
                submitText="Save"
            >
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', px: 1.5, py: 1.25, borderRadius: '10px', bgcolor: '#FBFAF7', border: '1px solid #F0EFEB' }}>
                    <Typography sx={{ fontSize: '0.8125rem', color: '#6B6B6B' }}>Current stock</Typography>
                    <Typography sx={{ fontSize: '1.125rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{current}</Typography>
                </Stack>
                    <ToggleButtonGroup exclusive fullWidth size="small" value={mode} onChange={(e, v) => v && setMode(v)} sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600, '&.Mui-selected': { bgcolor: '#FDF1CC', color: '#2B2112', '&:hover': { bgcolor: '#FBE7AE' } } } }}>
                        <ToggleButton value="add">Add</ToggleButton>
                        <ToggleButton value="remove">Remove</ToggleButton>
                        <ToggleButton value="set">Set to</ToggleButton>
                    </ToggleButtonGroup>
                    <TextField
                        label={mode === 'set' ? 'New stock level' : 'Quantity'}
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        inputProps={{ min: mode === 'set' ? 0 : 1, step: 1 }}
                        error={quantity !== '' && !validQty}
                        helperText={quantity !== '' && !validQty ? (mode === 'set' ? 'Whole number, 0 or more' : 'Whole number, at least 1') : resulting != null ? `Stock after update: ${resulting}` : ' '}
                        autoFocus
                        FormHelperTextProps={{ sx: { color: resulting != null && validQty ? (resulting === 0 ? '#D32F2F' : resulting <= LOW_STOCK ? '#C77700' : '#2E7D4F') : undefined, fontWeight: resulting != null ? 600 : 400 } }}
                    />
            </FormDialog>
        </Box>
    );
};

export default InventoryPage;
