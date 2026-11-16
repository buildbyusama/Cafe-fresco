import React, { useContext, useState, useEffect } from 'react';
import {
    Alert, Box, Button, Checkbox, Chip, FormControl, FormControlLabel, FormHelperText, InputAdornment, InputLabel, ListItemText, MenuItem, Select, Stack, Switch,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography
} from '@mui/material';
import { MainContext } from '../../context/index.jsx';
import { can, homeFor } from '../../../config/permissions';
import { useNavigate } from 'react-router';
import { apiFetch } from '../../../api/client';
import { useConfirm, useNotify } from '../../../contexts/NotifyContext';
import ActionIcon from 'ui-component/ActionIcon';
import EmptyState from 'ui-component/EmptyState';
import FormDialog from 'ui-component/FormDialog';
import ListFooter from 'ui-component/ListFooter';
import PageToolbar from 'ui-component/PageToolbar';
import TableSkeleton from 'ui-component/TableSkeleton';
import { IconSearch, IconTruckDelivery } from '@tabler/icons-react';

const CATEGORIES = ['vegetables', 'meat', 'dairy', 'beverages', 'bakery', 'other'];
const PER_PAGE = 10;
const EMPTY = { name: '', contactPerson: '', phone: '', email: '', address: '', supplyCategories: [], isActive: true };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function validate(f) {
    const e = {};
    if (f.name.trim().length < 2) e.name = 'Enter at least 2 characters';
    if (f.contactPerson.trim().length < 2) e.contactPerson = 'Enter at least 2 characters';
    // same rule as the server (PHONE_REGEX)
    if (!/^\+?[0-9\s-]{7,15}$/.test(f.phone.trim())) e.phone = '7–15 digits, spaces or dashes';
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email';
    return e;
}

