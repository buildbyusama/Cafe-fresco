import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { apiFetch } from '../../../api/client';
import { useNotify } from '../../../contexts/NotifyContext';
import EmployeeForm from './EmployeeForm';

const EmployeeAddPage = () => {
    const navigate = useNavigate();
    const notify = useNotify();
    const [saving, setSaving] = useState(false);

    // returns field errors from the server (shown inline), or nothing on success
    const handleSubmit = async (formData) => {
        setSaving(true);
        try {
            await apiFetch('/employee/register', { method: 'POST', body: formData });
            notify.success(`${formData.name.trim()} added`);
            navigate('/admin/employees/list');
            return null;
        } catch (err) {
            notify.error(err.message);
            return err.data?.fields || null;
        } finally {
            setSaving(false);
        }
    };

    return <EmployeeForm saving={saving} onSubmit={handleSubmit} onCancel={() => navigate('/admin/employees/list')} submitText="Save Employee" />;
};

export default EmployeeAddPage;
