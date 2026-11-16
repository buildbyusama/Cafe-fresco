// material-ui
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export default function Footer() {
  return (
    <Stack
      direction="row"
      sx={{
        alignItems: 'center',
        justifyContent: 'space-between',
        pt: 3,
        mt: 'auto'
      }}
    >
      <Typography variant="caption" sx={{ color: '#9A9A9A' }}>
        © {new Date().getFullYear()} Cafe Fresco
      </Typography>
    </Stack>
  );
}
