import React, { useContext, useState, useEffect, useRef } from 'react';
import {
    TextField, MenuItem, Select, FormControl, InputLabel, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Button, Alert, Switch, Stack, Typography, Avatar, InputAdornment, LinearProgress
} from '@mui/material';
import { MainContext } from '../../context/index.jsx';
import { can } from '../../../config/permissions';
import { useNavigate } from 'react-router';
import { apiFetch } from '../../../api/client';
import { formatMoney, unitPrice } from '../../../utils/format';
import { useConfirm, useNotify } from '../../../contexts/NotifyContext';
import ActionIcon from 'ui-component/ActionIcon';
import EmptyState from 'ui-component/EmptyState';
import ListFooter from 'ui-component/ListFooter';
import StatusPill from 'ui-component/StatusPill';
import TableSkeleton from 'ui-component/TableSkeleton';
import { IconPackage, IconPlus, IconSearch, IconStarFilled } from '@tabler/icons-react';

const SEARCH_DEBOUNCE_MS = 400;
const LOW_STOCK = Number(import.meta.env.VITE_LOW_STOCK || 5);

const stockPill = (qty) => {
    if (qty == null) return <StatusPill tone="neutral" label="No record" />;
    if (qty <= 0) return <StatusPill tone="danger" label="Out" />;
    if (qty <= LOW_STOCK) return <StatusPill tone="warning" label={`Low · ${qty}`} />;
    return <StatusPill tone="success" label={qty} />;
};

