import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { apiFetch } from '../../../api/client';
import { useNotify } from '../../../contexts/NotifyContext';
import SupplierForm from './SupplierForm';

const AddSupplierPage = () => {
    const navigate = useNavigate();
    const notify = useNotify();
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (formData) => {
        setSaving(true);
        try {
            await apiFetch('/supplier/create', { method: 'POST', body: formData });
            notify.success(`${formData.name} added`);
            navigate('/admin/suppliers');
            return null;
        } catch (err) {
            notify.error(err.message);
            return err.data?.fields || null;
        } finally {
            setSaving(false);
        }
    };

    return <SupplierForm saving={saving} onSubmit={handleSubmit} onCancel={() => navigate('/admin/suppliers')} submitText="Save supplier" />;
};

export default AddSupplierPage;
