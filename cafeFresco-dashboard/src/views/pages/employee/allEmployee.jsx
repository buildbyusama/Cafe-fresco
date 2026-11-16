import React, { useContext, useState, useEffect } from 'react';
import { TextField, MenuItem, Select, FormControl, InputLabel, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Alert, Stack, Typography, Avatar, InputAdornment, LinearProgress } from '@mui/material';
import { MainContext } from '../../context/index.jsx';
import { can } from '../../../config/permissions';
import { useNavigate } from 'react-router';
import { apiFetch } from '../../../api/client';
import { useConfirm, useNotify } from '../../../contexts/NotifyContext';
import ActionIcon from 'ui-component/ActionIcon';
import EmptyState from 'ui-component/EmptyState';
import ListFooter from 'ui-component/ListFooter';
import StatusPill from 'ui-component/StatusPill';
import TableSkeleton from 'ui-component/TableSkeleton';
import { IconPlus, IconSearch } from '@tabler/icons-react';

const PER_PAGE = 10;
const initials = (n = '') => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';

const EmployeeList = () => {
    const [employees, setEmployees] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [debounced, setDebounced] = useState('');
    const [dpFilter, setDpFilter] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [firstLoad, setFirstLoad] = useState(true);
    const [error, setError] = useState('');
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [reloadKey, setReloadKey] = useState(0);
    const [busyId, setBusyId] = useState(null);
    const { departments, adminRole } = useContext(MainContext);
    const navigate = useNavigate();
    const notify = useNotify();
    const confirm = useConfirm();

    useEffect(() => {
        const t = setTimeout(() => setDebounced(searchTerm.trim()), 400);
        return () => clearTimeout(t);
    }, [searchTerm]);

    // one fetch per change; an older response can never overwrite a newer one
    useEffect(() => {
        const controller = new AbortController();
        const params = new URLSearchParams({ page: String(currentPage), limit: String(PER_PAGE), search: debounced });
        if (dpFilter !== 'All') params.set('department', dpFilter);
        setLoading(true);
        setError('');
        apiFetch(`/employee/fetch?${params}`, { signal: controller.signal })
            .then((data) => {
                setEmployees(data.employees || []);
                setTotal(data.total || 0);
                setTotalPages(Math.max(1, data.totalPages || 1));
            })
            .catch((err) => { if (err.name !== 'AbortError') setError(err.message); })
            .finally(() => { if (!controller.signal.aborted) { setLoading(false); setFirstLoad(false); } });
        return () => controller.abort();
    }, [debounced, dpFilter, currentPage, reloadKey]);

    const handleDelete = async (e) => {
        if (!(await confirm({ title: `Delete ${e.name}?`, message: 'Their record is removed for good.', confirmText: 'Delete', danger: true }))) return;
        setBusyId(e._id);
        try {
            const data = await apiFetch(`/employee/delete/${e._id}`, { method: 'DELETE' });
            notify.success(data?.message || 'Employee deleted');
            setReloadKey((k) => k + 1);
        } catch (err) {
            notify.error(err.message);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <Box>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2.5, mt: 0.5, alignItems: { md: 'center' } }}>
                <TextField
                    size="small"
                    label="Search name, CNIC or email"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={18} color="#8A8A8A" /></InputAdornment> }}
                    sx={{ minWidth: { md: 300 } }}
                />
                <FormControl size="small" sx={{ minWidth: 190 }}>
                    <InputLabel id="department-select-label">Department</InputLabel>
                    <Select labelId="department-select-label" value={dpFilter} label="Department" onChange={(e) => { setDpFilter(e.target.value); setCurrentPage(1); }}>
                        <MenuItem value="All">All departments</MenuItem>
                        {(departments || []).map((d) => (
                            <MenuItem key={d._id} value={d._id}>{d.name}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <Box sx={{ flex: 1 }} />
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    {!firstLoad && !error && <Typography sx={{ fontSize: '0.875rem', color: '#6B6B6B', whiteSpace: 'nowrap' }}>{total} {total === 1 ? 'employee' : 'employees'}</Typography>}
                    <Button variant="contained" startIcon={<IconPlus size={18} />} onClick={() => navigate('/admin/employee/add')} sx={{ whiteSpace: 'nowrap' }}>Add employee</Button>
                </Stack>
            </Stack>

            {loading && firstLoad ? (
                <TableSkeleton cols={7} />
            ) : error ? (
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>}>{error}</Alert>
            ) : employees.length === 0 ? (
                <Box display="flex" justifyContent="center" my={4}>
                    <EmptyState title="No employees found" hint="Try another department or search, or add an employee." />
                </Box>
            ) : (
                <>
                    <TableContainer sx={{ position: 'relative', opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }} aria-busy={loading}>
                        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2, height: 3 }} />}
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ width: 56, pl: 2.5 }}>No</TableCell>
                                    <TableCell>Employee</TableCell>
                                    <TableCell>CNIC</TableCell>
                                    <TableCell>Phone</TableCell>
                                    <TableCell>Department</TableCell>
                                    <TableCell align="center">Status</TableCell>
                                    <TableCell align="right" sx={{ pr: 2.5 }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {employees.map((e, index) => (
                                    <TableRow key={e._id} sx={{ opacity: busyId === e._id ? 0.55 : 1, transition: 'opacity .15s' }}>
                                        {/* numbering from the fixed page size (was the current page's length, wrong on the last page) */}
                                        <TableCell sx={{ pl: 2.5, color: '#8A8A8A' }}>{(currentPage - 1) * PER_PAGE + index + 1}</TableCell>
                                        <TableCell>
                                            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                                                <Avatar sx={{ width: 34, height: 34, fontSize: '0.75rem', fontWeight: 700, bgcolor: '#FFF3D1', color: '#8A5A00' }}>{initials(e.name)}</Avatar>
                                                <Box sx={{ minWidth: 0 }}>
                                                    <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{e.name}</Typography>
                                                    <Typography sx={{ fontSize: '0.75rem', color: '#8A877F' }}>{[e.position, e.email].filter(Boolean).join(' · ')}</Typography>
                                                </Box>
                                            </Stack>
                                        </TableCell>
                                        <TableCell sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{e.cnic}</TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{e.phone || '—'}</TableCell>
                                        <TableCell>{e.department?.name ? <Box component="span" sx={{ px: 1, py: 0.4, borderRadius: '6px', bgcolor: '#F4F3EF', fontSize: '0.8125rem', fontWeight: 500 }}>{e.department.name}</Box> : <span style={{ color: '#B5B3AC' }}>—</span>}</TableCell>
                                        <TableCell align="center"><StatusPill status={e.isActive ? 'active' : 'inactive'} /></TableCell>
                                        <TableCell align="right" sx={{ pr: 2.5 }}>
                                            <ActionIcon kind="edit" onClick={() => navigate(`/admin/edit-employee/${e._id}`, { state: { employee: e } })} />
                                            <ActionIcon kind="delete" disabled={!can(adminRole, 'employee.delete') || busyId === e._id} onClick={() => handleDelete(e)} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <ListFooter page={currentPage} totalPages={totalPages} total={total} onChange={setCurrentPage} disabled={loading} />
                </>
            )}
        </Box>
    );
};

export default EmployeeList;
