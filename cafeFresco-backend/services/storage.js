// Where uploaded images live (SHARED_DECISIONS D11). Files written to /public vanish on Vercel, so production
// uses Cloudinary when CLOUDINARY_URL is set (cloudinary://<key>:<secret>@<cloud_name>); locally, /public works.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PUBLIC = path.join(__dirname, '..', 'public');

function cloudinaryConfig() {
    const m = String(process.env.CLOUDINARY_URL || '').match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
    return m ? { apiKey: m[1], apiSecret: m[2], cloud: m[3] } : null;
}
const driver = () => (process.env.STORAGE_DRIVER === 'cloudinary' || (process.env.STORAGE_DRIVER !== 'local' && cloudinaryConfig()) ? 'cloudinary' : 'local');

// Signed Cloudinary API call (no SDK): https://cloudinary.com/documentation/upload_images#generating_authentication_signatures
async function cloudinary(action, params) {
    const cfg = cloudinaryConfig();
    if (!cfg) throw new Error('CLOUDINARY_URL is not set');
    const timestamp = Math.floor(Date.now() / 1000);
    const signed = { ...params, timestamp };
    const toSign = Object.keys(signed).filter((k) => k !== 'file').sort().map((k) => `${k}=${signed[k]}`).join('&');
    const signature = crypto.createHash('sha1').update(toSign + cfg.apiSecret).digest('hex');
    const form = new FormData();
    for (const [k, v] of Object.entries({ ...signed, api_key: cfg.apiKey, signature })) form.append(k, v);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloud}/image/${action}`, { method: 'POST', body: form, signal: AbortSignal.timeout(20000) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Cloudinary ${action} failed: ${data.error?.message || res.status}`);
    return data;
}

/**
 * Save an image buffer. folder: 'user' | 'product' | 'category'. Returns the URL stored on the document:
 * '/images/<folder>/<name>' locally, or an https URL on Cloudinary.
 */
async function save(buffer, { folder, ext = 'webp' }) {
    const name = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
    if (driver() === 'cloudinary') {
        const data = await cloudinary('upload', { file: `data:image/${ext};base64,${buffer.toString('base64')}`, folder: `cafefresco/${folder}`, public_id: name.replace(/\.\w+$/, '') });
        return data.secure_url;
    }
    const dir = path.join(PUBLIC, 'images', folder);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(path.join(dir, name), buffer);
    return `/images/${folder}/${name}`;
}

// Delete a stored image by the URL saved on the document. Never throws (a missing file is fine).
async function remove(url) {
    if (!url) return;
    try {
        if (/^https:\/\/res\.cloudinary\.com\//.test(url)) {
            const publicId = url.split('/upload/')[1]?.replace(/^v\d+\//, '').replace(/\.\w+$/, '');
            if (publicId) await cloudinary('destroy', { public_id: publicId });
            return;
        }
        // only files inside /public/images can be removed (no path tricks)
        const file = path.join(PUBLIC, String(url).replace(/^\/+/, ''));
        if (!file.startsWith(path.join(PUBLIC, 'images'))) return;
        await fs.promises.unlink(file);
    } catch (err) {
        if (err.code !== 'ENOENT') console.error('Image delete failed:', err.message);
    }
}

module.exports = { save, remove, driver };
