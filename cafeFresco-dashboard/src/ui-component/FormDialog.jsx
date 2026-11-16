import PropTypes from 'prop-types';

// material-ui
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { IconX } from '@tabler/icons-react';

// Add / edit modal: a real <form> (Enter submits), icon + title + subtitle, saving state that blocks double submits
// and closing mid-save. Children are the fields.
export default function FormDialog({ open, onClose, onSubmit, title, subtitle, icon, submitText = 'Save', saving = false, danger = false, maxWidth = 'sm', children, submitDisabled = false, hideSubmit = false, cancelText = 'Cancel' }) {
    const close = () => !saving && onClose();
    return (
        <Dialog open={open} onClose={close} maxWidth={maxWidth} fullWidth aria-labelledby="cf-form-dialog-title">
            <Box
                component="form"
                noValidate
                autoComplete="off"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (!saving && !submitDisabled) onSubmit?.(e);
                }}
            >
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', px: 3, pt: 2.5, pb: 1.5 }}>
                    {icon && (
                        <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: danger ? '#FDECEC' : '#FFF3D1', color: danger ? '#D32F2F' : '#C98A00', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                            {icon}
                        </Box>
                    )}
                    <Box sx={{ flex: 1, minWidth: 0, pt: icon ? 0.25 : 0 }}>
                        <Typography id="cf-form-dialog-title" component="h2" sx={{ fontSize: '1.0625rem', fontWeight: 700, color: '#111', lineHeight: 1.3 }}>
                            {title}
                        </Typography>
                        {subtitle && <Typography sx={{ fontSize: '0.8125rem', color: '#6B6B6B', mt: 0.25 }}>{subtitle}</Typography>}
                    </Box>
                    <IconButton aria-label="Close" onClick={close} disabled={saving} size="small" sx={{ color: '#8A877F', mt: -0.5, mr: -1 }}>
                        <IconX size={18} />
                    </IconButton>
                </Stack>

                <Box sx={{ px: 3, pt: 1, pb: 1, display: 'grid', gap: 2 }}>{children}</Box>

                <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', px: 3, pt: 2, pb: 2.5 }}>
                    <Button variant="outlined" color="inherit" onClick={close} disabled={saving}>
                        {cancelText}
                    </Button>
                    {!hideSubmit && (
                        <Button type="submit" variant="contained" color={danger ? 'error' : 'primary'} disabled={saving || submitDisabled} sx={{ minWidth: 104 }}>
                            {saving ? <CircularProgress size={18} color="inherit" /> : submitText}
                        </Button>
                    )}
                </Stack>
            </Box>
        </Dialog>
    );
}

FormDialog.propTypes = {
    open: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
    onSubmit: PropTypes.func,
    title: PropTypes.node,
    subtitle: PropTypes.node,
    icon: PropTypes.node,
    submitText: PropTypes.node,
    cancelText: PropTypes.node,
    saving: PropTypes.bool,
    danger: PropTypes.bool,
    maxWidth: PropTypes.string,
    children: PropTypes.node,
    submitDisabled: PropTypes.bool,
    hideSubmit: PropTypes.bool
};
