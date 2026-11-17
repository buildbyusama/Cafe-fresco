import { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Drawer, IconButton, LinearProgress, Paper, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import { IconFileText, IconRefresh, IconReplace, IconTrash, IconUpload, IconX } from '@tabler/icons-react';
import { MainContext } from '../../context/index.jsx';
import { homeFor } from '../../../config/permissions';
import { apiFetch } from '../../../api/client';
import { useConfirm, useNotify } from '../../../contexts/NotifyContext';
import PageToolbar from 'ui-component/PageToolbar';
import EmptyState from 'ui-component/EmptyState';
import StatusPill from 'ui-component/StatusPill';
import TableSkeleton from 'ui-component/TableSkeleton';

const ACCEPT = '.pdf,.docx,.txt,.md';
const OK_EXT = /\.(pdf|docx|txt|md)$/i;
const TYPE = { 'application/pdf': 'PDF', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word', 'text/plain': 'Text', 'text/markdown': 'Markdown' };
const PRIVACY = { email: 'email addresses', phone: 'phone numbers', card: 'card-like numbers', cnic: 'CNIC numbers' };
const size = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const flagsText = (flags = []) => flags.map((f) => `${f.count} ${PRIVACY[f.type] || f.type}`).join(', ');

function Status({ d }) {
    if (d.status === 'processing') return <StatusPill tone="neutral" label="Processing…" />;
    if (d.status === 'failed') return <StatusPill tone="danger" label="Failed" />;
    return <StatusPill tone={d.error ? 'warning' : 'success'} label="Ready" />;
}

// Documents the assistant can answer from (docs/RAG_PLAN.md R4.1). Only published, ready documents are used.
export default function AiDocuments() {
    const { adminRole } = useContext(MainContext);
    const navigate = useNavigate();
    const notify = useNotify();
    const confirm = useConfirm();
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [title, setTitle] = useState('');
    const [uploading, setUploading] = useState(false);
    const [drag, setDrag] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [detail, setDetail] = useState(null);
    const [testQ, setTestQ] = useState('');
    const [testRes, setTestRes] = useState(null);
    const [testing, setTesting] = useState(false);
    const pickRef = useRef(null);
    const replaceRef = useRef(null);
    const replaceFor = useRef(null);
    const busy = useRef(false); // one upload at a time, even on a double click

    const load = () => apiFetch('/documents').then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message));
    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // poll every 3 s only while something is processing; stops when settled or on leaving the page
    const processing = data?.documents.some((d) => d.status === 'processing');
    useEffect(() => {
        if (!processing) return undefined;
        const t = setInterval(load, 3000);
        return () => clearInterval(t);
    }, [processing]); // eslint-disable-line react-hooks/exhaustive-deps

    const maxMb = data?.limits.maxFileMb || 10;
    const checkFile = (file) => {
        if (!OK_EXT.test(file.name)) return 'Use a PDF, Word (.docx), text or Markdown file.';
        if (file.size > maxMb * 1024 * 1024) return `Files must be under ${maxMb} MB. Split bigger documents into parts.`; // same words as the server
        return null;
    };

    const send = async (file, path, extra = {}) => {
        if (busy.current) return;
        const problem = checkFile(file);
        if (problem) { notify.error(problem); return; }
        busy.current = true;
        setUploading(true);
        const form = new FormData();
        form.append('file', file);
        Object.entries(extra).forEach(([k, v]) => v && form.append(k, v));
        try {
            const r = await apiFetch(path, { method: 'POST', formData: form });
            if (r.document?.status === 'failed') notify.error(r.document.error || 'Processing failed');
            else if (r.document?.error) notify.warning(r.document.error);
            else notify.success(r.message || 'Uploaded');
            setTitle('');
            load();
        } catch (err) {
            notify.error(err.message);
        } finally {
            busy.current = false;
            setUploading(false);
        }
    };

    const upload = (file) => file && send(file, '/documents', { title: title.trim() });
    const replace = (file) => file && replaceFor.current && send(file, `/documents/${replaceFor.current._id}/replace`);

    const patch = async (d, body, done) => {
        setBusyId(d._id);
        try {
            const r = await apiFetch(`/documents/${d._id}`, { method: 'PUT', body });
            setData((x) => ({ ...x, documents: x.documents.map((y) => (y._id === d._id ? r.document : y)) }));
            notify.success(done);
        } catch (err) {
            if (err.data?.needsConfirmation) {
                const ok = await confirm({ title: 'This document may contain personal data', message: `It looks like it contains ${flagsText(err.data.privacyFlags)}. Customers could see this text in answers. Publish anyway?`, confirmText: 'Publish anyway', danger: true });
                setBusyId(null);
                if (ok) return patch(d, { ...body, confirmPrivacy: true }, done);
                return undefined;
            }
            notify.error(err.message);
        } finally {
            setBusyId(null);
        }
        return undefined;
    };

    const togglePublish = (d) => patch(d, { isPublished: !d.isPublished }, d.isPublished ? 'Unpublished: the assistant no longer uses it' : 'Published: the assistant can use it now');

    const reindex = async (d) => {
        setBusyId(d._id);
        try {
            notify.success((await apiFetch(`/documents/${d._id}/reindex`, { method: 'POST' })).message);
            load();
        } catch (err) {
            notify.error(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const remove = async (d) => {
        if (!(await confirm({ title: 'Delete this document?', message: `"${d.title}" and everything the assistant learned from it will be removed.`, confirmText: 'Delete', danger: true }))) return;
        setBusyId(d._id);
        try {
            await apiFetch(`/documents/${d._id}`, { method: 'DELETE' });
            notify.success('Document deleted');
            if (detail?.document._id === d._id) setDetail(null);
            load();
        } catch (err) {
            notify.error(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const open = async (d) => {
        try {
            setDetail(await apiFetch(`/documents/${d._id}`));
        } catch (err) {
            notify.error(err.message);
        }
    };

    const test = async () => {
        setTesting(true);
        setTestRes(null);
        try {
            setTestRes(await apiFetch('/documents/test', { method: 'POST', body: { question: testQ } }));
        } catch (err) {
            setTestRes({ error: err.message });
        } finally {
            setTesting(false);
        }
    };

    const limits = data?.limits;
    return (
        <Box>
            <PageToolbar onBack={() => navigate(homeFor(adminRole))} summary={limits ? `${limits.documents} of ${limits.maxDocs} documents · ${limits.passages.toLocaleString()} of ${limits.maxPassages.toLocaleString()} passages · only published ones are used` : 'Loading…'} />

            <Paper
                variant="outlined"
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files?.[0]); }}
                sx={{ p: 2, borderRadius: '14px', mb: 2, borderStyle: 'dashed', borderWidth: 2, borderColor: drag ? 'primary.main' : 'divider', bgcolor: drag ? 'rgba(232,38,43,0.04)' : 'transparent' }}
            >
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'center' } }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>Upload a document</Typography>
                        <Typography sx={{ fontSize: '0.8rem', color: '#6b6860' }}>PDF, Word, text or Markdown, under {maxMb} MB. Drop a file here or choose one. New documents start as drafts.</Typography>
                    </Box>
                    <TextField size="small" label="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} inputProps={{ maxLength: 80 }} sx={{ minWidth: { md: 240 } }} />
                    <Button variant="contained" startIcon={<IconUpload size={18} />} disabled={uploading} onClick={() => pickRef.current?.click()}>{uploading ? 'Processing…' : 'Choose file'}</Button>
                    <input ref={pickRef} type="file" accept={ACCEPT} hidden data-testid="doc-file" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
                    <input ref={replaceRef} type="file" accept={ACCEPT} hidden data-testid="doc-replace" onChange={(e) => { replace(e.target.files?.[0]); e.target.value = ''; }} />
                </Stack>
                {uploading && <LinearProgress sx={{ mt: 1.5 }} />}
                <Alert severity="info" icon={false} sx={{ mt: 1.5, py: 0, fontSize: '0.78rem' }}>Don&apos;t upload staff lists, customer data or anything private: published text can appear in the assistant&apos;s answers.</Alert>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: '14px', mb: 2 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>Test a question</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                    <TextField size="small" fullWidth placeholder="e.g. How early should I book wedding catering?" value={testQ} onChange={(e) => setTestQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && testQ.trim().length >= 2 && test()} inputProps={{ 'aria-label': 'Test question' }} />
                    <Button variant="outlined" onClick={test} disabled={testQ.trim().length < 2 || testing}>Test</Button>
                </Stack>
                {testRes?.error && <Alert severity="error" sx={{ mt: 1 }}>{testRes.error}</Alert>}
                {testRes?.passages && (testRes.passages.length ? (
                    <Stack spacing={1} sx={{ mt: 1 }} data-testid="test-results">
                        {testRes.passages.map((p, i) => (
                            <Box key={i} sx={{ p: 1.25, borderRadius: '10px', bgcolor: '#F6F5F2' }}>
                                <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, overflowWrap: 'anywhere' }}>{p.source}{p.heading ? ` › ${p.heading}` : ''} <Box component="span" sx={{ fontWeight: 400, color: '#8A877F' }}>· score {p.score}</Box></Typography>
                                <Typography sx={{ fontSize: '0.8rem', color: '#444', mt: 0.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.text}</Typography>
                            </Box>
                        ))}
                    </Stack>
                ) : (
                    <Alert severity="info" sx={{ mt: 1 }}>No published document covers this, so the assistant will say it doesn&apos;t know.</Alert>
                ))}
            </Paper>

            {error ? (
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>{error}</Alert>
            ) : !data ? (
                <TableSkeleton cols={5} />
            ) : data.documents.length === 0 ? (
                <Box display="flex" justifyContent="center" my={4}><EmptyState icon={IconFileText} title="No documents yet" hint="Upload your catering guide, event packages or policies, then publish them." /></Box>
            ) : (
                <Box sx={{ overflowX: 'auto' }}>
                    <Table sx={{ minWidth: 640 }}>
                        <TableHead>
                            <TableRow>
                                <TableCell>Document</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell align="center">Published</TableCell>
                                <TableCell align="right" />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.documents.map((d) => (
                                <TableRow key={d._id} hover sx={{ opacity: busyId === d._id ? 0.55 : 1 }} data-testid="doc-row">
                                    <TableCell sx={{ maxWidth: 320 }}>
                                        <Typography component="button" type="button" onClick={() => open(d)} sx={{ all: 'unset', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }} title={d.title}>{d.title}</Typography>
                                        <Typography sx={{ fontSize: '0.75rem', color: '#8A877F' }}>{[TYPE[d.mime] || 'File', size(d.sizeBytes), d.pages ? `${d.pages} page${d.pages === 1 ? '' : 's'}` : null, `${d.chunkCount} passage${d.chunkCount === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</Typography>
                                    </TableCell>
                                    <TableCell sx={{ maxWidth: 260 }}>
                                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                                            <Status d={d} />
                                            {d.privacyFlags?.length > 0 && <Tooltip title={`May contain ${flagsText(d.privacyFlags)}`}><span><StatusPill tone="warning" label="Personal data?" /></span></Tooltip>}
                                        </Stack>
                                        {d.error && <Typography sx={{ fontSize: '0.75rem', color: d.status === 'failed' ? '#C62828' : '#8A6D00', mt: 0.5 }} data-testid="doc-error">{d.error}</Typography>}
                                    </TableCell>
                                    <TableCell align="center">
                                        <Switch size="small" checked={d.isPublished} disabled={!d.servingVersion || busyId === d._id} onChange={() => togglePublish(d)} inputProps={{ 'aria-label': `Published: ${d.title}` }} />
                                    </TableCell>
                                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                        <Tooltip title="Replace file"><span><IconButton size="small" aria-label={`Replace file: ${d.title}`} disabled={d.status === 'processing' || uploading} onClick={() => { replaceFor.current = d; replaceRef.current?.click(); }}><IconReplace size={18} /></IconButton></span></Tooltip>
                                        <Tooltip title="Re-index"><span><IconButton size="small" aria-label={`Re-index: ${d.title}`} disabled={!d.servingVersion || busyId === d._id} onClick={() => reindex(d)}><IconRefresh size={18} /></IconButton></span></Tooltip>
                                        <Tooltip title="Delete"><span><IconButton size="small" aria-label={`Delete: ${d.title}`} disabled={busyId === d._id} onClick={() => remove(d)}><IconTrash size={18} /></IconButton></span></Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Box>
            )}

            <Drawer anchor="right" open={!!detail} onClose={() => setDetail(null)} PaperProps={{ sx: { width: { xs: '100%', sm: 440 }, p: 2 } }}>
                {detail && (
                    <Stack spacing={1.5}>
                        <Stack direction="row" sx={{ alignItems: 'flex-start' }}>
                            <Typography sx={{ fontWeight: 700, flex: 1, overflowWrap: 'anywhere' }}>{detail.document.title}</Typography>
                            <IconButton size="small" aria-label="Close" onClick={() => setDetail(null)}><IconX size={18} /></IconButton>
                        </Stack>
                        <Typography sx={{ fontSize: '0.78rem', color: '#8A877F', overflowWrap: 'anywhere' }}>{detail.document.fileName} · version {detail.document.servingVersion}</Typography>
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 700 }}>First passages</Typography>
                        {detail.preview.length === 0 ? <Typography sx={{ fontSize: '0.8rem' }}>No text yet.</Typography> : detail.preview.map((p, i) => (
                            <Box key={i} sx={{ p: 1.25, borderRadius: '10px', bgcolor: '#F6F5F2' }}>
                                {p.heading && <Typography sx={{ fontSize: '0.78rem', fontWeight: 700 }}>{p.heading}</Typography>}
                                <Typography sx={{ fontSize: '0.8rem', color: '#444', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{p.text}</Typography>
                            </Box>
                        ))}
                    </Stack>
                )}
            </Drawer>
        </Box>
    );
}
