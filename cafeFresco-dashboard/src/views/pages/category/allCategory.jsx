import React, { useContext, useState, useEffect, useMemo } from 'react';
import {
    Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button,
    Pagination, Skeleton, Stack, TextField, InputAdornment, Typography, Avatar
} from '@mui/material';
import { MainContext } from '../../context/index.jsx';
import { can } from '../../../config/permissions';
import { useNavigate } from 'react-router';
import { apiFetch } from '../../../api/client';
import { useConfirm, useNotify } from '../../../contexts/NotifyContext';
import ActionIcon from 'ui-component/ActionIcon';
import { IconCategory, IconPlus, IconSearch } from '@tabler/icons-react';
import EmptyState from 'ui-component/EmptyState';
import { cardRadius, cardShadow } from 'store/constant';

const PER_PAGE = 10;

const AllCategories = () => {
    const BASE_URL_IMG = import.meta.env.VITE_BASE_URL;
    const { categories, adminRole, fetchCategories } = useContext(MainContext);
    const navigate = useNavigate();
    const notify = useNotify();
    const confirm = useConfirm();
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [search, setSearch] = useState('');
    const [deleting, setDeleting] = useState(null);

    useEffect(() => {
        fetchCategories().finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return categories;
        return categories.filter((c) => `${c.title} ${c.description || ''}`.toLowerCase().includes(q));
    }, [categories, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    // stay on a real page after a search or a delete shrinks the list
    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    const first = (currentPage - 1) * PER_PAGE;
    const visible = filtered.slice(first, first + PER_PAGE);

    const handleDelete = async (category) => {
        if (!(await confirm({ title: `Delete "${category.title}"?`, message: 'Categories that still have products cannot be deleted.', confirmText: 'Delete', danger: true }))) return;
        setDeleting(category._id);
        try {
            await apiFetch(`/category/delete/${category._id}`, { method: 'DELETE' });
            notify.success('Category deleted');
            await fetchCategories();
        } catch (err) {
            notify.error(err.message);
        } finally {
            setDeleting(null);
        }
    };

    const head = { fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#6B6B6B', bgcolor: '#FBFAF7', borderBottom: '1px solid #EEEDE9', py: 1.25 };

    return (
        <Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2, mb: 2.5 }}>
                <Typography sx={{ fontSize: '0.9375rem', color: '#6B6B6B' }}>
                    {loading ? 'Loading…' : `${categories.length} ${categories.length === 1 ? 'category' : 'categories'} in the shop menu`}
                </Typography>
                <Button variant="contained" startIcon={<IconPlus size={18} />} onClick={() => navigate('/admin/add-category')} sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}>
                    Add category
                </Button>
            </Stack>

            <Box sx={{ bgcolor: '#FFF', borderRadius: `${cardRadius}px`, boxShadow: cardShadow, overflow: 'hidden' }}>
                <Box sx={{ p: 2, borderBottom: '1px solid #F0EFEB' }}>
                    <TextField
                        size="small"
                        placeholder="Search categories"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setCurrentPage(1);
                        }}
                        inputProps={{ 'aria-label': 'Search categories' }}
                        InputProps={{ startAdornment: <InputAdornment position="start"><IconSearch size={18} color="#8A8A8A" /></InputAdornment> }}
                        sx={{ width: { xs: '100%', sm: 300 }, '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#FBFAF7' } }}
                    />
                </Box>

                {!loading && filtered.length === 0 ? (
                    <Box sx={{ py: 5, display: 'flex', justifyContent: 'center' }}>
                        {categories.length === 0 ? (
                            <EmptyState title="No categories yet" hint="Add a category to start organising your products." />
                        ) : (
                            <EmptyState title="No matching categories" hint={`Nothing matches "${search.trim()}".`} />
                        )}
                    </Box>
                ) : (
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ ...head, width: 64, pl: 2.5 }}>No</TableCell>
                                    <TableCell sx={head}>Category</TableCell>
                                    <TableCell sx={{ ...head, display: { xs: 'none', md: 'table-cell' } }}>Description</TableCell>
                                    <TableCell align="right" sx={{ ...head, pr: 2.5 }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {loading
                                    ? [0, 1, 2, 3, 4].map((i) => (
                                          <TableRow key={i}>
                                              <TableCell sx={{ pl: 2.5 }}><Skeleton width={20} /></TableCell>
                                              <TableCell>
                                                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                                                      <Skeleton variant="rounded" width={40} height={40} />
                                                      <Skeleton width={120} />
                                                  </Stack>
                                              </TableCell>
                                              <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}><Skeleton width="70%" /></TableCell>
                                              <TableCell />
                                          </TableRow>
                                      ))
                                    : visible.map((category, index) => (
                                          <TableRow key={category._id} hover sx={{ opacity: deleting === category._id ? 0.5 : 1, '&:last-child td': { borderBottom: 0 } }}>
                                              <TableCell sx={{ pl: 2.5, color: '#8A8A8A', fontVariantNumeric: 'tabular-nums' }}>{first + index + 1}</TableCell>
                                              <TableCell>
                                                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                                                      <Avatar
                                                          variant="rounded"
                                                          src={category.image ? `${BASE_URL_IMG}${category.image}` : undefined}
                                                          alt=""
                                                          sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: '#FFF3D1', color: '#C98A00' }}
                                                      >
                                                          <IconCategory size={20} />
                                                      </Avatar>
                                                      <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#111' }}>{category.title}</Typography>
                                                  </Stack>
                                              </TableCell>
                                              <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, color: '#6B6B6B', fontSize: '0.8125rem', maxWidth: 360 }}>
                                                  <Typography noWrap title={category.description || ''} sx={{ fontSize: 'inherit', color: category.description ? 'inherit' : '#B5B3AC' }}>
                                                      {category.description || 'No description'}
                                                  </Typography>
                                              </TableCell>
                                              <TableCell sx={{ pr: 2.5, whiteSpace: 'nowrap' }} align="right">
                                                  <ActionIcon kind="edit" onClick={() => navigate(`/admin/edit-category/${category._id}`)} />
                                                  <ActionIcon kind="delete" disabled={!can(adminRole, 'category.delete') || deleting === category._id} onClick={() => handleDelete(category)} />
                                              </TableCell>
                                          </TableRow>
                                      ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

                {!loading && filtered.length > PER_PAGE && (
                    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 1.5, borderTop: '1px solid #F0EFEB', flexWrap: 'wrap', gap: 1 }}>
                        <Typography sx={{ fontSize: '0.8125rem', color: '#6B6B6B' }}>
                            Showing {first + 1}–{Math.min(first + PER_PAGE, filtered.length)} of {filtered.length}
                        </Typography>
                        <Pagination count={totalPages} page={currentPage} onChange={(e, v) => setCurrentPage(v)} shape="rounded" size="small" />
                    </Stack>
                )}
            </Box>
        </Box>
    );
};

export default AllCategories;
