import PropTypes from 'prop-types';
import { useContext, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import productContext from '../../Context/ProductContext';
import { imgUrl } from '../home/useHomeData';

const BASE_URL = import.meta.env.VITE_BASE_URL;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 2;

// Profile picture: shows the photo (or initials), lets the customer change or remove it
export default function AvatarPicker({ initials }) {
    const { user, refreshSession } = useContext(productContext);
    const input = useRef(null);
    const [busy, setBusy] = useState(false);
    const [preview, setPreview] = useState(null);

    const upload = async (file) => {
        if (!file) return;
        if (!TYPES.includes(file.type)) return toast.error('Use a JPG, PNG or WEBP image');
        if (file.size > MAX_MB * 1024 * 1024) return toast.error(`Image must be under ${MAX_MB} MB`);
        const local = URL.createObjectURL(file);
        setPreview(local);
        setBusy(true);
        try {
            const form = new FormData();
            form.append('image', file);
            const res = await fetch(`${BASE_URL}/user/avatar`, { method: 'POST', credentials: 'include', body: form });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Could not upload the picture');
            await refreshSession();
            toast.success('Profile picture updated');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
            setPreview(null);
            URL.revokeObjectURL(local);
        }
    };

    const remove = async () => {
        setBusy(true);
        try {
            const res = await fetch(`${BASE_URL}/user/avatar`, { method: 'DELETE', credentials: 'include' });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Could not remove the picture');
            await refreshSession();
            toast.success('Profile picture removed');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    };

    const src = preview || (user?.image ? imgUrl(user.image) : null);
    return (
        <div className="fp-avatar-wrap">
            <div className={`fp-avatar${busy ? ' is-busy' : ''}`}>
                {src ? <img src={src} alt="Your profile picture" /> : <span aria-hidden="true">{initials}</span>}
            </div>
            <div className="fp-avatar-actions">
                <button type="button" onClick={() => input.current?.click()} disabled={busy} aria-label={user?.image ? 'Change profile picture' : 'Add a profile picture'}>
                    <i className="bi bi-camera" />
                </button>
                {user?.image && (
                    <button type="button" onClick={remove} disabled={busy} aria-label="Remove profile picture">
                        <i className="bi bi-trash3" />
                    </button>
                )}
            </div>
            <input ref={input} type="file" accept={TYPES.join(',')} hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
    );
}

AvatarPicker.propTypes = { initials: PropTypes.string.isRequired };
