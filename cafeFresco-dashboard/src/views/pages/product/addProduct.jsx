import React, { useContext, useState } from 'react';
import { FOOD_EMPTY, appendFood, isFoodKey } from './foodFacts';
import { Box } from '@mui/material';
import { MainContext } from '../../context/index.jsx';
import { useNavigate } from 'react-router';
import { apiFetch } from '../../../api/client';
import { useNotify } from '../../../contexts/NotifyContext';
import { FormActions } from 'ui-component/PageToolbar';
import ProductFields from './ProductFields';

const EMPTY = { title: '', description: '', image: null, price: '', discount: '', stock: '', category: '', featured: false, newRelease: false, ...FOOD_EMPTY };

const validate = (d) => {
    const errors = {};
    if (d.title.trim().length < 2) errors.title = 'Product name is required';
    if (!d.description.trim()) errors.description = 'Description is required';
    if (d.price === '' || Number(d.price) < 0) errors.price = 'Price must be 0 or more';
    if (d.discount !== '' && (Number(d.discount) < 0 || Number(d.discount) > 100)) errors.discount = 'Discount must be 0–100';
    if (d.stock === '' || !Number.isInteger(Number(d.stock)) || Number(d.stock) < 0) errors.stock = 'Stock must be a whole number of 0 or more';
    if (!d.category) errors.category = 'Choose a category';
    return errors;
};

const ProductAddPage = () => {
    const { categories } = useContext(MainContext);
    const navigate = useNavigate();
    const notify = useNotify();
    const [productData, setProductData] = useState(EMPTY);
    const [imagePreview, setImagePreview] = useState(null);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (saving) return;
        const found = validate(productData);
        setErrors(found);
        if (Object.keys(found).length) {
            document.querySelector(`[name="${Object.keys(found)[0]}"]`)?.focus();
            return;
        }

        const formData = new FormData();
        Object.entries({ ...productData, discount: productData.discount === '' ? 0 : productData.discount }).forEach(([key, value]) => {
            if (key === 'image' && !value) return;
            if (isFoodKey(key)) return;
            formData.append(key, value);
        });
        appendFood(formData, productData);

        setSaving(true);
        try {
            await apiFetch('/product/add', { method: 'POST', formData });
            notify.success(`${productData.title.trim()} added`);
            navigate('/admin/all-product');
        } catch (err) {
            if (err.data?.fields) setErrors(err.data.fields);
            notify.error(err.message);
        } finally {
            setSaving(false);
        }
    };

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
                }}
                onRemoveImage={() => {
                    setProductData((p) => ({ ...p, image: null }));
                    setImagePreview(null);
                }}
                categories={categories || []}
                mode="add"
                notify={notify}
            />
            <FormActions onCancel={() => navigate('/admin/all-product')} saving={saving} submitText="Add Product" cancelText="Discard Changes" />
        </Box>
    );
};

export default ProductAddPage;
