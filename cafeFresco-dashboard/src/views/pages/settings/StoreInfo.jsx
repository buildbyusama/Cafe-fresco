import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert, Box, Button, FormControlLabel, Paper, Stack, Switch, TextField, Typography } from '@mui/material';
import { MainContext } from '../../context/index.jsx';
import { homeFor } from '../../../config/permissions';
import { apiFetch } from '../../../api/client';
import { useNotify } from '../../../contexts/NotifyContext';
import PageToolbar from 'ui-component/PageToolbar';
import TableSkeleton from 'ui-component/TableSkeleton';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const blankHours = () => DAYS.map((_, day) => ({ day, open: '', close: '', closed: false, set: false }));

// Server hours → one row per day (days without a row are "not set")
const toRows = (hours = []) => blankHours().map((r) => {
    const h = hours.find((x) => x.day === r.day);
    return h ? { ...r, ...h, set: true } : r;
});

const Section = ({ title, hint, children }) => (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: '14px', mb: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{title}</Typography>
        {hint && <Typography sx={{ fontSize: '0.8125rem', color: '#6B6B6B', mt: 0.25, mb: 1.5 }}>{hint}</Typography>}
        <Box sx={{ mt: hint ? 0 : 1.5 }}>{children}</Box>
    </Paper>
);

