import React, { useContext, useEffect, useState } from 'react';
import { Alert, Box, Button, Skeleton } from '@mui/material';
import { MainContext } from '../../context/index.jsx';
import { useNavigate, useParams } from 'react-router';
import { apiFetch } from '../../../api/client';
import { useConfirm, useNotify } from '../../../contexts/NotifyContext';
import EmptyState from 'ui-component/EmptyState';
import { FormActions, FormCard } from 'ui-component/PageToolbar';
import ProductFields from './ProductFields';

const EMPTY = { title: '', description: '', image: null, price: '', discount: '', stock: '', category: '', featured: false, newRelease: false, isActive: true };
const KEYS = ['title', 'description', 'price', 'discount', 'stock', 'category', 'featured', 'newRelease', 'isActive'];

const validate = (d) => {
    const errors = {};
    if (String(d.title).trim().length < 2) errors.title = 'Product name is required';
    if (!String(d.description).trim()) errors.description = 'Description is required';
    if (d.price === '' || Number(d.price) < 0) errors.price = 'Price must be 0 or more';
    if (d.discount !== '' && (Number(d.discount) < 0 || Number(d.discount) > 100)) errors.discount = 'Discount must be 0–100';
    if (d.stock !== '' && (!Number.isInteger(Number(d.stock)) || Number(d.stock) < 0)) errors.stock = 'Stock must be a whole number of 0 or more';
    if (!d.category) errors.category = 'Choose a category';
    return errors;
};

const ProductEditPage = () => {
    const BASE_URL = import.meta.env.VITE_BASE_URL;
    const { categories } = useContext(MainContext);
    const navigate = useNavigate();
    const notify = useNotify();
    const confirm = useConfirm();
    const { id } = useParams();
    const [productData, setProductData] = useState(EMPTY);
    const [original, setOriginal] = useState(EMPTY);
    const [imagePreview, setImagePreview] = useState(null);
    const [imageRemoved, setImageRemoved] = useState(false);
    const [status, setStatus] = useState('loading'); // loading | ready | notfound | error
    const [loadError, setLoadError] = useState('');
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const back = () => navigate('/admin/all-product');

    useEffect(() => {
        const controller = new AbortController();
        setStatus('loading');
        apiFetch(`/product/${id}?includeInactive=true`, { signal: controller.signal })
            .then((data) => {
                // ?? keeps real zeros (discount 0, stock 0) instead of turning them into ""
                const loaded = {
                    title: data.title ?? '',
                    description: data.description ?? '',
                    image: data.image || null,
                    price: data.price ?? '',
                    discount: data.discount ?? 0,
                    stock: data.inventory?.quantityInStock ?? '',
                    category: data.category?._id ?? '',
                    featured: !!data.featured,
                    newRelease: !!data.newRelease,
                    isActive: data.isActive !== false
                };
                setProductData(loaded);
                setOriginal(loaded);
                setImagePreview(data.image ? `${BASE_URL}${data.image}` : null);
                setStatus('ready');
            })
            .catch((err) => {
                if (err.name === 'AbortError') return;
                if (err.status === 400 || err.status === 404) setStatus('notfound');
                else {
                    setLoadError(err.message);
                    setStatus('error');
                }
            });
        return () => controller.abort();
    }, [id, BASE_URL]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (saving) return;
        const found = validate(productData);
        setErrors(found);
        if (Object.keys(found).length) {
            document.querySelector(`[name="${Object.keys(found)[0]}"]`)?.focus();
            return;
        }

        // Send only what changed
        const formData = new FormData();
        for (const key of KEYS) {
            if (String(productData[key]) !== String(original[key])) formData.append(key, productData[key]);
        }
        // the server refuses the new stock if sales changed it since this page loaded
        if (formData.has('stock') && original.stock !== '') formData.append('expectedStock', original.stock);
        if (productData.image instanceof File) formData.append('image', productData.image);
        else if (imageRemoved) formData.append('removeImage', 'true');
        if ([...formData.keys()].length === 0) return notify.info('Nothing changed');

        if (!(await confirm({ title: `Update ${productData.title.trim()}?`, message: 'Changes show in the shop straight away.', confirmText: 'Update' }))) return;

        setSaving(true);
        try {
            await apiFetch(`/product/update/${id}`, { method: 'PUT', formData });
            notify.success(`${productData.title.trim()} updated`);
            back();
        } catch (err) {
            if (err.data?.fields) setErrors(err.data.fields);
            notify.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (status === 'notfound') {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, my: 6 }}>
                <EmptyState title="Product not found" hint="It may have been deleted, or the link is wrong." />
                <Button variant="contained" onClick={back}>Back to products</Button>
            </Box>
        );
    }
    if (status === 'error') {
        return <Alert severity="error" action={<Button color="inherit" size="small" onClick={back}>Back to products</Button>}>{loadError}</Alert>;
    }
    if (status === 'loading') {
        return (
            <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' } }}>
                <FormCard><Skeleton width="40%" />{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={i === 2 ? 110 : 52} />)}</FormCard>
                <FormCard><Skeleton width="30%" /><Skeleton variant="rounded" height={200} /></FormCard>
            </Box>
        );
    }

    return (
        <Box component="form" onSubmit={handleSubmit} noValidate>
            <ProductFields
                data={productData}
                onChange={(name, value) => {
                    setProductData((p) => ({ ...p, [name]: value }));
                    if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }));
                }}
                errors={errors}
                preview={imagePreview}
                onPickImage={(file) => {
                    setProductData((p) => ({ ...p, image: file }));
                    setImagePreview(URL.createObjectURL(file));
                    setImageRemoved(false);
                }}
                onRemoveImage={() => {
                    setProductData((p) => ({ ...p, image: null }));
                    setImagePreview(null);
                    setImageRemoved(!!original.image);
                }}
                categories={categories || []}
                mode="edit"
                notify={notify}
            />
            <FormActions onCancel={back} saving={saving} submitText="Update Product" cancelText="Discard Changes" />
        </Box>
    );
};

export default ProductEditPage;
