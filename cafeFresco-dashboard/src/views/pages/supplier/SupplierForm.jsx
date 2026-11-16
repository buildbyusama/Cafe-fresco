import PropTypes from 'prop-types';
import { useContext, useEffect, useState } from 'react';
import { Box, Checkbox, Chip, FormControl, FormHelperText, InputLabel, ListItemText, MenuItem, Select, Skeleton, Switch, TextField, Typography } from '@mui/material';
import { MainContext } from '../../context/index.jsx';
import { FormActions, FormCard } from 'ui-component/PageToolbar';

export const SUPPLIES = ['vegetables', 'meat', 'dairy', 'beverages', 'bakery', 'other'];
export const EMPTY_SUPPLIER = { name: '', phone: '', email: '', address: '', supplies: [], distributor: '', isActive: true };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// same rules as the server's parseSupplier
function validate(f) {
    const e = {};
    if (f.name.trim().length < 2) e.name = 'Enter at least 2 characters';
    if (!/^\+?[0-9\s-]{7,15}$/.test(f.phone.trim())) e.phone = '7–15 digits, spaces or dashes';
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email';
    return e;
}

export default function SupplierForm({ initial, loading = false, saving, onSubmit, onCancel, submitText }) {
    const { distributer, fetchDistributor } = useContext(MainContext);
    const [formData, setFormData] = useState(initial || EMPTY_SUPPLIER);
    const [errors, setErrors] = useState({});
    const [lastInitial, setLastInitial] = useState(initial);

    if (initial !== lastInitial) {
        setLastInitial(initial);
        setFormData(initial || EMPTY_SUPPLIER);
    }

    // make sure the distributor list is there after a page refresh
    useEffect(() => {
        if (!(distributer || []).length) fetchDistributor?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
    };

    const submit = async (e) => {
        e.preventDefault();
        const v = validate(formData);
        if (Object.keys(v).length) {
            setErrors(v);
            document.querySelector(`[name="${Object.keys(v)[0]}"]`)?.focus();
            return;
        }
        const serverErrors = await onSubmit({ ...formData, name: formData.name.trim(), phone: formData.phone.trim(), email: formData.email.trim(), address: formData.address.trim() });
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
                        {[0, 1, 2].map((j) => <Skeleton key={j} variant="rounded" height={52} />)}
                    </FormCard>
                ))}
            </Box>
        );
    }

    const activeDistributors = (distributer || []).filter((d) => d.isActive !== false || d._id === formData.distributor);

    return (
        <Box component="form" onSubmit={submit} noValidate>
            <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr' }, alignItems: 'start' }}>
                <FormCard title="Supplier details" subtitle="The business you buy from.">
                    {field('name', 'Name', { required: true, autoFocus: !initial })}
                    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                        {field('phone', 'Phone', { required: true })}
                        {field('email', 'Email', { required: true, type: 'email' })}
                    </Box>
                    {field('address', 'Address', { multiline: true, rows: 2, helperText: 'Optional' })}
                </FormCard>

                <Box sx={{ display: 'grid', gap: 2.5 }}>
                    <FormCard title="What they supply">
                        <FormControl fullWidth error={!!errors.supplies}>
                            <InputLabel id="supplies-label">Supplies</InputLabel>
                            <Select
                                labelId="supplies-label"
                                label="Supplies"
                                multiple
                                value={formData.supplies}
                                onChange={(e) => setFormData((p) => ({ ...p, supplies: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value }))}
                                renderValue={(sel) => (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {sel.map((s) => <Chip key={s} label={cap(s)} size="small" />)}
                                    </Box>
                                )}
                            >
                                {SUPPLIES.map((s) => (
                                    <MenuItem key={s} value={s}>
                                        <Checkbox size="small" checked={formData.supplies.includes(s)} />
                                        <ListItemText primary={cap(s)} />
                                    </MenuItem>
                                ))}
                            </Select>
                            <FormHelperText>{errors.supplies || 'Pick all that apply'}</FormHelperText>
                        </FormControl>
                        {field('distributor', 'Distributor', {
                            select: true,
                            helperText: 'Optional — who delivers for them',
                            children: [
                                <MenuItem key="none" value="">No distributor</MenuItem>,
                                ...activeDistributors.map((d) => <MenuItem key={d._id} value={d._id}>{d.name}{d.isActive === false ? ' (inactive)' : ''}</MenuItem>)
                            ]
                        })}
                    </FormCard>
                    <FormCard>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box>
                                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700 }}>Active</Typography>
                                <Typography sx={{ fontSize: '0.8125rem', color: '#8A877F' }}>Inactive suppliers stay on record.</Typography>
                            </Box>
                            <Switch name="isActive" checked={formData.isActive} onChange={handleChange} inputProps={{ 'aria-label': 'Active' }} />
                        </Box>
                    </FormCard>
                </Box>
            </Box>
            <FormActions onCancel={onCancel} saving={saving} submitText={submitText} />
        </Box>
    );
}

SupplierForm.propTypes = { initial: PropTypes.object, loading: PropTypes.bool, saving: PropTypes.bool, onSubmit: PropTypes.func.isRequired, onCancel: PropTypes.func.isRequired, submitText: PropTypes.node };
