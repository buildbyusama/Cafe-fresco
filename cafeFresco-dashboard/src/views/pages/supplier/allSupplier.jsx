import React, { useContext, useState, useEffect, useMemo } from 'react';
import { Alert, Box, Button, Chip, FormControl, FormControlLabel, InputAdornment, InputLabel, MenuItem, Select, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { MainContext } from '../../context/index.jsx';
import { can, homeFor } from '../../../config/permissions';
import { useNavigate } from 'react-router';
import { apiFetch } from '../../../api/client';
import { useConfirm, useNotify } from '../../../contexts/NotifyContext';
import ActionIcon from 'ui-component/ActionIcon';
import EmptyState from 'ui-component/EmptyState';
import ListFooter from 'ui-component/ListFooter';
import PageToolbar from 'ui-component/PageToolbar';
import TableSkeleton from 'ui-component/TableSkeleton';
import { IconSearch } from '@tabler/icons-react';

const SUPPLIES = ['vegetables', 'meat', 'dairy', 'beverages', 'bakery', 'other'];
const PER_PAGE = 10;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const SupplierList = () => {
    const { adminRole, distributer, fetchDistributor } = useContext(MainContext);
    const navigate = useNavigate();
    const notify = useNotify();
    const confirm = useConfirm();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [onlyActive, setOnlyActive] = useState(false);
    const [supply, setSupply] = useState('All');
    const [distributorFilter, setDistributorFilter] = useState('All');
    const [search, setSearch] = useState('');
    const [busyId, setBusyId] = useState(null);

    const load = async () => {
        setRefreshing(true);
        setLoadError('');
        const q = new URLSearchParams();
        if (onlyActive) q.set('isActive', 'true');
        if (supply !== 'All') q.set('supplies', supply);
        if (distributorFilter !== 'All') q.set('distributor', distributorFilter);
        try {
            const data = await apiFetch(`/supplier/?${q}`);
            setRows(Array.isArray(data.suppliers) ? data.suppliers : []);
        } catch (err) {
            setLoadError(err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDistributor?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        setCurrentPage(1);
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onlyActive, distributorFilter, supply]);

    // the API has no text search: filter the loaded list by name / email / phone
    const filtered = useMemo(() => {
        const t = search.trim().toLowerCase();
        return t ? rows.filter((s) => `${s.name} ${s.email} ${s.phone}`.toLowerCase().includes(t)) : rows;
    }, [rows, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);
    const first = (currentPage - 1) * PER_PAGE;
    const visible = filtered.slice(first, first + PER_PAGE);

    const toggleActive = async (s, isActive) => {
        setBusyId(s._id);
        try {
            // only the changed field (never the whole populated document)
            await apiFetch(`/supplier/update/${s._id}`, { method: 'PUT', body: { isActive } });
            setRows((list) => list.map((x) => (x._id === s._id ? { ...x, isActive } : x)));
            notify.success(`${s.name} ${isActive ? 'activated' : 'deactivated'}`);
        } catch (err) {
            notify.error(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (s) => {
        if (!(await confirm({ title: `Delete "${s.name}"?`, message: 'This cannot be undone.', confirmText: 'Delete', danger: true }))) return;
        setBusyId(s._id);
        try {
            await apiFetch(`/supplier/delete/${s._id}`, { method: 'DELETE' });
            notify.success('Supplier deleted');
            await load();
        } catch (err) {
            notify.error(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const anyFilter = onlyActive || supply !== 'All' || distributorFilter !== 'All' || search.trim();

    return (
        <Box>
            <PageToolbar onBack={() => navigate(homeFor(adminRole))} summary={loading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'supplier' : 'suppliers'}${anyFilter ? ' match' : ''}`} addLabel="Add supplier" onAdd={() => navigate('/admin/supplier/add')} />

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2, alignItems: { md: 'center' }, flexWrap: 'wrap', rowGap: 1.5 }}>
                <TextField size="small" label="Search name, email or phone" value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={18} color="#8A8A8A" /></InputAdornment> }} sx={{ minWidth: { md: 260 } }} />
                <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel id="supplies-select-label">Supplies</InputLabel>
                    <Select labelId="supplies-select-label" value={supply} label="Supplies" onChange={(e) => setSupply(e.target.value)}>
                        <MenuItem value="All">All supplies</MenuItem>
                        {SUPPLIES.map((s) => <MenuItem key={s} value={s}>{cap(s)}</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel id="distributor-select-label">Distributor</InputLabel>
                    <Select labelId="distributor-select-label" value={distributorFilter} label="Distributor" onChange={(e) => setDistributorFilter(e.target.value)}>
                        <MenuItem value="All">All distributors</MenuItem>
                        {(distributer || []).map((d) => <MenuItem key={d._id} value={d._id}>{d.name}</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControlLabel control={<Switch checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />} label="Only active" />
            </Stack>

            {loading ? (
                <TableSkeleton cols={7} />
            ) : loadError ? (
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>{loadError}</Alert>
            ) : filtered.length === 0 ? (
                <Box display="flex" justifyContent="center" my={4}>
                    <EmptyState title={anyFilter ? 'No suppliers match' : 'No suppliers yet'} hint={anyFilter ? 'Try another search or filter.' : 'Use Add supplier to create one.'} />
                </Box>
            ) : (
                <TableContainer sx={{ opacity: refreshing ? 0.6 : 1, transition: 'opacity .15s' }}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ width: 56, pl: 2.5 }}>No</TableCell>
                                <TableCell>Supplier</TableCell>
                                <TableCell>Phone</TableCell>
                                <TableCell>Supplies</TableCell>
                                <TableCell>Distributor</TableCell>
                                <TableCell align="center">Active</TableCell>
                                <TableCell align="right" sx={{ pr: 2.5 }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {visible.map((s, index) => (
                                <TableRow key={s._id} sx={{ opacity: busyId === s._id ? 0.55 : 1, transition: 'opacity .15s' }}>
                                    <TableCell sx={{ pl: 2.5, color: '#8A8A8A' }}>{first + index + 1}</TableCell>
                                    <TableCell>
                                        <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.name}</Typography>
                                        <Typography sx={{ fontSize: '0.75rem', color: '#8A877F' }}>{s.email}</Typography>
                                    </TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{s.phone}</TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 240 }}>
                                            {(s.supplies || []).map((x) => <Chip key={x} label={cap(x)} size="small" sx={{ bgcolor: '#F4F3EF', fontWeight: 500, height: 24 }} />)}
                                        </Box>
                                    </TableCell>
                                    <TableCell>{s.distributor?.name || <span style={{ color: '#B5B3AC' }}>—</span>}</TableCell>
                                    <TableCell align="center">
                                        <Switch checked={s.isActive !== false} disabled={busyId === s._id} onChange={(e) => toggleActive(s, e.target.checked)} inputProps={{ 'aria-label': `${s.name} active` }} />
                                    </TableCell>
                                    <TableCell align="right" sx={{ pr: 2.5 }}>
                                        <ActionIcon kind="edit" onClick={() => navigate(`/admin/edit-supplier/${s._id}`, { state: { supplier: s } })} />
                                        <ActionIcon kind="delete" disabled={!can(adminRole, 'supplier.delete') || busyId === s._id} onClick={() => handleDelete(s)} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {!loading && !loadError && <ListFooter page={currentPage} totalPages={totalPages} total={filtered.length} onChange={setCurrentPage} />}
        </Box>
    );
};

export default SupplierList;
