import PropTypes from 'prop-types';
import { useRef, useState } from 'react';
import { Box, ButtonBase, IconButton, InputAdornment, MenuItem, Stack, Switch, TextField, Tooltip, Typography } from '@mui/material';
import { FormCard } from 'ui-component/PageToolbar';
import { formatMoney } from '../../../utils/format';
import { IconPhotoUp, IconTrash } from '@tabler/icons-react';

const MAX_MB = 2; // same as the backend upload limit
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Shared add / edit product layout. The page owns the data and submit; this only lays fields out.
export default function ProductFields({ data, onChange, errors = {}, preview, onPickImage, onRemoveImage, categories = [], mode = 'add', notify }) {
    const inputRef = useRef(null);
    const [dragging, setDragging] = useState(false);

    const set = (e) => {
        const { name, value, type, checked } = e.target;
        onChange(name, type === 'checkbox' ? checked : value);
    };

    const pick = (file) => {
        if (!file) return;
        if (!TYPES.includes(file.type)) return notify?.error('Use a JPG, PNG, WEBP or GIF image');
        if (file.size > MAX_MB * 1024 * 1024) return notify?.error(`Image must be under ${MAX_MB} MB`);
        onPickImage(file);
    };

    const price = Number(data.price) || 0;
    const discount = Math.min(100, Math.max(0, Number(data.discount) || 0));
    const final = price * (1 - discount / 100);

    const toggle = (name, label, hint) => (
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
            <Box>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>{label}</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#8A877F' }}>{hint}</Typography>
            </Box>
            <Switch name={name} checked={!!data[name]} onChange={set} inputProps={{ 'aria-label': label }} />
        </Stack>
    );

    return (
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' }, alignItems: 'start' }}>
            <Box sx={{ display: 'grid', gap: 2.5 }}>
                <FormCard title="General information" subtitle="What customers see in the menu.">
                    <TextField label="Product Name" name="title" value={data.title} onChange={set} required fullWidth autoFocus={mode === 'add'} error={!!errors.title} helperText={errors.title} inputProps={{ maxLength: 80 }} />
                    <TextField
                        select
                        label="Category"
                        name="category"
                        value={data.category}
                        onChange={set}
                        required
                        fullWidth
                        error={!!errors.category}
                        helperText={errors.category}
                    >
                        {categories.length ? categories.map((c) => <MenuItem key={c._id} value={c._id}>{c.title}</MenuItem>) : <MenuItem disabled value="">Create a category first</MenuItem>}
                    </TextField>
                    <TextField label="Description" name="description" value={data.description} onChange={set} required fullWidth multiline rows={4} error={!!errors.description} helperText={errors.description || `${String(data.description || '').length}/1000`} inputProps={{ maxLength: 1000 }} />
                </FormCard>

                <FormCard title="Pricing">
                    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                        <TextField label="Base Price" name="price" type="number" value={data.price} onChange={set} required error={!!errors.price} helperText={errors.price} inputProps={{ min: 0, step: '0.01' }} InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
                        <TextField label="Discount" name="discount" type="number" value={data.discount} onChange={set} error={!!errors.discount} helperText={errors.discount || 'Optional, 0–100'} inputProps={{ min: 0, max: 100 }} InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} />
                    </Box>
                    {/* live preview of what the shop will charge */}
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', px: 1.5, py: 1.25, borderRadius: '10px', bgcolor: '#FBFAF7', border: '1px solid #F0EFEB' }}>
                        <Typography sx={{ fontSize: '0.8125rem', color: '#6B6B6B' }}>Customer pays</Typography>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
                            {discount > 0 && price > 0 && <Typography sx={{ fontSize: '0.8125rem', color: '#A3A19A', textDecoration: 'line-through' }}>{formatMoney(price)}</Typography>}
                            <Typography sx={{ fontSize: '1.125rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(final)}</Typography>
                        </Stack>
                    </Stack>
                </FormCard>
            </Box>

            <Box sx={{ display: 'grid', gap: 2.5 }}>
                <FormCard title="Image">
                    {preview ? (
                        <Box sx={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid #EEEDE9', aspectRatio: '4 / 3' }}>
                            <Box component="img" src={preview} alt="Product preview" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            <Stack direction="row" spacing={1} sx={{ position: 'absolute', top: 8, right: 8 }}>
                                <Tooltip title="Replace image">
                                    <IconButton aria-label="Replace image" size="small" onClick={() => inputRef.current?.click()} sx={{ bgcolor: '#FFF', boxShadow: 1, '&:hover': { bgcolor: '#FFF8E6' } }}>
                                        <IconPhotoUp size={18} />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Remove image">
                                    <IconButton aria-label="Remove image" size="small" onClick={onRemoveImage} sx={{ bgcolor: '#FFF', color: '#D32F2F', boxShadow: 1, '&:hover': { bgcolor: '#FDECEC' } }}>
                                        <IconTrash size={18} />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                        </Box>
                    ) : (
                        <ButtonBase
                            onClick={() => inputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); }}
                            aria-label="Upload image"
                            sx={{ width: '100%', aspectRatio: '4 / 3', flexDirection: 'column', gap: 1, borderRadius: '12px', border: `2px dashed ${dragging ? '#F5B400' : '#E0DED7'}`, bgcolor: dragging ? '#FFF8E6' : '#FBFAF7', fontFamily: 'inherit', transition: 'all .15s', '&:hover': { borderColor: '#F5B400', bgcolor: '#FFF8E6' } }}
                        >
                            <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: '#FFF3D1', color: '#C98A00', display: 'grid', placeItems: 'center' }}>
                                <IconPhotoUp size={22} />
                            </Box>
                            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#222' }}>Click or drop an image</Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: '#8A8A8A' }}>JPG, PNG, WEBP or GIF · up to {MAX_MB} MB · optional</Typography>
                        </ButtonBase>
                    )}
                    <input ref={inputRef} type="file" name="image" accept={TYPES.join(',')} hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
                </FormCard>

                <FormCard title="Stock">
                    <TextField
                        label="Stock"
                        name="stock"
                        type="number"
                        value={data.stock}
                        onChange={set}
                        required={mode === 'add'}
                        fullWidth
                        error={!!errors.stock}
                        helperText={errors.stock || (mode === 'edit' ? 'Sets the exact count. For deliveries, use Inventory → Add.' : 'Units available to sell now')}
                        inputProps={{ min: 0, step: 1 }}
                    />
                </FormCard>

                <FormCard title="Visibility">
                    {mode === 'edit' && toggle('isActive', 'Active', 'Shown in the shop')}
                    {toggle('featured', 'Featured', 'Highlighted on the home page')}
                    {toggle('newRelease', 'New Release', 'Listed under new arrivals')}
                </FormCard>
            </Box>
        </Box>
    );
}

ProductFields.propTypes = {
    data: PropTypes.object.isRequired,
    onChange: PropTypes.func.isRequired,
    errors: PropTypes.object,
    preview: PropTypes.string,
    onPickImage: PropTypes.func.isRequired,
    onRemoveImage: PropTypes.func.isRequired,
    categories: PropTypes.array,
    mode: PropTypes.oneOf(['add', 'edit']),
    notify: PropTypes.object
};
