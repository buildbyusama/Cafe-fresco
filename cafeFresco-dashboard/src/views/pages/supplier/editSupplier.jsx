import React, { useEffect, useState } from 'react';
import { Box, Button } from '@mui/material';
import { useNavigate, useParams } from 'react-router';
import { apiFetch } from '../../../api/client';
import { useNotify } from '../../../contexts/NotifyContext';
import EmptyState from 'ui-component/EmptyState';
import SupplierForm from './SupplierForm';

const EditSupplierPage = () => {
    const navigate = useNavigate();
    const notify = useNotify();
    const { id } = useParams();
    const [initial, setInitial] = useState(null);
    const [status, setStatus] = useState('loading');
    const [saving, setSaving] = useState(false);
    const back = () => navigate('/admin/suppliers');

    // Load by URL id so refresh and shared links work
    useEffect(() => {
        apiFetch(`/supplier/${id}`)
            .then(({ supplier: s }) => {
                setInitial({ name: s.name ?? '', phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '', supplies: s.supplies ?? [], distributor: s.distributor?._id ?? '', isActive: s.isActive ?? true });
                setStatus('ready');
            })
            .catch(() => setStatus('notfound'));
    }, [id]);

    const handleSubmit = async (formData) => {
        setSaving(true);
        try {
            await apiFetch(`/supplier/update/${id}`, { method: 'PUT', body: formData });
            notify.success(`${formData.name} updated`);
            back();
            return null;
        } catch (err) {
            notify.error(err.message);
            return err.data?.fields || null;
        } finally {
            setSaving(false);
        }
    };

    if (status === 'notfound') {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, my: 6 }}>
                <EmptyState title="Supplier not found" hint="It may have been deleted." />
                <Button variant="contained" onClick={back}>Back to suppliers</Button>
            </Box>
        );
    }

    return <SupplierForm initial={initial} loading={status === 'loading'} saving={saving} onSubmit={handleSubmit} onCancel={back} submitText="Update supplier" />;
};

export default EditSupplierPage;
