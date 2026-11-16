import React, { useContext, useState, useEffect } from 'react';
import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, FormControlLabel, Switch, Typography } from '@mui/material';
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
import { IconBuildingCommunity } from '@tabler/icons-react';

const PER_PAGE = 10;
const EMPTY = { name: '', description: '', isActive: true };

const Department = () => {
    const { adminRole, departments, fetchDepartments } = useContext(MainContext);
    const navigate = useNavigate();
    const notify = useNotify();
    const confirm = useConfirm();
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const list = departments || [];
    const [dialog, setDialog] = useState(null); // null | { mode: 'add' } | { mode: 'edit', id }
    const [formData, setFormData] = useState(EMPTY);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState(null); // row being toggled / deleted

    useEffect(() => {
        fetchDepartments().finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const totalPages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);
    const first = (currentPage - 1) * PER_PAGE;
    const visible = list.slice(first, first + PER_PAGE);

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

    const openEdit = (item) => {
        setFormData({ name: item.name || '', description: item.description || '', isActive: item.isActive !== false });
        setErrors({});
        setDialog({ mode: 'edit', id: item._id });
    };

    const handleSave = async () => {
        if (formData.name.trim().length < 2) return setErrors({ name: 'Enter at least 2 characters' });
        setSaving(true);
        try {
            const body = { name: formData.name.trim(), description: formData.description.trim(), isActive: formData.isActive };
            if (dialog.mode === 'edit') await apiFetch(`/department/update/${dialog.id}`, { method: 'PUT', body });
            else await apiFetch('/department/add', { method: 'POST', body });
            notify.success(dialog.mode === 'edit' ? 'Department updated' : 'Department added');
            setDialog(null);
            await fetchDepartments();
        } catch (err) {
            if (err.data?.fields) setErrors(err.data.fields);
            notify.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    // Status switch saves straight away for that row only (no shared form state)
    const toggleActive = async (item, isActive) => {
        setBusyId(item._id);
        try {
            await apiFetch(`/department/update/${item._id}`, { method: 'PUT', body: { name: item.name, description: item.description || '', isActive } });
            notify.success(`${item.name} ${isActive ? 'activated' : 'deactivated'}`);
            await fetchDepartments();
        } catch (err) {
            notify.error(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (item) => {
        if (!(await confirm({ title: `Delete "${item.name}"?`, message: 'Departments that still have employees cannot be deleted.', confirmText: 'Delete', danger: true }))) return;
        setBusyId(item._id);
        try {
            await apiFetch(`/department/delete/${item._id}`, { method: 'DELETE' });
            notify.success('Department deleted');
            await fetchDepartments();
        } catch (err) {
            notify.error(err.message);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <Box>
            <PageToolbar
                onBack={() => navigate(homeFor(adminRole))}
                summary={loading ? 'Loading…' : `${list.length} ${list.length === 1 ? 'department' : 'departments'}`}
                addLabel="Add"
                onAdd={openAdd}
            />

            {loading ? (
                <TableSkeleton cols={5} />
            ) : list.length === 0 ? (
                <Box display="flex" justifyContent="center" my={4}>
                    <EmptyState title="No departments yet" hint="Use Add to create your first department." />
                </Box>
            ) : (
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ width: 64, pl: 2.5 }}>No</TableCell>
                                <TableCell>Name</TableCell>
                                <TableCell align="center">Status</TableCell>
                                <TableCell align="center">Employees</TableCell>
                                <TableCell align="right" sx={{ pr: 2.5 }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {visible.map((item, index) => (
                                <TableRow key={item._id} sx={{ opacity: busyId === item._id ? 0.55 : 1, transition: 'opacity .15s' }}>
                                    <TableCell sx={{ pl: 2.5, color: '#8A8A8A' }}>{first + index + 1}</TableCell>
                                    <TableCell>
                                        <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.name}</Typography>
                                        {item.description && (
                                            <Typography noWrap sx={{ fontSize: '0.75rem', color: '#8A877F', maxWidth: 360 }} title={item.description}>
                                                {item.description}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell align="center">
                                        <Switch
                                            checked={item.isActive !== false}
                                            disabled={busyId === item._id}
                                            onChange={(e) => toggleActive(item, e.target.checked)}
                                            inputProps={{ 'aria-label': `${item.name} active` }}
                                        />
                                    </TableCell>
                                    <TableCell align="center">{item.employeeCount ?? 0}</TableCell>
                                    <TableCell sx={{ pr: 2.5 }} align="right">
                                        <ActionIcon kind="edit" onClick={() => openEdit(item)} />
                                        <ActionIcon kind="delete" disabled={!can(adminRole, 'department.delete') || busyId === item._id} onClick={() => handleDelete(item)} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {!loading && <ListFooter page={currentPage} totalPages={totalPages} total={list.length} onChange={setCurrentPage} />}

            <FormDialog
                open={!!dialog}
                onClose={() => setDialog(null)}
                onSubmit={handleSave}
                saving={saving}
                icon={<IconBuildingCommunity size={20} />}
                title={dialog?.mode === 'edit' ? 'Edit department' : 'Add department'}
                subtitle={dialog?.mode === 'edit' ? 'Change the name, description or status.' : 'Group employees by the team they work in.'}
                submitText={dialog?.mode === 'edit' ? 'Update' : 'Add'}
            >
                <TextField name="name" label="Name" required autoFocus value={formData.name} onChange={handleChange} error={!!errors.name} helperText={errors.name} inputProps={{ maxLength: 60 }} fullWidth />
                <TextField name="description" label="Description" multiline rows={3} value={formData.description} onChange={handleChange} helperText={`Optional · ${formData.description.length}/300`} inputProps={{ maxLength: 300 }} fullWidth />
                <FormControlLabel control={<Switch name="isActive" checked={formData.isActive} onChange={handleChange} />} label="Active" />
            </FormDialog>
        </Box>
    );
};

export default Department;
