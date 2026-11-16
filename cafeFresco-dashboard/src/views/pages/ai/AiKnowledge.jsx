import { useContext, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Chip, InputAdornment, MenuItem, Paper, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { IconBook, IconSearch } from '@tabler/icons-react';
import { MainContext } from '../../context/index.jsx';
import { homeFor } from '../../../config/permissions';
import { apiFetch } from '../../../api/client';
import { useConfirm, useNotify } from '../../../contexts/NotifyContext';
import PageToolbar from 'ui-component/PageToolbar';
import EmptyState from 'ui-component/EmptyState';
import FormDialog from 'ui-component/FormDialog';
import ListFooter from 'ui-component/ListFooter';
import StatusPill from 'ui-component/StatusPill';
import ActionIcon from 'ui-component/ActionIcon';
import TableSkeleton from 'ui-component/TableSkeleton';

const EMPTY = { question: '', answer: '', tags: '', isActive: true };

// FAQ the assistant can quote. Drafts (off) are never used.
export default function AiKnowledge() {
    const { adminRole } = useContext(MainContext);
    const navigate = useNavigate();
    const notify = useNotify();
    const confirm = useConfirm();
    const [params, setParams] = useSearchParams();
    const [q, setQ] = useState('');
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(1);
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [dialog, setDialog] = useState(null); // null | {mode:'add'|'edit', id?}
    const [form, setForm] = useState(EMPTY);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [testQ, setTestQ] = useState('');
    const [testRes, setTestRes] = useState(null);

    const load = () => {
        setError('');
        apiFetch(`/knowledge?page=${page}&limit=10${q ? `&q=${encodeURIComponent(q)}` : ''}${status ? `&status=${status}` : ''}`).then(setData).catch((e) => setError(e.message));
    };
    useEffect(() => {
        const t = setTimeout(load, q ? 300 : 0);
        return () => clearTimeout(t);
    }, [page, q, status]); // eslint-disable-line react-hooks/exhaustive-deps

    // "Create FAQ" from Insights: ?new=<question> opens the add dialog prefilled
    useEffect(() => {
        const prefill = params.get('new');
        if (prefill) {
            setForm({ ...EMPTY, question: prefill.slice(0, 200) });
            setErrors({});
            setDialog({ mode: 'add' });
            params.delete('new');
            setParams(params, { replace: true });
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const openAdd = () => { setForm(EMPTY); setErrors({}); setDialog({ mode: 'add' }); };
    const openEdit = (e) => { setForm({ question: e.question, answer: e.answer, tags: (e.tags || []).join(', '), isActive: e.isActive }); setErrors({}); setDialog({ mode: 'edit', id: e._id }); };

    const save = async () => {
        const v = {};
        if (form.question.trim().length < 5) v.question = 'At least 5 characters';
        if (form.answer.trim().length < 2) v.answer = 'Write the answer customers should get';
        setErrors(v);
        if (Object.keys(v).length) return;
        setSaving(true);
        const body = { question: form.question, answer: form.answer, tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean), isActive: form.isActive };
        try {
            await apiFetch(dialog.mode === 'add' ? '/knowledge' : `/knowledge/${dialog.id}`, { method: dialog.mode === 'add' ? 'POST' : 'PUT', body });
            notify.success(dialog.mode === 'add' ? 'FAQ entry added' : 'FAQ entry saved');
            setDialog(null);
            load();
        } catch (err) {
            setErrors(err.data?.fields || {});
            notify.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const toggle = async (e) => {
        setBusyId(e._id);
        try {
            await apiFetch(`/knowledge/${e._id}`, { method: 'PUT', body: { isActive: !e.isActive } });
            setData((d) => ({ ...d, entries: d.entries.map((x) => (x._id === e._id ? { ...x, isActive: !e.isActive } : x)) }));
            notify.success(e.isActive ? 'Moved to drafts' : 'Published: the assistant can use it now');
        } catch (err) {
            notify.error(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const remove = async (e) => {
        if (!(await confirm({ title: 'Delete this FAQ entry?', message: e.question, confirmText: 'Delete', danger: true }))) return;
        setBusyId(e._id);
        try {
            await apiFetch(`/knowledge/${e._id}`, { method: 'DELETE' });
            notify.success('FAQ entry deleted');
            load();
        } catch (err) {
            notify.error(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const test = async () => {
        setTestRes(null);
        try {
            setTestRes(await apiFetch('/knowledge/test', { method: 'POST', body: { question: testQ } }));
        } catch (err) {
            setTestRes({ error: err.message });
        }
    };

    return (
        <Box>
            <PageToolbar onBack={() => navigate(homeFor(adminRole))} summary={data ? `${data.total} entr${data.total === 1 ? 'y' : 'ies'} · only published ones are used` : 'Loading…'} addLabel="Add" onAdd={openAdd}>
                <TextField size="small" placeholder="Search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={16} /></InputAdornment> }} />
                <TextField select size="small" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} slotProps={{ select: { displayEmpty: true } }} sx={{ minWidth: 130 }} aria-label="Status">
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="active">Published</MenuItem>
                    <MenuItem value="draft">Drafts</MenuItem>
                </TextField>
            </PageToolbar>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: '14px', mb: 2 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>Test a question</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                    <TextField size="small" fullWidth placeholder="e.g. Do you have parking?" value={testQ} onChange={(e) => setTestQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && test()} />
                    <Button variant="outlined" onClick={test} disabled={testQ.trim().length < 3}>Test</Button>
                </Stack>
                {testRes?.error && <Alert severity="error" sx={{ mt: 1 }}>{testRes.error}</Alert>}
                {testRes?.entries && (testRes.entries.length ? (
                    <Alert severity="success" sx={{ mt: 1 }}>The assistant would use: <b>{testRes.entries[0].question}</b></Alert>
                ) : (
                    <Alert severity="info" sx={{ mt: 1 }}>No published entry matches, so the assistant will say it doesn&apos;t know.</Alert>
                ))}
            </Paper>

            {error ? (
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>{error}</Alert>
            ) : !data ? (
                <TableSkeleton cols={4} />
            ) : data.entries.length === 0 ? (
                <Box display="flex" justifyContent="center" my={4}><EmptyState icon={IconBook} title="No FAQ entries" hint="Add answers to questions customers ask (parking, catering, halal…)." /></Box>
            ) : (
                <>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Question</TableCell>
                                <TableCell>Answer</TableCell>
                                <TableCell align="center">Published</TableCell>
                                <TableCell align="right" />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.entries.map((e) => (
                                <TableRow key={e._id} sx={{ opacity: busyId === e._id ? 0.55 : 1 }}>
                                    <TableCell sx={{ maxWidth: 280 }}>
                                        <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{e.question}</Typography>
                                        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                                            {!e.isActive && <StatusPill tone="warning" label="Draft" />}
                                            {(e.tags || []).map((t) => <Chip key={t} size="small" variant="outlined" label={t} />)}
                                        </Stack>
                                    </TableCell>
                                    <TableCell sx={{ maxWidth: 420 }}><Typography sx={{ fontSize: '0.8125rem', color: '#555' }} noWrap title={e.answer}>{e.answer}</Typography></TableCell>
                                    <TableCell align="center"><Switch size="small" checked={e.isActive} disabled={busyId === e._id} onChange={() => toggle(e)} inputProps={{ 'aria-label': `Published: ${e.question}` }} /></TableCell>
                                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                        <ActionIcon kind="edit" label={`Edit ${e.question}`} onClick={() => openEdit(e)} />
                                        <ActionIcon kind="delete" label={`Delete ${e.question}`} onClick={() => remove(e)} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <ListFooter page={data.page} totalPages={data.totalPages} total={data.total} perPage={10} onChange={setPage} />
                </>
            )}

            <FormDialog open={!!dialog} onClose={() => setDialog(null)} onSubmit={save} title={dialog?.mode === 'edit' ? 'Edit FAQ entry' : 'Add FAQ entry'} subtitle="The assistant quotes the answer word for word." icon={<IconBook size={20} />} saving={saving}>
                <Stack spacing={2}>
                    <TextField label="Question" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} inputProps={{ maxLength: 200 }} error={!!errors.question} helperText={errors.question} autoFocus fullWidth />
                    <TextField label="Answer" value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} inputProps={{ maxLength: 1500 }} error={!!errors.answer} helperText={errors.answer || `${form.answer.length}/1500 · plain text`} multiline minRows={4} fullWidth />
                    <TextField label="Tags (comma separated)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} fullWidth />
                    <Stack direction="row" sx={{ alignItems: 'center' }}>
                        <Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} inputProps={{ 'aria-label': 'Publish now' }} />
                        <Typography sx={{ fontSize: '0.875rem' }}>{form.isActive ? 'Published: the assistant can use it' : 'Draft: not used yet'}</Typography>
                    </Stack>
                </Stack>
            </FormDialog>
        </Box>
    );
}
