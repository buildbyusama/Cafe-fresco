import React, { useContext, useState, useEffect } from 'react';
import { Alert, Avatar, Box, Button, ButtonBase, IconButton, InputAdornment, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
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
import { IconCheck, IconEye, IconEyeOff, IconShieldLock, IconUserPlus } from '@tabler/icons-react';

const PER_PAGE = 10;
const ROLES = [
    { key: 'admin', label: 'Admin', desc: 'Everything, including team access and discount codes', bg: '#FDF1CC', fg: '#8A5A00' },
    { key: 'manager', label: 'Manager', desc: 'Orders, customers, staff, suppliers and reports', bg: '#E7F0FD', fg: '#1E5BB8' },
    { key: 'editor', label: 'Editor', desc: 'Products, categories and stock only', bg: '#EAF6EE', fg: '#2E7D4F' }
];
const roleOf = (k) => ROLES.find((r) => r.key === k) || ROLES[2];
const initials = (n = '') => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
const EMPTY = { name: '', email: '', password: '', role: 'editor' };

// same rules as the server's validatePassword
const pwRules = (p) => [
    { ok: p.length >= 8, text: 'At least 8 characters' },
    { ok: /[A-Za-z]/.test(p) && /[0-9]/.test(p), text: 'A letter and a number' }
];

function RolePicker({ value, onChange }) {
    return (
        <Box role="radiogroup" aria-label="Role" sx={{ display: 'grid', gap: 1 }}>
            {ROLES.map((r) => {
                const on = value === r.key;
                return (
                    <ButtonBase
                        key={r.key}
                        role="radio"
                        aria-checked={on}
                        onClick={() => onChange(r.key)}
                        sx={{
                            justifyContent: 'flex-start',
                            textAlign: 'left',
                            gap: 1.5,
                            p: 1.5,
                            borderRadius: '12px',
                            fontFamily: 'inherit',
                            border: `1.5px solid ${on ? '#F5B400' : '#E9E7E1'}`,
                            bgcolor: on ? '#FFFBF0' : '#FFF',
                            transition: 'all .15s',
                            '&:hover': { borderColor: on ? '#F5B400' : '#D6D3CB' }
                        }}
                    >
                        <Box sx={{ width: 32, height: 32, borderRadius: '9px', bgcolor: r.bg, color: r.fg, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.8125rem', flexShrink: 0 }}>{r.label[0]}</Box>
                        <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#111' }}>{r.label}</Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: '#6B6B6B' }}>{r.desc}</Typography>
                        </Box>
                        <Box sx={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${on ? '#F5B400' : '#D6D3CB'}`, bgcolor: on ? '#F5B400' : 'transparent', color: '#1A1A1A', display: 'grid', placeItems: 'center' }}>
                            {on && <IconCheck size={12} stroke={3} />}
                        </Box>
                    </ButtonBase>
                );
            })}
        </Box>
    );
}

const AllPermission = () => {
    const navigate = useNavigate();
    const { adminRole, adminEmail } = useContext(MainContext);
    const notify = useNotify();
    const confirm = useConfirm();
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [team, setTeam] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [adding, setAdding] = useState(false);
    const [formData, setFormData] = useState(EMPTY);
    const [showPw, setShowPw] = useState(false);
    const [errors, setErrors] = useState({});
    const [editing, setEditing] = useState(null); // { email, name, role, from }
    const [saving, setSaving] = useState(false);
    const [busy, setBusy] = useState(null);
    const canManage = can(adminRole, 'permission.manage');

    const fetchPermission = async () => {
        setLoadError('');
        try {
            setTeam(await apiFetch('/admin/all'));
        } catch (err) {
            setLoadError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPermission();
    }, []);

    const totalPages = Math.max(1, Math.ceil(team.length / PER_PAGE));
    const first = (currentPage - 1) * PER_PAGE;
    const visible = team.slice(first, first + PER_PAGE);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
    };

    const openAdd = () => {
        setFormData(EMPTY);
        setErrors({});
        setShowPw(false);
        setAdding(true);
    };

    const handleAdd = async () => {
        const e = {};
        if (formData.name.trim().length < 2) e.name = 'Enter at least 2 characters';
        if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) e.email = 'Enter a valid email';
        if (pwRules(formData.password).some((r) => !r.ok)) e.password = 'Password does not meet the rules below';
        if (Object.keys(e).length) return setErrors(e);
        setSaving(true);
        try {
            await apiFetch('/admin/create-permission', { method: 'POST', body: { ...formData, name: formData.name.trim(), email: formData.email.trim() } });
            notify.success(`${formData.name.trim()} can now sign in as ${roleOf(formData.role).label.toLowerCase()}`);
            setAdding(false);
            await fetchPermission();
        } catch (err) {
            if (err.data?.fields) setErrors(err.data.fields);
            notify.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleEditRole = async () => {
        if (editing.role === editing.from) return setEditing(null);
        setSaving(true);
        try {
            await apiFetch('/admin/update-permission', { method: 'POST', body: { email: editing.email, role: editing.role } });
            notify.success(`${editing.name} is now ${roleOf(editing.role).label.toLowerCase()}`);
            setEditing(null);
            await fetchPermission();
        } catch (err) {
            notify.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (a) => {
        if (!(await confirm({ title: `Remove access for ${a.name}?`, message: `${a.email} will be signed out and can no longer open the dashboard.`, confirmText: 'Remove', danger: true }))) return;
        setBusy(a.email);
        try {
            await apiFetch('/admin/delete-permission', { method: 'DELETE', body: { email: a.email } });
            notify.success('Access removed');
            await fetchPermission();
        } catch (err) {
            notify.error(err.message);
        } finally {
            setBusy(null);
        }
    };

    // Other admins reset their own password through the forgot-password email
    const handleSendReset = async (a) => {
        if (!(await confirm({ title: `Send a password reset link to ${a.email}?`, confirmText: 'Send link' }))) return;
        setBusy(a.email);
        try {
            await apiFetch('/admin/forgot-password', { method: 'POST', body: { email: a.email } });
            notify.success(`Reset link sent to ${a.email}`);
        } catch (err) {
            notify.error(err.message);
        } finally {
            setBusy(null);
        }
    };

    const counts = ROLES.map((r) => `${team.filter((a) => a.role === r.key).length} ${r.label.toLowerCase()}${team.filter((a) => a.role === r.key).length === 1 ? '' : 's'}`).join(' · ');

    return (
        <Box>
            <PageToolbar onBack={() => navigate(homeFor(adminRole))} summary={loading ? 'Loading…' : counts} addLabel="Add Role" onAdd={canManage ? openAdd : undefined} />

            {loading ? (
                <TableSkeleton cols={5} rows={4} />
            ) : loadError ? (
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={fetchPermission}>Retry</Button>}>{loadError}</Alert>
            ) : team.length === 0 ? (
                <Box display="flex" justifyContent="center" my={4}>
                    <EmptyState title="No team members found" hint="Use Add Role to give someone access to the dashboard." />
                </Box>
            ) : (
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ width: 56, pl: 2.5 }}>No</TableCell>
                                <TableCell>Member</TableCell>
                                <TableCell>Role</TableCell>
                                <TableCell align="right" sx={{ pr: 2.5 }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {visible.map((a, index) => {
                                const r = roleOf(a.role);
                                const me = a.email === adminEmail;
                                const locked = !canManage || a.isRoot || me;
                                return (
                                    <TableRow key={a._id} sx={{ opacity: busy === a.email ? 0.55 : 1, transition: 'opacity .15s' }}>
                                        <TableCell sx={{ pl: 2.5, color: '#8A8A8A' }}>{first + index + 1}</TableCell>
                                        <TableCell>
                                            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                                                <Avatar sx={{ width: 36, height: 36, fontSize: '0.8125rem', fontWeight: 700, bgcolor: r.bg, color: r.fg }}>{initials(a.name)}</Avatar>
                                                <Box sx={{ minWidth: 0 }}>
                                                    <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                                                        {a.name}
                                                        {me && <Box component="span" sx={{ ml: 1, px: 0.75, py: 0.1, borderRadius: '6px', bgcolor: '#F4F3EF', fontSize: '0.6875rem', fontWeight: 700, color: '#55534E' }}>You</Box>}
                                                        {a.isRoot && <Box component="span" sx={{ ml: 1, px: 0.75, py: 0.1, borderRadius: '6px', bgcolor: '#FDECEC', fontSize: '0.6875rem', fontWeight: 700, color: '#B42318' }}>Root</Box>}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '0.75rem', color: '#8A877F' }}>{a.email}</Typography>
                                                </Box>
                                            </Stack>
                                        </TableCell>
                                        <TableCell>
                                            <Box component="span" sx={{ px: 1.25, py: 0.4, borderRadius: '999px', fontSize: '0.8125rem', fontWeight: 600, bgcolor: r.bg, color: r.fg }}>{r.label}</Box>
                                        </TableCell>
                                        <TableCell sx={{ pr: 2.5 }} align="right">
                                            <ActionIcon kind="edit" disabled={locked} onClick={() => setEditing({ email: a.email, name: a.name, role: a.role, from: a.role })} />
                                            <ActionIcon kind="delete" disabled={locked || busy === a.email} onClick={() => handleDelete(a)} />
                                            <ActionIcon kind="reset" disabled={me || busy === a.email} onClick={() => handleSendReset(a)} />
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {!loading && !loadError && <ListFooter page={currentPage} totalPages={totalPages} total={team.length} onChange={setCurrentPage} />}

            <FormDialog
                open={adding}
                onClose={() => setAdding(false)}
                onSubmit={handleAdd}
                saving={saving}
                icon={<IconUserPlus size={20} />}
                title="Add team member"
                subtitle="They sign in to this dashboard with the email and password you set."
                submitText="Add"
            >
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                    <TextField name="name" label="Name" required autoFocus value={formData.name} onChange={handleChange} error={!!errors.name} helperText={errors.name} />
                    <TextField name="email" label="Email" required type="email" value={formData.email} onChange={handleChange} error={!!errors.email} helperText={errors.email} />
                </Box>
                <Box>
                    <TextField
                        name="password"
                        label="Password"
                        required
                        type={showPw ? 'text' : 'password'}
                        value={formData.password}
                        onChange={handleChange}
                        error={!!errors.password}
                        autoComplete="new-password"
                        fullWidth
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton aria-label={showPw ? 'Hide password' : 'Show password'} onClick={() => setShowPw((s) => !s)} edge="end" size="small">
                                        {showPw ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                                    </IconButton>
                                </InputAdornment>
                            )
                        }}
                    />
                    <Stack direction="row" spacing={2} sx={{ mt: 0.75, ml: 0.5 }}>
                        {pwRules(formData.password).map((rule) => (
                            <Stack key={rule.text} direction="row" spacing={0.5} sx={{ alignItems: 'center', color: rule.ok ? '#2E7D4F' : errors.password ? '#D32F2F' : '#8A877F', fontSize: '0.75rem', transition: 'color .15s' }}>
                                <IconCheck size={14} stroke={rule.ok ? 3 : 1.5} />
                                <span>{rule.text}</span>
                            </Stack>
                        ))}
                    </Stack>
                </Box>
                <RolePicker value={formData.role} onChange={(role) => setFormData((p) => ({ ...p, role }))} />
            </FormDialog>

            <FormDialog
                open={!!editing}
                onClose={() => setEditing(null)}
                onSubmit={handleEditRole}
                saving={saving}
                icon={<IconShieldLock size={20} />}
                title={`Change role for ${editing?.name || ''}`}
                subtitle={editing?.email}
                submitText="Update"
                submitDisabled={editing?.role === editing?.from}
            >
                <RolePicker value={editing?.role} onChange={(role) => setEditing((e) => ({ ...e, role }))} />
                <Typography sx={{ fontSize: '0.75rem', color: '#8A877F' }}>The change applies on their next click — no need to sign out.</Typography>
            </FormDialog>
        </Box>
    );
};

export default AllPermission;
