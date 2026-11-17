import React, { useContext, useState, useEffect } from 'react';
import { Alert, Box, Button, InputAdornment, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { MainContext } from '../../context/index.jsx';
import { can, homeFor } from '../../../config/permissions';
import { useNavigate } from 'react-router';
import { apiFetch } from '../../../api/client';
import { useConfirm, useNotify } from '../../../contexts/NotifyContext';
import { formatMoney } from '../../../utils/format';
import ActionIcon from 'ui-component/ActionIcon';
import EmptyState from 'ui-component/EmptyState';
import FormDialog from 'ui-component/FormDialog';
import ListFooter from 'ui-component/ListFooter';
import PageToolbar from 'ui-component/PageToolbar';
import StatusPill from 'ui-component/StatusPill';
import TableSkeleton from 'ui-component/TableSkeleton';
import { IconDiscount2 } from '@tabler/icons-react';

const PER_PAGE = 10;
const EMPTY = { code: '', discountPercentage: '', expiryDate: '', minPurchase: '', maxUses: '', isActive: true, autoApply: false };

// yyyy-mm-dd in the browser's local time (toISOString would shift the day for anyone east/west of UTC)
const localDate = (d) => {
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return '';
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const today = () => localDate(new Date());

function validate(f, mode) {
    const e = {};
    if (mode === 'add' && !/^[A-Za-z0-9_-]{3,20}$/.test(f.code.trim())) e.code = '3–20 letters, numbers, - or _';
    const pct = Number(f.discountPercentage);
    if (f.discountPercentage === '' || !(pct >= 1 && pct <= 100)) e.discountPercentage = 'Between 1 and 100';
    if (!f.expiryDate) e.expiryDate = 'Choose a date';
    else if (f.expiryDate < today() && f.expiryDate !== f.originalExpiry) e.expiryDate = 'Must be today or later';
    if (f.minPurchase !== '' && !(Number(f.minPurchase) >= 0)) e.minPurchase = '0 or more';
    if (!(Number.isInteger(Number(f.maxUses)) && Number(f.maxUses) >= 1)) e.maxUses = 'Whole number, at least 1';
    return e;
}

const statusOf = (d) => (d.isActive === false ? 'inactive' : new Date(d.expiryDate) < new Date() ? 'expired' : (d.usedCount || 0) >= d.maxUses ? 'used up' : 'active');

const AllDiscount = () => {
    const { adminRole } = useContext(MainContext);
    const navigate = useNavigate();
    const notify = useNotify();
    const confirm = useConfirm();
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [codes, setCodes] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [dialog, setDialog] = useState(null);
    const [formData, setFormData] = useState(EMPTY);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const canManage = can(adminRole, 'discount.manage');

    const fetchDiscount = async () => {
        setLoadError('');
        try {
            const data = await apiFetch('/discount/fetch');
            setCodes(data.allCode || []);
        } catch (err) {
            setLoadError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDiscount();
    }, []);

    const totalPages = Math.max(1, Math.ceil(codes.length / PER_PAGE));
    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);
    const first = (currentPage - 1) * PER_PAGE;
    const visible = codes.slice(first, first + PER_PAGE);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : name === 'code' ? value.toUpperCase() : value }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
    };

    const openAdd = () => {
        setFormData(EMPTY);
        setErrors({});
        setDialog({ mode: 'add' });
    };

    const openEdit = (d) => {
        const expiry = localDate(d.expiryDate);
        setFormData({ code: d.code, discountPercentage: String(d.discountPercentage), expiryDate: expiry, originalExpiry: expiry, minPurchase: String(d.minPurchase ?? ''), maxUses: String(d.maxUses), isActive: d.isActive !== false, autoApply: !!d.autoApply, usedCount: d.usedCount || 0 });
        setErrors({});
        setDialog({ mode: 'edit', id: d._id });
    };

    const handleSave = async () => {
        const e = validate(formData, dialog.mode);
        if (dialog.mode === 'edit' && Number(formData.maxUses) < formData.usedCount) e.maxUses = `Already used ${formData.usedCount} times`;
        if (Object.keys(e).length) return setErrors(e);
        setSaving(true);
        try {
            const body = {
                discountPercentage: Number(formData.discountPercentage),
                minPurchase: formData.minPurchase === '' ? 0 : Number(formData.minPurchase),
                maxUses: Number(formData.maxUses),
                isActive: formData.isActive,
                autoApply: formData.autoApply
            };
            // keep an existing (maybe already past) expiry untouched unless it was changed
            if (dialog.mode === 'add' || formData.expiryDate !== formData.originalExpiry) body.expiryDate = formData.expiryDate;
            if (dialog.mode === 'add') await apiFetch('/discount/create', { method: 'POST', body: { ...body, code: formData.code.trim() } });
            else await apiFetch(`/discount/update/${dialog.id}`, { method: 'PUT', body });
            notify.success(dialog.mode === 'edit' ? 'Discount code updated' : `Code ${formData.code.trim()} created`);
            setDialog(null);
            await fetchDiscount();
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
            await apiFetch(`/discount/update/${d._id}`, { method: 'PUT', body: { isActive } });
            notify.success(`${d.code} ${isActive ? 'activated' : 'deactivated'}`);
            await fetchDiscount();
        } catch (err) {
            notify.error(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (d) => {
        if (!(await confirm({ title: `Delete code ${d.code}?`, message: 'Customers will no longer be able to use it. Past orders keep their discount.', confirmText: 'Delete', danger: true }))) return;
        setBusyId(d._id);
        try {
            await apiFetch(`/discount/delete/${d._id}`, { method: 'DELETE' });
            notify.success('Discount code deleted');
            await fetchDiscount();
        } catch (err) {
            notify.error(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const active = codes.filter((d) => statusOf(d) === 'active').length;

    return (
        <Box>
            <PageToolbar
                onBack={() => navigate(homeFor(adminRole))}
                summary={loading ? 'Loading…' : `${codes.length} ${codes.length === 1 ? 'code' : 'codes'} · ${active} active`}
                addLabel="Add"
                onAdd={canManage ? openAdd : undefined}
            />

            {loading ? (
                <TableSkeleton cols={7} />
            ) : loadError ? (
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => { setLoading(true); fetchDiscount(); }}>Retry</Button>}>
                    {loadError}
                </Alert>
            ) : codes.length === 0 ? (
                <Box display="flex" justifyContent="center" my={4}>
                    <EmptyState title="No discount codes yet" hint="Use Add to create a code customers can apply at checkout." />
                </Box>
            ) : (
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ width: 56, pl: 2.5 }}>No</TableCell>
                                <TableCell>Code</TableCell>
                                <TableCell align="center">Discount</TableCell>
                                <TableCell align="center">Valid through</TableCell>
                                <TableCell align="center">Min. spend</TableCell>
                                <TableCell align="center">Used</TableCell>
                                <TableCell align="center">Status</TableCell>
                                <TableCell align="right" sx={{ pr: 2.5 }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {visible.map((d, index) => {
                                const st = statusOf(d);
                                return (
                                    <TableRow key={d._id} sx={{ opacity: busyId === d._id ? 0.55 : 1, transition: 'opacity .15s' }}>
                                        <TableCell sx={{ pl: 2.5, color: '#8A8A8A' }}>{first + index + 1}</TableCell>
                                        <TableCell>
                                            <Box component="span" sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: '0.8125rem', px: 1, py: 0.5, borderRadius: '6px', bgcolor: '#FFF3D1', color: '#7A5200', letterSpacing: '0.04em' }}>
                                                {d.code}
                                            </Box>
                                        </TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 600 }}>{d.discountPercentage}%</TableCell>
                                        <TableCell align="center">{new Date(d.expiryDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</TableCell>
                                        <TableCell align="center">{d.minPurchase ? formatMoney(d.minPurchase) : '—'}</TableCell>
                                        <TableCell align="center" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                            {d.usedCount ?? 0} / {d.maxUses}
                                        </TableCell>
                                        <TableCell align="center">
                                            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', justifyContent: 'center' }}>
                                                <Switch size="small" checked={d.isActive !== false} disabled={!canManage || busyId === d._id} onChange={(e) => toggleActive(d, e.target.checked)} inputProps={{ 'aria-label': `${d.code} active` }} />
                                                <StatusPill tone={{ active: 'success', inactive: 'neutral', expired: 'danger', 'used up': 'warning' }[st]} label={st.charAt(0).toUpperCase() + st.slice(1)} />
                                            </Stack>
                                        </TableCell>
                                        <TableCell sx={{ pr: 2.5 }} align="right">
                                            <ActionIcon kind="edit" disabled={!canManage} onClick={() => openEdit(d)} />
                                            <ActionIcon kind="delete" disabled={!canManage || busyId === d._id} onClick={() => handleDelete(d)} />
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {!loading && !loadError && <ListFooter page={currentPage} totalPages={totalPages} total={codes.length} onChange={setCurrentPage} />}

            <FormDialog
                open={!!dialog}
                onClose={() => setDialog(null)}
                onSubmit={handleSave}
                saving={saving}
                icon={<IconDiscount2 size={20} />}
                title={dialog?.mode === 'edit' ? `Edit ${formData.code}` : 'New discount code'}
                subtitle={dialog?.mode === 'edit' ? `Used ${formData.usedCount || 0} times so far. The code text can't change.` : 'Customers enter this code at checkout.'}
                submitText={dialog?.mode === 'edit' ? 'Update' : 'Add'}
            >
                {dialog?.mode === 'add' && (
                    <TextField name="code" label="Code" required autoFocus value={formData.code} onChange={handleChange} error={!!errors.code} helperText={errors.code || 'e.g. WELCOME10'} inputProps={{ maxLength: 20, style: { textTransform: 'uppercase', letterSpacing: '0.04em' } }} fullWidth />
                )}
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                    <TextField name="discountPercentage" label="Discount" required type="number" value={formData.discountPercentage} onChange={handleChange} error={!!errors.discountPercentage} helperText={errors.discountPercentage || ' '} inputProps={{ min: 1, max: 100 }} InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} />
                    <TextField name="expiryDate" label="Valid through" required type="date" value={formData.expiryDate} onChange={handleChange} error={!!errors.expiryDate} helperText={errors.expiryDate || 'Last day it works'} InputLabelProps={{ shrink: true }} inputProps={{ min: today() }} />
                    <TextField name="minPurchase" label="Minimum spend" type="number" value={formData.minPurchase} onChange={handleChange} error={!!errors.minPurchase} helperText={errors.minPurchase || 'Optional'} inputProps={{ min: 0 }} InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
                    <TextField name="maxUses" label="Max uses" required type="number" value={formData.maxUses} onChange={handleChange} error={!!errors.maxUses} helperText={errors.maxUses || 'Total, across all customers'} inputProps={{ min: 1, step: 1 }} />
                </Box>
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 1, borderRadius: '10px', bgcolor: '#FBFAF7', border: '1px solid #F0EFEB' }}>
                    <Box>
                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>Active</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: '#8A877F' }}>Inactive codes are rejected at checkout</Typography>
                    </Box>
                    <Switch name="isActive" checked={formData.isActive} onChange={handleChange} inputProps={{ 'aria-label': 'Active' }} />
                </Stack>
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 1, borderRadius: '10px', bgcolor: '#FBFAF7', border: '1px solid #F0EFEB', mt: 1.5 }}>
                    <Box>
                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>Apply automatically</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: '#8A877F' }}>Applied at checkout when it&apos;s the customer&apos;s best code (they can remove it)</Typography>
                    </Box>
                    <Switch name="autoApply" checked={formData.autoApply} onChange={handleChange} inputProps={{ 'aria-label': 'Apply automatically' }} />
                </Stack>
            </FormDialog>
        </Box>
    );
};

export default AllDiscount;
