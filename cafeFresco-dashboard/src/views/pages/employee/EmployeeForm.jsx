import PropTypes from 'prop-types';
import { useContext, useState } from 'react';
import { Box, FormControlLabel, InputAdornment, MenuItem, Skeleton, Switch, TextField, Typography } from '@mui/material';
import { MainContext } from '../../context/index.jsx';
import { FormActions, FormCard } from 'ui-component/PageToolbar';

export const EMPTY_EMPLOYEE = { name: '', cnic: '', email: '', phone: '', position: '', salary: '', hireDate: '', department: '', address: '', isActive: true };

// yyyy-mm-dd in local time (toISOString would shift the day across timezones)
export const toDateInput = (d) => {
    if (!d) return '';
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return '';
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

// 13 digits → 12345-1234567-1 as the user types
const formatCnic = (v) => {
    const d = v.replace(/\D/g, '').slice(0, 13);
    return [d.slice(0, 5), d.slice(5, 12), d.slice(12)].filter(Boolean).join('-');
};

// same rules as the server's parseEmployee
function validate(f) {
    const e = {};
    if (f.name.trim().length < 2) e.name = 'Enter at least 2 characters';
    if (!/^\d{5}-\d{7}-\d$/.test(f.cnic)) e.cnic = '13 digits: 12345-1234567-1';
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email';
    if (f.phone && !/^\+?[0-9\s-]{7,15}$/.test(f.phone.trim())) e.phone = '7–15 digits, spaces or dashes';
    if (f.salary !== '' && !(Number(f.salary) >= 0)) e.salary = '0 or more';
    if (!f.department) e.department = 'Choose a department';
    return e;
}

export default function EmployeeForm({ initial, loading = false, saving, onSubmit, onCancel, submitText }) {
    const { departments } = useContext(MainContext);
    const [formData, setFormData] = useState(initial || EMPTY_EMPLOYEE);
    const [errors, setErrors] = useState({});
    const [lastInitial, setLastInitial] = useState(initial);

    // the edit page passes the loaded record once it arrives
    if (initial !== lastInitial) {
        setLastInitial(initial);
        setFormData(initial || EMPTY_EMPLOYEE);
    }

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : name === 'cnic' ? formatCnic(value) : value }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
    };

    const submit = async (e) => {
        e.preventDefault();
        const v = validate(formData);
        if (Object.keys(v).length) {
            setErrors(v);
            // bring the first problem into view
            document.querySelector(`[name="${Object.keys(v)[0]}"]`)?.focus();
            return;
        }
        const serverErrors = await onSubmit(formData);
        if (serverErrors) setErrors(serverErrors);
    };

    const field = (name, label, props = {}) => (
        <TextField name={name} label={label} value={formData[name]} onChange={handleChange} error={!!errors[name]} helperText={errors[name] || props.helperText} fullWidth {...props} />
    );

    if (loading) {
        return (
            <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                {[0, 1].map((i) => (
                    <FormCard key={i}>
                        <Skeleton width="40%" />
                        {[0, 1, 2, 3].map((j) => <Skeleton key={j} variant="rounded" height={52} />)}
                    </FormCard>
                ))}
            </Box>
        );
    }

    return (
        <Box component="form" onSubmit={submit} noValidate>
            <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr' }, alignItems: 'start' }}>
                <FormCard title="Personal details" subtitle="Who this person is and how to reach them.">
                    {field('name', 'Full name', { required: true, autoFocus: !initial })}
                    {field('cnic', 'CNIC', { required: true, placeholder: '12345-1234567-1', inputProps: { inputMode: 'numeric' }, helperText: '13 digits — dashes are added for you' })}
                    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                        {field('email', 'Email', { required: true, type: 'email' })}
                        {field('phone', 'Phone', { helperText: 'Optional' })}
                    </Box>
                    {field('address', 'Address', { multiline: true, rows: 2, helperText: 'Optional' })}
                </FormCard>

                <Box sx={{ display: 'grid', gap: 2.5 }}>
                    <FormCard title="Job" subtitle="Role, team and pay.">
                        {field('department', 'Department', {
                            select: true,
                            required: true,
                            children: (departments || []).length ? (
                                departments.map((d) => <MenuItem key={d._id} value={d._id}>{d.name}</MenuItem>)
                            ) : (
                                <MenuItem disabled value="">Create a department first</MenuItem>
                            )
                        })}
                        {field('position', 'Job title', { helperText: 'e.g. Barista, Chef' })}
                        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                            {field('salary', 'Monthly salary', { type: 'number', inputProps: { min: 0 }, InputProps: { startAdornment: <InputAdornment position="start">$</InputAdornment> }, helperText: 'Optional' })}
                            {field('hireDate', 'Hire date', { type: 'date', InputLabelProps: { shrink: true }, helperText: 'Optional' })}
                        </Box>
                    </FormCard>
                    <FormCard>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box>
                                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700 }}>Active</Typography>
                                <Typography sx={{ fontSize: '0.8125rem', color: '#8A877F' }}>Inactive staff stay on record but are marked as left.</Typography>
                            </Box>
                            <FormControlLabel sx={{ mr: 0 }} label="" control={<Switch name="isActive" checked={formData.isActive} onChange={handleChange} inputProps={{ 'aria-label': 'Active' }} />} />
                        </Box>
                    </FormCard>
                </Box>
            </Box>
            <FormActions onCancel={onCancel} saving={saving} submitText={submitText} />
        </Box>
    );
}

EmployeeForm.propTypes = { initial: PropTypes.object, loading: PropTypes.bool, saving: PropTypes.bool, onSubmit: PropTypes.func.isRequired, onCancel: PropTypes.func.isRequired, submitText: PropTypes.node };