const Distributor = () => {
    const { adminRole, fetchDistributor: refreshShared } = useContext(MainContext);
    const navigate = useNavigate();
    const notify = useNotify();
    const confirm = useConfirm();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [onlyActive, setOnlyActive] = useState(false);
    const [category, setCategory] = useState('All');
    const [search, setSearch] = useState('');
    const [debounced, setDebounced] = useState('');
    const [dialog, setDialog] = useState(null);
    const [formData, setFormData] = useState(EMPTY);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState(null);

    // one request per pause in typing
    useEffect(() => {
        const t = setTimeout(() => setDebounced(search.trim()), 350);
        return () => clearTimeout(t);
    }, [search]);

    const load = async () => {
        setRefreshing(true);
        setLoadError('');
        const q = new URLSearchParams();
        if (onlyActive) q.set('isActive', 'true');
        if (category !== 'All') q.set('supplyCategory', category);
        if (debounced) q.set('name', debounced);
        try {
            const data = await apiFetch(`/distributer/?${q}`);
            setRows(Array.isArray(data.distributors) ? data.distributors : []);
        } catch (err) {
            setLoadError(err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        setCurrentPage(1);
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onlyActive, category, debounced]);

    const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);
    const first = (currentPage - 1) * PER_PAGE;
    const visible = rows.slice(first, first + PER_PAGE);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
    };

    const openAdd = () => {
        setFormData(EMPTY);
        setErrors({});
        setDialog({ mode: 'add' });
    };

    const openEdit = (d) => {
        setFormData({ name: d.name || '', contactPerson: d.contactPerson || '', phone: d.phone || '', email: d.email || '', address: d.address || '', supplyCategories: d.supplyCategories || [], isActive: d.isActive !== false });
        setErrors({});
        setDialog({ mode: 'edit', id: d._id });
    };

    const afterChange = async () => {
        await load();
        refreshShared?.();
    };

    const handleSave = async () => {
        const e = validate(formData);
        if (Object.keys(e).length) return setErrors(e);
        setSaving(true);
        try {
            // every field is sent, address included (it used to be dropped on update)
            const body = { ...formData, name: formData.name.trim(), contactPerson: formData.contactPerson.trim(), phone: formData.phone.trim(), email: formData.email.trim(), address: formData.address.trim() };
            if (dialog.mode === 'edit') await apiFetch(`/distributer/update/${dialog.id}`, { method: 'PUT', body });
            else await apiFetch('/distributer/create', { method: 'POST', body });
            notify.success(dialog.mode === 'edit' ? 'Distributor updated' : 'Distributor added');
            setDialog(null);
            await afterChange();
        } catch (err) {
            if (err.data?.fields) setErrors(err.data.fields);
            notify.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (d, isActive) => {
        setBusyId(d._id);
        try {
            await apiFetch(`/distributer/update/${d._id}`, { method: 'PUT', body: { isActive } });
            notify.success(`${d.name} ${isActive ? 'activated' : 'deactivated'}`);
            await afterChange();
        } catch (err) {
            notify.error(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (d) => {
        if (!(await confirm({ title: `Delete "${d.name}"?`, message: 'Distributors that still have suppliers cannot be deleted. Deactivate them instead.', confirmText: 'Delete', danger: true }))) return;
        setBusyId(d._id);
        try {
            await apiFetch(`/distributer/delete/${d._id}`, { method: 'DELETE' });
            notify.success('Distributor deleted');
            await afterChange();
        } catch (err) {
            notify.error(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const filtered = onlyActive || category !== 'All' || debounced;

    return (
        <Box>
            <PageToolbar onBack={() => navigate(homeFor(adminRole))} summary={loading ? 'Loading…' : `${rows.length} ${rows.length === 1 ? 'distributor' : 'distributors'}${filtered ? ' match' : ''}`} addLabel="Add" onAdd={openAdd} />

            {/* filters */}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2, alignItems: { md: 'center' } }}>
                <TextField
                    size="small"
                    label="Search by name"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={18} color="#8A8A8A" /></InputAdornment> }}
                    sx={{ minWidth: { md: 280 } }}
                />
                <FormControl size="small" sx={{ minWidth: 170 }}>
                    <InputLabel id="dist-cat">Supply category</InputLabel>
                    <Select labelId="dist-cat" label="Supply category" value={category} onChange={(e) => setCategory(e.target.value)}>
                        <MenuItem value="All">All categories</MenuItem>
                        {CATEGORIES.map((c) => (
                            <MenuItem key={c} value={c}>{cap(c)}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <FormControlLabel control={<Switch checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />} label="Only active" />
            </Stack>

            {loading ? (
                <TableSkeleton cols={8} />
            ) : loadError ? (
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>{loadError}</Alert>
            ) : rows.length === 0 ? (
                <Box display="flex" justifyContent="center" my={4}>
                    <EmptyState title={filtered ? 'No distributors match' : 'No distributors yet'} hint={filtered ? 'Try another search or filter.' : 'Use Add to create your first distributor.'} />
                </Box>
            ) : (
                <TableContainer sx={{ opacity: refreshing ? 0.6 : 1, transition: 'opacity .15s' }}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ width: 56, pl: 2.5 }}>No</TableCell>
                                <TableCell>Distributor</TableCell>
                                <TableCell>Contact</TableCell>
                                <TableCell align="center">Suppliers</TableCell>
                                <TableCell>Supplies</TableCell>
                                <TableCell align="center">Active</TableCell>
                                <TableCell align="right" sx={{ pr: 2.5 }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {visible.map((d, index) => (
                                <TableRow key={d._id} sx={{ opacity: busyId === d._id ? 0.55 : 1, transition: 'opacity .15s' }}>
                                    <TableCell sx={{ pl: 2.5, color: '#8A8A8A' }}>{first + index + 1}</TableCell>
                                    <TableCell>
                                        <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{d.name}</Typography>
                                        {d.address && <Typography noWrap sx={{ fontSize: '0.75rem', color: '#8A877F', maxWidth: 220 }} title={d.address}>{d.address}</Typography>}
                                    </TableCell>
                                    <TableCell>
                                        <Typography sx={{ fontSize: '0.875rem' }}>{d.contactPerson}</Typography>
                                        <Typography sx={{ fontSize: '0.75rem', color: '#8A877F' }}>{d.email} · {d.phone}</Typography>
                                    </TableCell>
                                    <TableCell align="center">{d.supplierCount ?? 0}</TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 260 }}>
                                            {(d.supplyCategories || []).length ? d.supplyCategories.map((c) => <Chip key={c} label={cap(c)} size="small" sx={{ bgcolor: '#F4F3EF', fontWeight: 500, height: 24 }} />) : <Typography sx={{ fontSize: '0.75rem', color: '#B5B3AC' }}>—</Typography>}
                                        </Box>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Switch checked={d.isActive !== false} disabled={busyId === d._id} onChange={(e) => toggleActive(d, e.target.checked)} inputProps={{ 'aria-label': `${d.name} active` }} />
                                    </TableCell>
                                    <TableCell align="right" sx={{ pr: 2.5 }}>
                                        <ActionIcon kind="edit" onClick={() => openEdit(d)} />
                                        <ActionIcon kind="delete" disabled={!can(adminRole, 'distributor.delete') || busyId === d._id} onClick={() => handleDelete(d)} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {!loading && !loadError && <ListFooter page={currentPage} totalPages={totalPages} total={rows.length} onChange={setCurrentPage} />}

            <FormDialog
                open={!!dialog}
                onClose={() => setDialog(null)}
                onSubmit={handleSave}
                saving={saving}
                icon={<IconTruckDelivery size={20} />}
                title={dialog?.mode === 'edit' ? 'Edit distributor' : 'Add distributor'}
                subtitle="Companies that deliver stock to the cafe."
                submitText={dialog?.mode === 'edit' ? 'Update' : 'Add'}
            >
                <TextField name="name" label="Company name" required autoFocus value={formData.name} onChange={handleChange} error={!!errors.name} helperText={errors.name} fullWidth />
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                    <TextField name="contactPerson" label="Contact person" required value={formData.contactPerson} onChange={handleChange} error={!!errors.contactPerson} helperText={errors.contactPerson} />
                    <TextField name="phone" label="Phone" required value={formData.phone} onChange={handleChange} error={!!errors.phone} helperText={errors.phone} />
                </Box>
                <TextField name="email" label="Email" required type="email" value={formData.email} onChange={handleChange} error={!!errors.email} helperText={errors.email} fullWidth />
                <TextField name="address" label="Address" multiline rows={2} value={formData.address} onChange={handleChange} helperText="Optional" fullWidth />
                <FormControl fullWidth error={!!errors.supplyCategories}>
                    <InputLabel id="supplyCategories-label">Supply categories</InputLabel>
                    <Select
                        label="Supply categories"
                        labelId="supplyCategories-label"
                        multiple
                        value={formData.supplyCategories}
                        onChange={(e) => setFormData({ ...formData, supplyCategories: e.target.value })}
                        renderValue={(selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {selected.map((c) => <Chip key={c} label={cap(c)} size="small" />)}
                            </Box>
                        )}
                    >
                        {CATEGORIES.map((c) => (
                            <MenuItem key={c} value={c}>
                                <Checkbox size="small" checked={formData.supplyCategories.includes(c)} />
                                <ListItemText primary={cap(c)} />
                            </MenuItem>
                        ))}
                    </Select>
                    <FormHelperText>{errors.supplyCategories || 'What they can deliver'}</FormHelperText>
                </FormControl>
                <FormControlLabel control={<Switch name="isActive" checked={formData.isActive} onChange={handleChange} />} label="Active" />
            </FormDialog>
        </Box>
    );
};

export default Distributor;