// Store facts the website and the AI assistant show. Empty fields stay hidden and the assistant says it doesn't know.
export default function StoreInfo() {
    const { adminRole } = useContext(MainContext);
    const navigate = useNavigate();
    const notify = useNotify();
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [form, setForm] = useState(null);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        setLoadError('');
        try {
            const s = await apiFetch('/settings');
            setForm({ ...s, hours: toRows(s.hours), areasText: (s.delivery?.areas || []).join(', ') });
        } catch (err) {
            setLoadError(err.message);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, []);

    const set = (group, key) => (e) => {
        const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setForm((f) => ({ ...f, [group]: { ...f[group], [key]: v } }));
        setErrors((x) => ({ ...x, [`${group}.${key}`]: undefined }));
    };
    const setHour = (day, key, v) => {
        setForm((f) => ({ ...f, hours: f.hours.map((h) => (h.day === day ? { ...h, [key]: v, set: true } : h)) }));
        setErrors((x) => ({ ...x, hours: undefined }));
    };

    const save = async () => {
        setSaving(true);
        setErrors({});
        // days left completely empty are "not set"; a half-filled day is sent so the server reports it
        const hours = form.hours.filter((h) => h.closed || h.open || h.close).map(({ day, open, close, closed }) => ({ day, open, close, closed }));
        const body = {
            contact: form.contact,
            hours,
            delivery: { ...form.delivery, areas: form.areasText.split(',').map((a) => a.trim()).filter(Boolean) },
            payments: form.payments,
            policies: form.policies,
            social: form.social,
        };
        try {
            const res = await apiFetch('/settings', { method: 'PUT', body });
            setForm((f) => ({ ...f, ...res.settings, hours: toRows(res.settings.hours), areasText: (res.settings.delivery?.areas || []).join(', ') }));
            notify.success('Store info saved');
        } catch (err) {
            const fields = err.data?.fields || {};
            const mapped = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k.startsWith('hours.') ? 'hours' : k, v]));
            setErrors(mapped);
            notify.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const field = (group, key, label, props = {}) => (
        <TextField
            fullWidth
            size="small"
            label={label}
            value={form[group]?.[key] ?? ''}
            onChange={set(group, key)}
            error={!!errors[`${group}.${key}`]}
            helperText={errors[`${group}.${key}`] || props.helperText}
            {...props}
        />
    );

    return (
        <Box>
            <PageToolbar onBack={() => navigate(homeFor(adminRole))} summary="Shown on the website and used by the AI assistant. Leave a field empty to hide it.">
                <Button variant="contained" onClick={save} disabled={!form || saving}>
                    {saving ? 'Saving…' : 'Save'}
                </Button>
            </PageToolbar>

            {loading ? (
                <TableSkeleton cols={3} />
            ) : loadError ? (
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>{loadError}</Alert>
            ) : (
                <Box sx={{ maxWidth: 920 }}>
                    <Section title="Contact" hint="Phone, email and address appear on the Contact page and in assistant answers.">
                        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                            {field('contact', 'phone', 'Phone', { placeholder: '+92 300 1234567' })}
                            {field('contact', 'email', 'Email', { type: 'email' })}
                            {field('contact', 'address', 'Address', { sx: { gridColumn: { sm: '1 / -1' } } })}
                            {field('contact', 'mapUrl', 'Google Maps link', { placeholder: 'https://maps.google.com/…', sx: { gridColumn: { sm: '1 / -1' } } })}
                        </Box>
                    </Section>

                    <Section title="Opening hours" hint="Leave a day empty if you don't want to publish it. A closing time earlier than the opening time means after midnight.">
                        {errors.hours && <Alert severity="error" sx={{ mb: 1.5 }}>{errors.hours}</Alert>}
                        <Stack spacing={1}>
                            {form.hours.map((h) => (
                                <Box key={h.day} sx={{ display: 'grid', gap: 1.5, alignItems: 'center', gridTemplateColumns: { xs: '1fr 1fr', sm: '130px 140px 140px auto' } }}>
                                    <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', gridColumn: { xs: '1 / -1', sm: 'auto' } }}>{DAYS[h.day]}</Typography>
                                    <TextField size="small" type="time" label="Opens" value={h.open} disabled={h.closed} onChange={(e) => setHour(h.day, 'open', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                                    <TextField size="small" type="time" label="Closes" value={h.close} disabled={h.closed} onChange={(e) => setHour(h.day, 'close', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                                    <FormControlLabel control={<Switch checked={h.closed} onChange={(e) => setHour(h.day, 'closed', e.target.checked)} />} label="Closed" />
                                </Box>
                            ))}
                        </Stack>
                    </Section>

                    <Section title="Delivery" hint="The shop doesn't charge a delivery fee at checkout today, so keep the fee at 0 unless checkout is changed.">
                        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
                            {field('delivery', 'fee', 'Delivery fee', { type: 'number', inputProps: { min: 0, step: '0.01' } })}
                            {field('delivery', 'minOrder', 'Minimum order', { type: 'number', inputProps: { min: 0, step: '0.01' } })}
                            {field('delivery', 'etaMinutes', 'Typical delivery time (minutes)', { type: 'number', inputProps: { min: 1, max: 600 } })}
                        </Box>
                        <TextField fullWidth size="small" sx={{ mt: 2 }} label="Delivery areas (comma separated)" value={form.areasText} onChange={(e) => setForm((f) => ({ ...f, areasText: e.target.value }))} placeholder="Gulberg, DHA, Model Town" />
                    </Section>

                    <Section title="Payment methods">
                        {errors.payments && <Alert severity="error" sx={{ mb: 1 }}>{errors.payments}</Alert>}
                        <FormControlLabel control={<Switch checked={form.payments.card} onChange={set('payments', 'card')} />} label="Card (Stripe)" />
                        <FormControlLabel control={<Switch checked={form.payments.cod} onChange={set('payments', 'cod')} />} label="Cash on delivery" />
                    </Section>

                    <Section title="Policies" hint="Short, plain wording. The assistant quotes these when customers ask.">
                        <Stack spacing={2}>
                            {field('policies', 'cancellation', 'Cancellation', { multiline: true, minRows: 2 })}
                            {field('policies', 'refunds', 'Refunds', { multiline: true, minRows: 2 })}
                            {field('policies', 'delivery', 'Delivery', { multiline: true, minRows: 2 })}
                        </Stack>
                    </Section>

                    <Section title="Social links" hint="Full https:// links. Empty ones are hidden on the website.">
                        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
                            {field('social', 'facebook', 'Facebook')}
                            {field('social', 'instagram', 'Instagram')}
                            {field('social', 'twitter', 'X / Twitter')}
                        </Box>
                    </Section>
                </Box>
            )}
        </Box>
    );
}