const AllProductsPage = () => {
    const BASE_URL = import.meta.env.VITE_BASE_URL;
    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sortCategory, setSortCategory] = useState('All');
    const [sortPrice, setSortPrice] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [firstLoad, setFirstLoad] = useState(true);
    const [error, setError] = useState('');
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [reloadKey, setReloadKey] = useState(0);
    const [busyId, setBusyId] = useState(null);
    const { categories, adminRole } = useContext(MainContext);
    const navigate = useNavigate();
    const notify = useNotify();
    const confirm = useConfirm();
    const latestRequest = useRef(null);

    // Debounce typing so one request is sent per pause
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [searchTerm]);

    // Single fetch effect; stale responses are aborted so they can't overwrite newer results
    useEffect(() => {
        latestRequest.current?.abort();
        const controller = new AbortController();
        latestRequest.current = controller;

        const params = new URLSearchParams({ page: String(currentPage), name: debouncedSearch, sort: sortPrice, includeInactive: 'true' });
        if (sortCategory !== 'All') params.set('category', sortCategory);

        setLoading(true);
        setError('');
        apiFetch(`/product/fetch?${params}`, { signal: controller.signal })
            .then((data) => {
                setProducts(data.products || []);
                setTotal(data.total || 0);
                setTotalPages(Math.max(1, data.totalPages || 1));
            })
            .catch((err) => {
                if (err.name !== 'AbortError') setError(err.message);
            })
            .finally(() => {
                if (latestRequest.current === controller) {
                    setLoading(false);
                    setFirstLoad(false);
                }
            });

        return () => controller.abort();
    }, [debouncedSearch, sortCategory, sortPrice, currentPage, reloadKey]);

    // Any filter change starts again from page 1
    const handleSearch = (e) => { setSearchTerm(e.target.value); setCurrentPage(1); };

    const handleToggleActive = async (product) => {
        const next = product.isActive === false;
        setBusyId(product._id);
        try {
            const form = new FormData();
            form.append('isActive', String(next));
            await apiFetch(`/product/update/${product._id}`, { method: 'PUT', formData: form });
            // update the row in place: no reload flash
            setProducts((list) => list.map((p) => (p._id === product._id ? { ...p, isActive: next } : p)));
            notify.success(next ? `${product.title} is visible in the shop` : `${product.title} hidden from the shop`);
        } catch (err) {
            notify.error(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (product) => {
        const ok = await confirm({ title: `Delete "${product.title}"?`, message: 'This cannot be undone. Products that already have orders can only be deactivated.', confirmText: 'Delete', danger: true });
        if (!ok) return;
        setBusyId(product._id);
        try {
            const data = await apiFetch(`/product/delete/${product._id}`, { method: 'DELETE' });
            notify.success(data?.message || 'Product deleted');
            setReloadKey((k) => k + 1);
        } catch (err) {
            notify.error(err.message);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <Box>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} sx={{ mb: 2.5, mt: 0.5, alignItems: { lg: 'center' } }}>
                <TextField
                    size="small"
                    label="Search by name"
                    value={searchTerm}
                    onChange={handleSearch}
                    InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={18} color="#8A8A8A" /></InputAdornment> }}
                    sx={{ minWidth: { lg: 280 } }}
                />
                <Stack direction="row" spacing={1.5}>
                    <FormControl size="small" sx={{ minWidth: 170 }}>
                        <InputLabel>Category</InputLabel>
                        <Select value={sortCategory} label="Category" onChange={(e) => { setSortCategory(e.target.value); setCurrentPage(1); }}>
                            <MenuItem value="All">All categories</MenuItem>
                            {(categories || []).filter(Boolean).map((c) => (
                                <MenuItem key={c._id} value={c._id}>{c.title}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 170 }}>
                        <InputLabel>Sort by Price</InputLabel>
                        <Select value={sortPrice} label="Sort by Price" onChange={(e) => { setSortPrice(e.target.value); setCurrentPage(1); }}>
                            <MenuItem value="">Newest first</MenuItem>
                            <MenuItem value="low">Price: low to high</MenuItem>
                            <MenuItem value="high">Price: high to low</MenuItem>
                        </Select>
                    </FormControl>
                </Stack>
                <Box sx={{ flex: 1 }} />
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    {!firstLoad && !error && <Typography sx={{ fontSize: '0.875rem', color: '#6B6B6B', whiteSpace: 'nowrap' }}>{total} {total === 1 ? 'product' : 'products'}</Typography>}
                    <Button variant="contained" startIcon={<IconPlus size={18} />} onClick={() => navigate('/admin/add-product')} sx={{ whiteSpace: 'nowrap' }}>
                        Add product
                    </Button>
                </Stack>
            </Stack>

            {loading && firstLoad ? (
                <TableSkeleton cols={9} />
            ) : error ? (
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>}>{error}</Alert>
            ) : products.length === 0 ? (
                <Box display="flex" justifyContent="center" my={4}>
                    <EmptyState title="No products found" hint="Try another search or category, or add a new product." />
                </Box>
            ) : (
                <>
                    <TableContainer sx={{ position: 'relative', opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }} aria-busy={loading}>
                        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2, height: 3 }} />}
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ width: 56, pl: 2.5 }}>No</TableCell>
                                    <TableCell>Product</TableCell>
                                    <TableCell>Category</TableCell>
                                    <TableCell align="right">Price</TableCell>
                                    <TableCell align="center">Stock</TableCell>
                                    <TableCell align="center">Rating</TableCell>
                                    <TableCell align="center">Active</TableCell>
                                    <TableCell align="right" sx={{ pr: 2.5 }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {products.map((product, index) => {
                                    const final = unitPrice(product);
                                    return (
                                        <TableRow key={product._id} sx={{ opacity: busyId === product._id ? 0.55 : product.isActive === false ? 0.7 : 1, transition: 'opacity .15s' }}>
                                            <TableCell sx={{ pl: 2.5, color: '#8A8A8A' }}>{(currentPage - 1) * 10 + index + 1}</TableCell>
                                            <TableCell>
                                                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                                                    <Avatar variant="rounded" src={product.image ? `${BASE_URL}${product.image}` : undefined} alt="" sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: '#FFF3D1', color: '#C98A00' }}>
                                                        <IconPackage size={18} />
                                                    </Avatar>
                                                    <Box sx={{ minWidth: 0 }}>
                                                        <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{product.title || 'Untitled'}</Typography>
                                                        <Stack direction="row" spacing={0.5} sx={{ mt: 0.25 }}>
                                                            {product.featured && <Box component="span" sx={{ fontSize: '0.6875rem', fontWeight: 700, px: 0.75, borderRadius: '5px', bgcolor: '#FFF3D1', color: '#8A5A00' }}>Featured</Box>}
                                                            {product.newRelease && <Box component="span" sx={{ fontSize: '0.6875rem', fontWeight: 700, px: 0.75, borderRadius: '5px', bgcolor: '#E7F0FD', color: '#1E5BB8' }}>New</Box>}
                                                        </Stack>
                                                    </Box>
                                                </Stack>
                                            </TableCell>
                                            <TableCell>{product.category?.title ?? <span style={{ color: '#B5B3AC' }}>Uncategorised</span>}</TableCell>
                                            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(final)}</Typography>
                                                {product.discount > 0 && (
                                                    <Typography sx={{ fontSize: '0.75rem', color: '#8A877F' }}>
                                                        <s>{formatMoney(product.price)}</s> <span style={{ color: '#2E7D4F', fontWeight: 700 }}>−{product.discount}%</span>
                                                    </Typography>
                                                )}
                                            </TableCell>
                                            <TableCell align="center">{stockPill(product.inventory?.quantityInStock)}</TableCell>
                                            <TableCell align="center">
                                                {Number(product.averageRating) > 0 ? (
                                                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem' }}>
                                                        <IconStarFilled size={14} color="#F5B400" />
                                                        <span style={{ fontWeight: 600 }}>{Number(product.averageRating).toFixed(1)}</span>
                                                        <span style={{ color: '#8A877F' }}>({product.reviewCount || 0})</span>
                                                    </Stack>
                                                ) : (
                                                    <span style={{ color: '#B5B3AC' }}>—</span>
                                                )}
                                            </TableCell>
                                            <TableCell align="center">
                                                <Switch size="small" checked={product.isActive !== false} disabled={busyId === product._id} onChange={() => handleToggleActive(product)} inputProps={{ 'aria-label': `Active ${product.title}` }} />
                                            </TableCell>
                                            <TableCell align="right" sx={{ pr: 2.5 }}>
                                                <ActionIcon kind="edit" onClick={() => navigate(`/admin/edit-product/${product._id}`)} />
                                                <ActionIcon kind="delete" disabled={!can(adminRole, 'product.delete') || busyId === product._id} onClick={() => handleDelete(product)} />
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <ListFooter page={currentPage} totalPages={totalPages} total={total} onChange={setCurrentPage} disabled={loading} />
                </>
            )}
        </Box>
    );
};

export default AllProductsPage;
