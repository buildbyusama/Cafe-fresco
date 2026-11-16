import React, { useContext, useState, useEffect } from 'react';
import { Alert, Button } from '@mui/material';
import { MainContext } from '../../context/index.jsx';
import { useNavigate, useParams } from 'react-router';
import { apiFetch } from '../../../api/client';
import { useConfirm, useNotify } from '../../../contexts/NotifyContext';
import CategoryForm from './CategoryForm';

const EditCategoryPage = () => {
    const BASE_URL = import.meta.env.VITE_BASE_URL;
    const { fetchCategories } = useContext(MainContext);
    const notify = useNotify();
    const confirm = useConfirm();
    const navigate = useNavigate();
    const { id } = useParams();
    const [initial, setInitial] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setInitial(null);
        setLoadError('');
        apiFetch(`/category/${id}`)
            .then((data) => setInitial({ title: data.title, description: data.description, imageUrl: data.image ? `${BASE_URL}${data.image}` : null }))
            .catch((err) => setLoadError(err.message || 'Category not found'));
    }, [id, BASE_URL]);

    const handleSubmit = async ({ title, description, file }) => {
        if (saving) return;
        if (!(await confirm({ title: 'Update this category?', confirmText: 'Update' }))) return;

        setSaving(true);
        const formData = new FormData();
        formData.append('title', title);
        // Always sent so clearing the description really clears it
        formData.append('description', description);
        if (file) formData.append('image', file);

        try {
            await apiFetch(`/category/update/${id}`, { method: 'PUT', formData });
            notify.success('Category updated');
            fetchCategories();
            navigate('/admin/all-category');
        } catch (err) {
            notify.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loadError) {
        return (
            <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => navigate('/admin/all-category')}>Back to categories</Button>}>
                {loadError}
            </Alert>
        );
    }

    return (
        <CategoryForm
            mode="edit"
            initial={initial}
            loading={!initial}
            saving={saving}
            onSubmit={handleSubmit}
            onCancel={() => navigate('/admin/all-category')}
            notify={notify}
        />
    );
};

export default EditCategoryPage;
