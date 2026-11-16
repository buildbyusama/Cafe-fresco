import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';
import { Box, Button, ButtonBase, CircularProgress, IconButton, Skeleton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { IconArrowLeft, IconPhotoUp, IconTrash } from '@tabler/icons-react';
import { cardRadius, cardShadow } from 'store/constant';

const MAX_MB = 2; // same as the backend upload limit
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Shared add / edit form: details on the left, image drop zone on the right
export default function CategoryForm({ mode, initial, loading = false, saving, onSubmit, onCancel, notify }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [touched, setTouched] = useState(false);
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!initial) return;
        setTitle(initial.title || '');
        setDescription(initial.description || '');
        setPreview(initial.imageUrl || null);
    }, [initial]);

    // free the object URL of a picked file
    useEffect(() => () => preview?.startsWith('blob:') && URL.revokeObjectURL(preview), [preview]);

    const pick = (f) => {
        if (!f) return;
        if (!TYPES.includes(f.type)) return notify.error('Use a JPG, PNG, WEBP or GIF image');
        if (f.size > MAX_MB * 1024 * 1024) return notify.error(`Image must be under ${MAX_MB} MB`);
        setFile(f);
        setPreview(URL.createObjectURL(f));
    };

    const clearImage = () => {
        setFile(null);
        setPreview(null);
        if (inputRef.current) inputRef.current.value = '';
    };

    const titleError = touched && title.trim().length < 2 ? 'At least 2 characters' : '';
    // editing keeps the existing image unless a new one is picked, so only a new category must have one
    const hasImage = !!file || mode === 'edit';

    const submit = (e) => {
        e.preventDefault();
        setTouched(true);
        if (title.trim().length < 2) return notify.error('Enter a category title (at least 2 characters)');
        if (!hasImage) return notify.error('Upload a category image');
        onSubmit({ title: title.trim(), description: description.trim(), file });
    };

    const card = { bgcolor: '#FFF', borderRadius: `${cardRadius}px`, boxShadow: cardShadow, p: { xs: 2, sm: 2.5 } };

    return (
        <Box component="form" onSubmit={submit} noValidate sx={{ maxWidth: 960, mx: 'auto', width: '100%' }}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2.5, gap: 2, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: '0.9375rem', color: '#6B6B6B' }}>
                    {mode === 'edit' ? 'Update the name, description or image.' : 'Categories group your products in the shop menu.'}
                </Typography>
                <Button variant="outlined" color="inherit" startIcon={<IconArrowLeft size={16} />} onClick={onCancel} sx={{ borderColor: '#E3E2DD', bgcolor: '#FFF', color: '#333' }}>
                    Back
                </Button>
            </Stack>

            <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' } }}>
                <Box sx={card}>
                    <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#111', mb: 1.5 }}>Details</Typography>
                    {loading ? (
                        <>
                            <Skeleton height={56} />
                            <Skeleton height={110} />
                        </>
                    ) : (
                        <>
                            <TextField
                                label="Title"
                                name="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                onBlur={() => setTouched(true)}
                                error={!!titleError}
                                helperText={titleError || ' '}
                                inputProps={{ maxLength: 60 }}
                                fullWidth
                                required
                                autoFocus={mode === 'add'}
                            />
                            <TextField
                                label="Description"
                                name="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                helperText={`Optional · ${description.length}/200`}
                                inputProps={{ maxLength: 200 }}
                                fullWidth
                                multiline
                                rows={4}
                                sx={{ mt: 1 }}
                            />
                        </>
                    )}
                </Box>

                <Box sx={card}>
                    <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#111', mb: 1.5 }}>Image</Typography>
                    {loading ? (
                        <Skeleton variant="rounded" height={200} />
                    ) : preview ? (
                        <Box sx={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid #EEEDE9', aspectRatio: '4 / 3' }}>
                            <Box component="img" src={preview} alt="Category preview" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            <Stack direction="row" spacing={1} sx={{ position: 'absolute', top: 8, right: 8 }}>
                                <Tooltip title="Replace image">
                                    <IconButton aria-label="Replace image" size="small" onClick={() => inputRef.current?.click()} sx={{ bgcolor: '#FFF', boxShadow: 1, '&:hover': { bgcolor: '#FFF8E6' } }}>
                                        <IconPhotoUp size={18} />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Remove image">
                                    <IconButton aria-label="Remove image" size="small" onClick={clearImage} sx={{ bgcolor: '#FFF', color: '#D32F2F', boxShadow: 1, '&:hover': { bgcolor: '#FDECEC' } }}>
                                        <IconTrash size={18} />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                        </Box>
                    ) : (
                        <ButtonBase
                            onClick={() => inputRef.current?.click()}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setDragging(true);
                            }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragging(false);
                                pick(e.dataTransfer.files?.[0]);
                            }}
                            aria-label="Upload image"
                            sx={{
                                width: '100%',
                                aspectRatio: '4 / 3',
                                flexDirection: 'column',
                                gap: 1,
                                borderRadius: '12px',
                                border: `2px dashed ${dragging || (touched && !hasImage) ? '#F5B400' : '#E0DED7'}`,
                                bgcolor: dragging ? '#FFF8E6' : '#FBFAF7',
                                fontFamily: 'inherit',
                                transition: 'all .15s',
                                '&:hover': { borderColor: '#F5B400', bgcolor: '#FFF8E6' }
                            }}
                        >
                            <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: '#FFF3D1', color: '#C98A00', display: 'grid', placeItems: 'center' }}>
                                <IconPhotoUp size={22} />
                            </Box>
                            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#222' }}>Click or drop an image</Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: '#8A8A8A' }}>JPG, PNG, WEBP or GIF · up to {MAX_MB} MB</Typography>
                        </ButtonBase>
                    )}
                    <input ref={inputRef} type="file" name="image" accept={TYPES.join(',')} hidden onChange={(e) => pick(e.target.files?.[0])} />
                </Box>
            </Box>

            <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end', mt: 2.5 }}>
                <Button onClick={onCancel} variant="outlined" color="inherit" disabled={saving} sx={{ borderColor: '#E3E2DD', bgcolor: '#FFF', color: '#333' }}>
                    Discard
                </Button>
                <Button type="submit" variant="contained" color="primary" disabled={saving || loading} sx={{ minWidth: 130 }}>
                    {saving ? <CircularProgress size={20} color="inherit" /> : mode === 'edit' ? 'Save changes' : 'Add category'}
                </Button>
            </Stack>
        </Box>
    );
}

CategoryForm.propTypes = {
    mode: PropTypes.oneOf(['add', 'edit']).isRequired,
    initial: PropTypes.object,
    loading: PropTypes.bool,
    saving: PropTypes.bool,
    onSubmit: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    notify: PropTypes.object.isRequired
};
