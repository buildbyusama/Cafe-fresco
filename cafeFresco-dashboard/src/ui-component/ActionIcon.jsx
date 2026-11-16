import PropTypes from 'prop-types';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { IconEye, IconKey, IconPencil, IconTrash, IconHistory } from '@tabler/icons-react';

// Compact table row action: icon + tooltip, soft tinted hover. Disabled actions keep their tooltip.
const KINDS = {
    edit: { icon: IconPencil, label: 'Edit', color: '#B07A00', hover: '#FFF3D1' },
    delete: { icon: IconTrash, label: 'Delete', color: '#D32F2F', hover: '#FDECEC' },
    view: { icon: IconEye, label: 'View', color: '#2F5DA8', hover: '#EAF1FB' },
    reset: { icon: IconKey, label: 'Send reset link', color: '#6B4FB3', hover: '#F1ECFA' },
    history: { icon: IconHistory, label: 'Order history', color: '#2E9A57', hover: '#E8F6EE' }
};

export default function ActionIcon({ kind = 'edit', label, disabled = false, onClick, ...rest }) {
    const k = KINDS[kind] || KINDS.edit;
    const Icon = k.icon;
    const text = label || k.label;
    return (
        <Tooltip title={text} arrow>
            {/* span keeps the tooltip working when the button is disabled */}
            <span style={{ display: 'inline-flex' }}>
                <IconButton
                    aria-label={text}
                    disabled={disabled}
                    onClick={onClick}
                    size="small"
                    sx={{
                        width: 34,
                        height: 34,
                        ml: 0.5,
                        borderRadius: '10px',
                        color: k.color,
                        border: '1px solid #EEEDE9',
                        bgcolor: '#FFFFFF',
                        transition: 'background-color .15s, border-color .15s',
                        '&:hover': { bgcolor: k.hover, borderColor: k.hover },
                        '&.Mui-disabled': { color: '#C9C7C1', bgcolor: '#FAFAF8' }
                    }}
                    {...rest}
                >
                    <Icon size={18} stroke={1.8} />
                </IconButton>
            </span>
        </Tooltip>
    );
}

ActionIcon.propTypes = {
    kind: PropTypes.oneOf(['edit', 'delete', 'view', 'reset', 'history']),
    label: PropTypes.string,
    disabled: PropTypes.bool,
    onClick: PropTypes.func
};
