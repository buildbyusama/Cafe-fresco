import PropTypes from 'prop-types';

// material-ui
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { IconArrowLeft, IconPlus } from '@tabler/icons-react';

// Row above a list or form: Back on the left (optional), a one-line summary, and the main action on the right
export default function PageToolbar({ onBack, summary, addLabel, onAdd, children }) {
    return (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', mb: 2.5, mt: 0.5 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
                {onBack && (
                    <Button variant="outlined" color="inherit" startIcon={<IconArrowLeft size={16} />} onClick={onBack} sx={{ flexShrink: 0 }}>
                        Back
                    </Button>
                )}
                {summary && (
                    <Typography sx={{ fontSize: '0.875rem', color: '#6B6B6B' }} noWrap>
                        {summary}
                    </Typography>
                )}
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1, justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
                {children}
                {onAdd && (
                    <Button variant="contained" startIcon={<IconPlus size={18} />} onClick={onAdd}>
                        {addLabel || 'Add'}
                    </Button>
                )}
            </Stack>
        </Stack>
    );
}

PageToolbar.propTypes = { onBack: PropTypes.func, summary: PropTypes.node, addLabel: PropTypes.node, onAdd: PropTypes.func, children: PropTypes.node };

// Card section used on add / edit pages
export function FormCard({ title, subtitle, children, sx }) {
    return (
        <Box sx={{ bgcolor: '#FFF', borderRadius: '16px', boxShadow: '0 4px 24px rgba(17,17,17,0.05)', p: { xs: 2, sm: 2.5 }, ...sx }}>
            {title && <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#111' }}>{title}</Typography>}
            {subtitle && <Typography sx={{ fontSize: '0.8125rem', color: '#8A877F', mt: 0.25 }}>{subtitle}</Typography>}
            <Box sx={{ display: 'grid', gap: 2, mt: title ? 2 : 0 }}>{children}</Box>
        </Box>
    );
}

FormCard.propTypes = { title: PropTypes.node, subtitle: PropTypes.node, children: PropTypes.node, sx: PropTypes.object };

// Bottom bar on add / edit pages: stays visible while scrolling long forms
export function FormActions({ onCancel, saving, submitText = 'Save', cancelText = 'Discard', disabled = false }) {
    return (
        <Box
            sx={{
                position: 'sticky',
                bottom: 0,
                zIndex: 5,
                mt: 2.5,
                mx: { xs: -1.5, sm: 0 },
                py: 1.5,
                px: { xs: 1.5, sm: 0 },
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 1,
                background: 'linear-gradient(to top, #FAF9F6 70%, rgba(250,249,246,0))'
            }}
        >
            <Button variant="outlined" color="inherit" onClick={onCancel} disabled={saving}>
                {cancelText}
            </Button>
            <Button type="submit" variant="contained" disabled={saving || disabled} sx={{ minWidth: 130 }}>
                {saving ? 'Saving…' : submitText}
            </Button>
        </Box>
    );
}

FormActions.propTypes = { onCancel: PropTypes.func, saving: PropTypes.bool, submitText: PropTypes.node, cancelText: PropTypes.node, disabled: PropTypes.bool };
