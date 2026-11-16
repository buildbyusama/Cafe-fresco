import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert, Autocomplete, Box, Button, Chip, FormControlLabel, LinearProgress, Paper, Stack, Switch, TextField, Typography } from '@mui/material';
import { MainContext } from '../../context/index.jsx';
import { homeFor } from '../../../config/permissions';
import { apiFetch } from '../../../api/client';
import { useNotify } from '../../../contexts/NotifyContext';
import PageToolbar from 'ui-component/PageToolbar';
import TableSkeleton from 'ui-component/TableSkeleton';

const STATUS = { enabled: ['AI on', 'success'], mock: ['Test mode', 'warning'], disabled: ['No OpenAI key: rule-based answers only', 'warning'] };

// Admin controls for the shop assistant. Stored with Store Info (settings.chatbot).
export default function AiSettings() {
    const { adminRole } = useContext(MainContext);
    const navigate = useNavigate();
    const notify = useNotify();
    const [form, setForm] = useState(null);
    const [all, setAll] = useState(null);
    const [usage, setUsage] = useState(null);
    const [errors, setErrors] = useState({});
    const [loadError, setLoadError] = useState('');
    const [saving, setSaving] = useState(false);
    const [indexing, setIndexing] = useState(false);
    const [indexResult, setIndexResult] = useState(null);

    const load = async () => {
        setLoadError('');
        try {
            const [s, u] = await Promise.all([apiFetch('/settings'), apiFetch('/chat/admin/usage')]);
            setAll(s);
            setForm({ ...s.chatbot, dailyTokenBudget: s.chatbot.dailyTokenBudget ?? '' });
            setUsage(u);
        } catch (err) {
            setLoadError(err.message);
        }
    };
    useEffect(() => { load(); }, []);

    const set = (k, v) => {
        setForm((f) => ({ ...f, [k]: v }));
        setErrors((e) => ({ ...e, [`chatbot.${k}`]: undefined }));
    };

    const save = async () => {
        setSaving(true);
        setErrors({});
        try {
            const res = await apiFetch('/settings', { method: 'PUT', body: { chatbot: { ...form, dailyTokenBudget: form.dailyTokenBudget === '' ? null : Number(form.dailyTokenBudget) } } });
            setForm({ ...res.settings.chatbot, dailyTokenBudget: res.settings.chatbot.dailyTokenBudget ?? '' });
            setUsage(await apiFetch('/chat/admin/usage'));
            notify.success('Assistant settings saved');
        } catch (err) {
            setErrors(err.data?.fields || {});
            notify.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const reindex = async () => {
        setIndexing(true);
        setIndexResult(null);
        try {
            const r = await apiFetch('/chat/admin/reindex', { method: 'POST' });
            setIndexResult({ ok: true, text: `Up to date: ${r.dishes.embedded} dish(es) and ${r.faq.embedded} FAQ entr${r.faq.embedded === 1 ? 'y' : 'ies'} updated, ${r.dishes.skipped + r.faq.skipped} unchanged.` });
        } catch (err) {
            setIndexResult({ ok: false, text: err.message });
        } finally {
            setIndexing(false);
        }
    };

    const [label, tone] = STATUS[usage?.status] || ['…', 'info'];
    const pct = usage && usage.budget ? Math.min(100, (usage.usedToday / usage.budget) * 100) : 0;

    return (
        <Box>
            <PageToolbar onBack={() => navigate(homeFor(adminRole))} summary="How the shop's AI assistant behaves">
                <Button variant="contained" onClick={save} disabled={!form || saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </PageToolbar>
            {loadError ? (
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>{loadError}</Alert>
            ) : !form ? (
                <TableSkeleton cols={3} />
            ) : (
                <Stack spacing={2} sx={{ maxWidth: 820 }}>
                    <Alert severity={tone}>
                        <b>{label}</b>
                        {usage?.status === 'enabled' && <> · model {usage.model}</>}
                        {usage?.status === 'disabled' && <> · add OPENAI_API_KEY to the server&apos;s .env to switch on AI answers and smart search.</>}
                    </Alert>

                    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: '14px' }}>
                        <FormControlLabel control={<Switch checked={form.enabled !== false} onChange={(e) => set('enabled', e.target.checked)} />} label={<b>Show the assistant on the website</b>} />
                        <Typography sx={{ fontSize: '0.8125rem', color: '#6B6B6B', mb: 2 }}>When off, the chat button disappears from the shop within a minute.</Typography>
                        <TextField fullWidth label="Greeting" value={form.greeting || ''} onChange={(e) => set('greeting', e.target.value)} inputProps={{ maxLength: 200 }} helperText={`${(form.greeting || '').length}/200 · the first message customers see`} />
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: '14px' }}>
                        <Typography sx={{ fontWeight: 700 }}>Daily AI budget</Typography>
                        <Typography sx={{ fontSize: '0.8125rem', color: '#6B6B6B', mb: 1.5 }}>Above this many tokens a day the assistant switches to rule-based answers until midnight. Leave empty to use the server limit ({usage?.maxBudget?.toLocaleString()}).</Typography>
                        <TextField
                            type="number"
                            label="Tokens per day"
                            value={form.dailyTokenBudget}
                            onChange={(e) => set('dailyTokenBudget', e.target.value)}
                            inputProps={{ min: 0, max: usage?.maxBudget, step: 1000 }}
                            error={!!errors['chatbot.dailyTokenBudget']}
                            helperText={errors['chatbot.dailyTokenBudget']}
                            sx={{ width: 260 }}
                        />
                        {usage && (
                            <Box sx={{ mt: 2 }}>
                                <Stack direction="row" sx={{ justifyContent: 'space-between', fontSize: '0.8125rem', mb: 0.5 }}>
                                    <span>Used today</span>
                                    <b>{usage.usedToday.toLocaleString()} / {usage.budget.toLocaleString()}</b>
                                </Stack>
                                <LinearProgress variant="determinate" value={pct} color={pct > 90 ? 'error' : 'primary'} sx={{ height: 8, borderRadius: 4 }} />
                            </Box>
                        )}
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: '14px' }}>
                        <Typography sx={{ fontWeight: 700 }}>Hand-off to staff</Typography>
                        <Typography sx={{ fontSize: '0.8125rem', color: '#6B6B6B', mb: 1.5 }}>When a customer asks for a person you get a notification here. Add an email to also be emailed.</Typography>
                        <TextField fullWidth type="email" label="Escalation email (optional)" value={form.escalationEmail || ''} onChange={(e) => set('escalationEmail', e.target.value)} error={!!errors['chatbot.escalationEmail']} helperText={errors['chatbot.escalationEmail']} />
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: '14px' }}>
                        <Typography sx={{ fontWeight: 700 }}>Hide the chat button on</Typography>
                        <Typography sx={{ fontSize: '0.8125rem', color: '#6B6B6B', mb: 1.5 }}>Shop pages (paths starting with /) where the assistant shouldn&apos;t appear, e.g. checkout.</Typography>
                        <Autocomplete
                            multiple
                            freeSolo
                            options={['/address', '/payment', '/cart', '/login', '/signup']}
                            value={form.hiddenOn || []}
                            onChange={(_, v) => set('hiddenOn', [...new Set(v.map((p) => (String(p).startsWith('/') ? String(p).trim() : `/${String(p).trim()}`)))])}
                            renderTags={(value, getTagProps) => value.map((p, i) => <Chip size="small" label={p} {...getTagProps({ index: i })} key={p} />)}
                            renderInput={(params) => <TextField {...params} label="Pages" placeholder="Type a path and press Enter" />}
                        />
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: '14px' }}>
                        <Typography sx={{ fontWeight: 700 }}>Smart search index</Typography>
                        <Typography sx={{ fontSize: '0.8125rem', color: '#6B6B6B', mb: 1.5 }}>Dishes and FAQ entries are indexed automatically when saved. Re-index after a bulk import; only changed items use tokens.</Typography>
                        <Button variant="outlined" onClick={reindex} disabled={indexing}>{indexing ? 'Re-indexing…' : 'Re-index menu and FAQ'}</Button>
                        {indexResult && <Alert severity={indexResult.ok ? 'success' : 'warning'} sx={{ mt: 1.5 }}>{indexResult.text}</Alert>}
                    </Paper>
                    {all && <Typography sx={{ fontSize: '0.75rem', color: '#8A877F' }}>Shop facts the assistant quotes (hours, contact, delivery, policies) are edited on the Store Info page.</Typography>}
                </Stack>
            )}
        </Box>
    );
}
