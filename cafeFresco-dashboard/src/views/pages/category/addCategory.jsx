import React, { useContext, useState } from 'react';
import { MainContext } from '../../context/index.jsx';
import { useNavigate } from 'react-router';
import { apiFetch } from '../../../api/client';
import { useNotify } from '../../../contexts/NotifyContext';
import CategoryForm from './CategoryForm';

const AddCategoryPage = () => {
    const { fetchCategories } = useContext(MainContext);
    const notify = useNotify();
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);

    const handleSubmit = async ({ title, description, file }) => {
        if (saving) return;
        setSaving(true);
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('image', file);

        try {
            await apiFetch('/category/add', { method: 'POST', formData });
            notify.success('Category added');
            fetchCategories();
            navigate('/admin/all-category');
        } catch (err) {
            notify.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    return <CategoryForm mode="add" saving={saving} onSubmit={handleSubmit} onCancel={() => navigate('/admin/all-category')} notify={notify} />;
};

export default AddCategoryPage;
