import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert, Box, Button, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import { IconHistory } from '@tabler/icons-react';
import { MainContext } from '../../context/index.jsx';
import { homeFor } from '../../../config/permissions';
import { apiFetch } from '../../../api/client';
import PageToolbar from 'ui-component/PageToolbar';
import EmptyState from 'ui-component/EmptyState';
import ListFooter from 'ui-component/ListFooter';
import StatusPill from 'ui-component/StatusPill';
import TableSkeleton from 'ui-component/TableSkeleton';

const ENTITIES = ['product', 'inventory', 'category', 'order', 'discount', 'permission', 'settings', 'knowledge', 'assistant', 'employee', 'department', 'supplier', 'distributor'];
const TONE = { create: 'success', update: 'warning', delete: 'danger' };
const when = (d) => new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

// Who changed what in the dashboard (kept for a year). Admin only.
export default function ActivityLog() {
    const { adminRole } = useContext(MainContext);
    const navigate = useNavigate();
    const [f, setF] = useState({ entity: '', action: '', adminId: '', from: '', to: '' });
    const [page, setPage] = useState(1);
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        setData(null);
        setError('');
        const qs = new URLSearchParams({ page: String(page), limit: '20', ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) });
        apiFetch(`/audit?${qs}`).then(setData).catch((e) => setError(e.message));
    }, [page, f]);

    const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setPage(1); };
    const select = (k, label, options, width = 150) => (
        <TextField select size="small" label={label} value={f[k]} onChange={set(k)} sx={{ minWidth: width }} slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
            <MenuItem value="">All</MenuItem>
            {options.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
        </TextField>
    );

    return (
        <Box>
            <PageToolbar onBack={() => navigate(homeFor(adminRole))} summary={data ? `${data.total} change${data.total === 1 ? '' : 's'}` : 'Loading…'} />
            <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1.5 }}>
                {select('entity', 'Area', ENTITIES.map((e) => [e, e[0].toUpperCase() + e.slice(1)]))}
                {select('action', 'Action', [['create', 'Created'], ['update', 'Updated'], ['delete', 'Deleted']], 130)}
                {select('adminId', 'Admin', (data?.admins || []).map((a) => [a.id, a.name || 'Admin']), 170)}
                <TextField size="small" type="date" label="From" value={f.from} onChange={set('from')} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField size="small" type="date" label="To" value={f.to} onChange={set('to')} slotProps={{ inputLabel: { shrink: true } }} />
                {Object.values(f).some(Boolean) && <Button onClick={() => { setF({ entity: '', action: '', adminId: '', from: '', to: '' }); setPage(1); }}>Clear</Button>}
            </Stack>

            {error ? (
                <Alert severity="error">{error}</Alert>
            ) : !data ? (
                <TableSkeleton cols={5} />
            ) : data.entries.length === 0 ? (
                <Box display="flex" justifyContent="center" my={4}><EmptyState icon={IconHistory} title="No changes found" hint="Changes made in the dashboard appear here." /></Box>
            ) : (
                <>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>When</TableCell>
                                <TableCell>Who</TableCell>
                                <TableCell>Action</TableCell>
                                <TableCell>What</TableCell>
                                <TableCell>Details</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.entries.map((e) => {
                                const fields = Object.entries(e.changes || {});
                                return (
                                    <TableRow key={e._id}>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{when(e.at)}</TableCell>
                                        <TableCell>
                                            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>{e.adminName || 'Admin'}</Typography>
                                            <Typography sx={{ fontSize: '0.75rem', color: '#8A877F', textTransform: 'capitalize' }}>{e.role}</Typography>
                                        </TableCell>
                                        <TableCell><StatusPill tone={TONE[e.action]} label={e.action === 'create' ? 'Created' : e.action === 'delete' ? 'Deleted' : 'Updated'} /></TableCell>
                                        <TableCell sx={{ textTransform: 'capitalize' }}>{e.entity}{e.entityId && <Typography component="span" sx={{ display: 'block', fontSize: '0.72rem', color: '#8A877F', textTransform: 'none', fontFamily: 'ui-monospace, monospace' }}>{e.entityId}</Typography>}</TableCell>
                                        <TableCell sx={{ maxWidth: 420 }}>
                                            <Tooltip title={<pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{fields.map(([k, v]) => `${k}: ${v}`).join('\n') || '—'}</pre>}>
                                                <Typography noWrap sx={{ fontSize: '0.8125rem', color: '#555' }}>
                                                    {fields.length ? fields.map(([k, v]) => `${k}: ${v}`).join(' · ') : e.summary}
                                                </Typography>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    <ListFooter page={data.page} totalPages={data.totalPages} total={data.total} perPage={20} onChange={setPage} />
                </>
            )}
        </Box>
    );
}
