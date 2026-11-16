import PropTypes from 'prop-types';

// material-ui
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// "Showing 11–20 of 57" + pages. Changing page scrolls smoothly back to the top of the list.
export default function ListFooter({ page, totalPages, onChange, total, perPage = 10, disabled = false }) {
    if (!totalPages || totalPages <= 1) {
        return total ? (
            <Typography sx={{ fontSize: '0.8125rem', color: '#8A877F', textAlign: 'center', mt: 2 }}>
                {total} {total === 1 ? 'item' : 'items'}
            </Typography>
        ) : null;
    }
    const first = (page - 1) * perPage + 1;
    const last = total ? Math.min(page * perPage, total) : page * perPage;
    return (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 2.5, px: 0.5 }}>
            <Typography sx={{ fontSize: '0.8125rem', color: '#6B6B6B' }}>
                {total ? `Showing ${first}–${last} of ${total}` : `Page ${page} of ${totalPages}`}
            </Typography>
            <Pagination
                count={totalPages}
                page={page}
                disabled={disabled}
                shape="rounded"
                onChange={(e, v) => {
                    onChange(v);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
            />
        </Stack>
    );
}

ListFooter.propTypes = { page: PropTypes.number, totalPages: PropTypes.number, onChange: PropTypes.func, total: PropTypes.number, perPage: PropTypes.number, disabled: PropTypes.bool };
