import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { Autocomplete, Box, Checkbox, Chip, FormControlLabel, MenuItem, TextField, Typography } from '@mui/material';
import { FormCard } from 'ui-component/PageToolbar';
import { apiFetch } from '../../../api/client';
import { ALLERGENS } from './foodFacts';

const TRI = [['unknown', 'Not sure'], ['true', 'Yes'], ['false', 'No']];
const SPICE = [['', 'Not set'], ['0', 'Not spicy'], ['1', 'Mild'], ['2', 'Medium'], ['3', 'Hot']];

// Tags, dietary info and allergens. "Not sure" is stored as unknown: the shop and the assistant never turn it into "no".
export default function FoodFactsCard({ data, onChange, errors = {} }) {
    const [known, setKnown] = useState([]);
    useEffect(() => {
        apiFetch('/product/tags').then((r) => setKnown((r.tags || []).map((t) => t.tag))).catch(() => {});
    }, []);

    const toggleAllergen = (a) => onChange('allergens', data.allergens.includes(a) ? data.allergens.filter((x) => x !== a) : [...data.allergens, a]);

    return (
        <FormCard title="Tags & dietary" subtitle="Used by menu filters, smart search and the AI assistant.">
            <Autocomplete
                multiple
                freeSolo
                options={known}
                value={data.tags}
                onChange={(_, v) => onChange('tags', [...new Set(v.map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 10))}
                renderTags={(value, getTagProps) => value.map((t, i) => <Chip size="small" label={t} {...getTagProps({ index: i })} key={t} />)}
                renderInput={(params) => <TextField {...params} name="tags" label="Tags" placeholder="e.g. cheesy, grilled, kids" error={!!errors.tags} helperText={errors.tags || 'Press Enter after each tag · up to 10'} />}
            />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
                <TextField select name="vegetarian" label="Vegetarian" value={data.vegetarian} onChange={(e) => onChange('vegetarian', e.target.value)} error={!!errors.dietary} helperText={errors.dietary}>
                    {TRI.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
                </TextField>
                <TextField select name="vegan" label="Vegan" value={data.vegan} onChange={(e) => onChange('vegan', e.target.value)}>
                    {TRI.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
                </TextField>
                <TextField select name="spicyLevel" label="Spice" value={String(data.spicyLevel)} onChange={(e) => onChange('spicyLevel', e.target.value)}>
                    {SPICE.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
                </TextField>
            </Box>
            <Box>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 0.5 }}>Contains allergens</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1 }}>
                    {ALLERGENS.map((a) => (
                        <FormControlLabel key={a} control={<Checkbox size="small" checked={data.allergens.includes(a)} onChange={() => toggleAllergen(a)} />} label={a[0].toUpperCase() + a.slice(1)} />
                    ))}
                </Box>
                {errors.allergens && <Typography sx={{ color: 'error.main', fontSize: '0.75rem' }}>{errors.allergens}</Typography>}
                <FormControlLabel
                    sx={{ mt: 0.5 }}
                    control={<Checkbox checked={data.allergensVerified} onChange={(e) => onChange('allergensVerified', e.target.checked)} />}
                    label={<Typography sx={{ fontSize: '0.8125rem' }}>Allergen list checked by kitchen staff (show it to customers)</Typography>}
                />
            </Box>
        </FormCard>
    );
}

FoodFactsCard.propTypes = { data: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired, errors: PropTypes.object };
