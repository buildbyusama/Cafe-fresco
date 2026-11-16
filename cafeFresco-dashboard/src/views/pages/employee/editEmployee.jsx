import React, { useEffect, useState } from 'react';
import { Box, Button } from '@mui/material';
import { useNavigate, useParams } from 'react-router';
import { apiFetch } from '../../../api/client';
import { useNotify } from '../../../contexts/NotifyContext';
import EmptyState from 'ui-component/EmptyState';
import EmployeeForm, { toDateInput } from './EmployeeForm';

const EmployeeEditPage = () => {
    const navigate = useNavigate();
    const notify = useNotify();
    const { id } = useParams();
    const [initial, setInitial] = useState(null);
    const [status, setStatus] = useState('loading'); // loading | ready | notfound
    const [saving, setSaving] = useState(false);
    const back = () => navigate('/admin/employees/list');

    // Load by URL id so refresh and shared links work (no reliance on navigation state)
    useEffect(() => {
        apiFetch(`/employee/${id}`)
            .then(({ employee }) => {
                setInitial({
                    name: employee.name ?? '',
                    cnic: employee.cnic ?? '',
                    email: employee.email ?? '',
                    phone: employee.phone ?? '',
                    position: employee.position ?? '',
                    salary: employee.salary ?? '',
                    hireDate: toDateInput(employee.hireDate),
                    department: employee.department?._id ?? '',
                    address: employee.address ?? '',
                    isActive: employee.isActive ?? true // keep inactive employees inactive
                });
                setStatus('ready');
            })
            .catch(() => setStatus('notfound'));
    }, [id]);

    const handleSubmit = async (formData) => {
        setSaving(true);
        try {
            await apiFetch(`/employee/update/${id}`, { method: 'POST', body: { employeeData: formData } });
            notify.success(`${formData.name.trim()} updated`);
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
                <EmptyState title="Employee not found" hint="They may have been deleted." />
                <Button variant="contained" onClick={back}>Back to employees</Button>
            </Box>
        );
    }

    return <EmployeeForm initial={initial} loading={status === 'loading'} saving={saving} onSubmit={handleSubmit} onCancel={back} submitText="Update Employee" />;
};

export default EmployeeEditPage;
