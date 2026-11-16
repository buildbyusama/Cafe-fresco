import PropTypes from 'prop-types';

// material-ui
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';

// Placeholder rows shaped like the real table, so loading never makes the page jump
export default function TableSkeleton({ rows = 6, cols = 5 }) {
    return (
        <TableContainer aria-busy="true" aria-label="Loading">
            <Table>
                <TableBody>
                    {Array.from({ length: rows }, (_, r) => (
                        <TableRow key={r}>
                            {Array.from({ length: cols }, (_, c) => (
                                <TableCell key={c} sx={{ py: 2 }}>
                                    <Skeleton variant="text" width={c === 0 ? 28 : c === cols - 1 ? 64 : `${55 + ((r * 7 + c * 13) % 35)}%`} sx={{ ml: c === cols - 1 ? 'auto' : 0 }} />
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}

TableSkeleton.propTypes = { rows: PropTypes.number, cols: PropTypes.number };
