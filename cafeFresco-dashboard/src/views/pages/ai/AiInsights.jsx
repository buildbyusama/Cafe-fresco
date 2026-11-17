import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSearchParams } from 'react-router-dom';
import Chart from 'react-apexcharts';
import { Alert, Box, Button, Divider, Drawer, IconButton, MenuItem, Paper, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { IconMessageCircle, IconMoodHappy, IconRobot, IconCoin, IconAlertTriangle, IconX, IconUserQuestion } from '@tabler/icons-react';
import { MainContext } from '../../context/index.jsx';
import { homeFor } from '../../../config/permissions';
import { apiFetch } from '../../../api/client';
import PageToolbar from 'ui-component/PageToolbar';
import EmptyState from 'ui-component/EmptyState';
import ListFooter from 'ui-component/ListFooter';
import StatusPill from 'ui-component/StatusPill';
import IconTile from '../../dashboard/Default/IconTile';

const when = (d) => new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const TOOL_LABEL = { search_menu: 'Menu search', get_dish: 'Dish details', list_categories: 'Categories', get_deals: 'Deals', recommend: 'Recommendations', get_store_info: 'Store info', search_knowledge: 'FAQ', get_my_orders: 'My orders', get_order_status: 'Order status', get_my_cart: 'Cart', propose_add_to_cart: 'Add to cart', check_discount_code: 'Discount check', escalate_to_human: 'Hand-off to staff', search_documents: 'Documents' };

function Kpi({ icon: Icon, label, value, hint, bg, color }) {
    return (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: '14px', display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <IconTile bg={bg} color={color} size={44}><Icon size={22} /></IconTile>
            <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.75rem', color: '#6B6B6B' }}>{label}</Typography>
                <Typography sx={{ fontSize: '1.35rem', fontWeight: 800, lineHeight: 1.2 }}>{value}</Typography>
                {hint && <Typography sx={{ fontSize: '0.7rem', color: '#8A877F' }}>{hint}</Typography>}
            </Box>
        </Paper>
    );
}

// AI assistant insights: usage, quality, cost, what people ask, what it couldn't answer, transcripts
export default function AiInsights() {
    const { adminRole } = useContext(MainContext);
    const navigate = useNavigate();
    const [range, setRange] = useState('7d');
    const [stats, setStats] = useState(null);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('');
    const [page, setPage] = useState(1);
    const [list, setList] = useState(null);
    const [open, setOpen] = useState(null); // transcript

    useEffect(() => {
        setStats(null);
        setError('');
        apiFetch(`/chat/admin/stats?range=${range}`).then(setStats).catch((e) => setError(e.message));
    }, [range]);

    useEffect(() => {
        setList(null);
        apiFetch(`/chat/admin/sessions?page=${page}${filter ? `&filter=${filter}` : ''}`).then(setList).catch((e) => setError(e.message));
    }, [page, filter]);

    const openTranscript = (id) => {
        setOpen({ loading: true });
        apiFetch(`/chat/admin/sessions/${id}`).then(setOpen).catch((e) => setOpen({ error: e.message }));
    };

    // a hand-off notification links here with ?session=<id>: open that conversation
    const [params, setParams] = useSearchParams();
    useEffect(() => {
        const sid = params.get('session');
        if (sid) {
            openTranscript(sid);
            params.delete('session');
            setParams(params, { replace: true });
        }
    }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

    const createFaq = (question) => navigate(`/admin/ai-knowledge?new=${encodeURIComponent(question)}`);

    return (
        <Box>
            <PageToolbar onBack={() => navigate(homeFor(adminRole))} summary={stats ? `Assistant: ${stats.aiStatus === 'enabled' ? 'AI on' : stats.aiStatus === 'mock' ? 'test mode' : 'rule-based answers (no OpenAI key)'}` : 'Loading…'}>
                <ToggleButtonGroup size="small" exclusive value={range} onChange={(_, v) => v && setRange(v)} aria-label="Date range">
                    <ToggleButton value="7d">7 days</ToggleButton>
                    <ToggleButton value="30d">30 days</ToggleButton>
                </ToggleButtonGroup>
            </PageToolbar>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' }, mb: 2 }}>
                {!stats ? (
                    Array.from({ length: 6 }, (_, i) => <Skeleton key={i} variant="rounded" height={86} />)
                ) : (
                    <>
                        <Kpi icon={IconMessageCircle} label="Conversations" value={stats.sessions} hint={`${stats.avgMessagesPerSession} message${Number(stats.avgMessagesPerSession) === 1 ? '' : 's'} each`} />
                        <Kpi icon={IconUserQuestion} label="Questions" value={stats.messages} hint={`avg reply ${(stats.avgLatencyMs / 1000).toFixed(1)} s`} bg="#E7F0FD" color="#1E5BB8" />
                        <Kpi icon={IconMoodHappy} label="Helpful" value={stats.thumbsUp} hint={`${stats.thumbsDown} not helpful`} bg="#E8F6EE" color="#1E7A45" />
                        <Kpi icon={IconAlertTriangle} label="Unanswered" value={stats.unanswered} hint={`${stats.escalations} asked for a person`} bg="#FDECEC" color="#B42318" />
                        <Kpi icon={IconRobot} label="Rule-based answers" value={`${stats.fallbackRate}%`} hint="when AI was off or over budget" bg="#F3EEFF" color="#6B3FD4" />
                        <Kpi icon={IconCoin} label="Estimated AI cost" value={`$${stats.estimatedCost.toFixed(2)}`} hint={`${(stats.tokens.in + stats.tokens.out).toLocaleString()} tokens`} />
                    </>
                )}
            </Box>

            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, mb: 2 }}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: '14px' }}>
                    <Typography sx={{ fontWeight: 700, mb: 1 }}>Questions per day</Typography>
                    {stats ? (
                        <Chart
                            type="bar"
                            height={240}
                            series={[{ name: 'Questions', data: stats.perDay.map((d) => d.messages) }]}
                            options={{
                                chart: { toolbar: { show: false }, fontFamily: 'inherit' },
                                colors: ['#F5B400'],
                                plotOptions: { bar: { borderRadius: 6, columnWidth: '55%' } },
                                dataLabels: { enabled: false },
                                xaxis: { categories: stats.perDay.map((d) => d.day.slice(5)), labels: { style: { colors: '#8A877F' } } },
                                // whole numbers only, no repeated tick labels on small counts
                                yaxis: (() => {
                                    const top = Math.max(1, ...stats.perDay.map((d) => d.messages));
                                    return { min: 0, max: top <= 5 ? top : undefined, tickAmount: Math.min(5, top), forceNiceScale: top > 5, labels: { formatter: (v) => String(Math.round(v)) } };
                                })(),
                                grid: { borderColor: '#F0EFEB' },
                            }}
                        />
                    ) : <Skeleton variant="rounded" height={240} />}
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: '14px' }}>
                    <Typography sx={{ fontWeight: 700, mb: 1 }}>What it looked up</Typography>
                    {!stats ? <Skeleton variant="rounded" height={240} /> : stats.tools.length === 0 ? (
                        <EmptyState title="No lookups yet" hint="Tool use appears once customers chat." />
                    ) : (
                        <Stack spacing={1}>
                            {stats.tools.map((t) => {
                                const max = stats.tools[0].count;
                                return (
                                    <Box key={t.tool}>
                                        <Stack direction="row" sx={{ justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                                            <span>{TOOL_LABEL[t.tool] || t.tool}</span>
                                            <b>{t.count}</b>
                                        </Stack>
                                        <Box sx={{ height: 6, borderRadius: 3, bgcolor: '#F0EFEB', mt: 0.5 }}>
                                            <Box sx={{ height: 6, borderRadius: 3, bgcolor: '#E8262B', width: `${(t.count / max) * 100}%` }} />
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Stack>
                    )}
                </Paper>
            </Box>

            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, mb: 2 }}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: '14px' }}>
                    <Typography sx={{ fontWeight: 700, mb: 1 }}>Most asked (3+ times)</Typography>
                    {!stats ? <Skeleton variant="rounded" height={120} /> : stats.topQuestions.length === 0 ? (
                        <Typography sx={{ fontSize: '0.8125rem', color: '#8A877F' }}>Nothing repeated yet.</Typography>
                    ) : (
                        <Table size="small">
                            <TableBody>
                                {stats.topQuestions.map((q) => (
                                    <TableRow key={q.question}>
                                        <TableCell sx={{ pl: 0 }}>{q.question}</TableCell>
                                        <TableCell align="right" sx={{ pr: 0, fontWeight: 700 }}>{q.count}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: '14px' }}>
                    <Typography sx={{ fontWeight: 700 }}>Couldn&apos;t answer</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#8A877F', mb: 1 }}>Add an FAQ entry so the assistant can answer next time.</Typography>
                    {!stats ? <Skeleton variant="rounded" height={120} /> : stats.unansweredList.length === 0 ? (
                        <Typography sx={{ fontSize: '0.8125rem', color: '#8A877F' }}>Every question got an answer.</Typography>
                    ) : (
                        <Stack divider={<Divider flexItem />} spacing={1}>
                            {stats.unansweredList.slice(0, 8).map((u) => (
                                <Stack key={`${u.sessionId}${u.at}`} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                    <Typography sx={{ flex: 1, fontSize: '0.8125rem', minWidth: 0 }} noWrap title={u.question}>{u.question || '—'}</Typography>
                                    <Button size="small" onClick={() => openTranscript(u.sessionId)}>View</Button>
                                    <Button size="small" variant="outlined" onClick={() => createFaq(u.question)}>Create FAQ</Button>
                                </Stack>
                            ))}
                        </Stack>
                    )}
                </Paper>
            </Box>

            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, mb: 2 }} data-testid="doc-insights">
                <Paper variant="outlined" sx={{ p: 2, borderRadius: '14px' }}>
                    <Typography sx={{ fontWeight: 700 }}>Documents used</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#8A877F', mb: 1 }}>{stats ? `${stats.documents?.lookups || 0} document lookup${stats.documents?.lookups === 1 ? '' : 's'} in this period` : ' '}</Typography>
                    {!stats ? <Skeleton variant="rounded" height={120} /> : !stats.documents?.topSources.length ? (
                        <Typography sx={{ fontSize: '0.8125rem', color: '#8A877F' }}>No answers came from documents yet.</Typography>
                    ) : (
                        <Table size="small">
                            <TableBody>
                                {stats.documents.topSources.map((s) => (
                                    <TableRow key={s.title}>
                                        <TableCell sx={{ pl: 0, overflowWrap: 'anywhere' }}>{s.title}</TableCell>
                                        <TableCell align="right" sx={{ pr: 0, fontWeight: 700 }}>{s.count}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: '14px' }}>
                    <Typography sx={{ fontWeight: 700 }}>Not covered by documents</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#8A877F', mb: 1 }}>Questions the documents had nothing on. Upload a document or add an FAQ entry.</Typography>
                    {!stats ? <Skeleton variant="rounded" height={120} /> : !stats.documents?.gaps.length ? (
                        <Typography sx={{ fontSize: '0.8125rem', color: '#8A877F' }}>No gaps found.</Typography>
                    ) : (
                        <Stack divider={<Divider flexItem />} spacing={1}>
                            {stats.documents.gaps.slice(0, 8).map((g) => (
                                <Stack key={g.question} data-testid="doc-gap" direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                    <Typography sx={{ flex: 1, fontSize: '0.8125rem', minWidth: 0 }} noWrap title={g.question}>{g.question}</Typography>
                                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>{g.count}×</Typography>
                                    <Button size="small" onClick={() => navigate('/admin/ai-documents')}>Upload a document</Button>
                                    <Button size="small" variant="outlined" onClick={() => createFaq(g.question)}>Create FAQ</Button>
                                </Stack>
                            ))}
                        </Stack>
                    )}
                </Paper>
            </Box>

            <Paper variant="outlined" sx={{ borderRadius: '14px', overflow: 'hidden' }}>
                <Stack direction="row" sx={{ p: 2, alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontWeight: 700 }}>Conversations</Typography>
                    <TextField select size="small" label="Show" value={filter} slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }} onChange={(e) => { setFilter(e.target.value); setPage(1); }} sx={{ minWidth: 200 }}>
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="escalated">Asked for a person</MenuItem>
                        <MenuItem value="thumbs-down">Rated not helpful</MenuItem>
                        <MenuItem value="unanswered">Couldn&apos;t answer</MenuItem>
                        <MenuItem value="fallback">Rule-based answers</MenuItem>
                    </TextField>
                </Stack>
                {!list ? <Box sx={{ p: 2 }}><Skeleton variant="rounded" height={160} /></Box> : list.sessions.length === 0 ? (
                    <Box sx={{ p: 3 }}><EmptyState title="No conversations" hint="Chats from the shop appear here." /></Box>
                ) : (
                    <>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Customer</TableCell>
                                    <TableCell>First message</TableCell>
                                    <TableCell align="center">Messages</TableCell>
                                    <TableCell>Last active</TableCell>
                                    <TableCell align="right" />
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {list.sessions.map((s) => (
                                    <TableRow key={s.id} hover>
                                        <TableCell>
                                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                                <span>{s.customer}</span>
                                                {s.escalated && <StatusPill tone="danger" label="Needs a person" />}
                                            </Stack>
                                        </TableCell>
                                        <TableCell sx={{ maxWidth: 360 }}><Typography noWrap sx={{ fontSize: '0.8125rem' }} title={s.firstMessage}>{s.firstMessage || '—'}</Typography></TableCell>
                                        <TableCell align="center">{s.messages}</TableCell>
                                        <TableCell>{when(s.lastAt)}</TableCell>
                                        <TableCell align="right"><Button size="small" onClick={() => openTranscript(s.id)}>Read</Button></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <ListFooter page={list.page} totalPages={list.totalPages} total={list.total} perPage={15} onChange={setPage} />
                    </>
                )}
            </Paper>

            <Drawer anchor="right" open={!!open} onClose={() => setOpen(null)} PaperProps={{ sx: { width: { xs: '100%', sm: 460 }, p: 2 } }}>
                <Stack direction="row" sx={{ alignItems: 'center', mb: 1 }}>
                    <Typography sx={{ fontWeight: 700, flex: 1 }}>{open?.customer ? `Chat with ${open.customer}` : 'Conversation'}</Typography>
                    <IconButton aria-label="Close" onClick={() => setOpen(null)}><IconX size={18} /></IconButton>
                </Stack>
                {open?.loading && <Skeleton variant="rounded" height={300} />}
                {open?.error && <Alert severity="error">{open.error}</Alert>}
                {open?.messages && (
                    <Stack spacing={1.25}>
                        {open.messages.map((m, i) => (
                            <Box
                                key={i}
                                sx={{
                                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                                    maxWidth: '88%',
                                    px: 1.5,
                                    py: 1,
                                    borderRadius: '12px',
                                    fontSize: m.role === 'tool' ? '0.72rem' : '0.8125rem',
                                    whiteSpace: 'pre-wrap',
                                    overflowWrap: 'anywhere',
                                    bgcolor: m.role === 'user' ? '#FFF3D1' : m.role === 'tool' ? 'transparent' : '#F6F5F2',
                                    color: m.role === 'tool' ? '#8A877F' : 'inherit',
                                    fontFamily: m.role === 'tool' ? 'ui-monospace, monospace' : 'inherit',
                                }}
                            >
                                {m.role === 'tool' ? `↳ looked up ${m.content}` : m.content}
                                {m.sources?.length > 0 && (
                                    <Box sx={{ mt: 0.5, fontSize: '0.72rem', color: '#8A877F' }}>
                                        Sources: {m.sources.map((s) => (s.section ? `${s.title} › ${s.section}` : s.title)).join(', ')}
                                    </Box>
                                )}
                                {m.role === 'assistant' && (m.feedback || m.unanswered || m.source === 'fallback') && (
                                    <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                                        {m.feedback === 'up' && <StatusPill tone="success" label="Helpful" />}
                                        {m.feedback === 'down' && <StatusPill tone="danger" label={m.feedbackNote ? `Not helpful: ${m.feedbackNote}` : 'Not helpful'} />}
                                        {m.unanswered && <StatusPill tone="warning" label="Couldn't answer" />}
                                        {m.source === 'fallback' && <StatusPill tone="neutral" label="Rule-based" />}
                                    </Stack>
                                )}
                            </Box>
                        ))}
                    </Stack>
                )}
            </Drawer>
        </Box>
    );
}

