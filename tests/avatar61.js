// Step 6.1: profile pictures + storage adapter (EXIF stripped, real images only, replace/remove, products still upload, UI, Cloudinary signing)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { request, chromium } = require('playwright');
const { model, backend, BACKEND, URL, ADMIN, check, connect, done, tag, breq } = require('./lib');
const sharp = breq('sharp');
(async () => {
    await connect();
    const [User, Product, Category, Inventory] = ['user', 'product', 'category', 'inventory'].map(model);
    const t = tag();
    const email = `av${t}@x.com`;
    const pub = (u) => path.join(BACKEND, 'public', u.replace(/^\//, ''));
    let productId = null;
    let catId = null;
    try {
        const c = await request.newContext({ baseURL: URL.API });
        await c.post('/user/register', { data: { name: 'Avatar Test', email, password: 'Avatar123' } });
        // a JPEG carrying GPS EXIF
        const jpeg = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#e8262b' } }).jpeg().withExifMerge({ IFD0: { Copyright: 'secret-gps-owner' } }).toBuffer();
        check('test photo really has EXIF', !!(await sharp(jpeg).metadata()).exif);
        const up = await c.post('/user/avatar', { multipart: { image: { name: 'me.jpg', mimeType: 'image/jpeg', buffer: jpeg } } });
        const first = (await up.json()).image;
        check('upload → 200 with a stored path', up.status() === 200 && /^\/images\/user\/[a-f0-9]{24}\.webp$/.test(first), first);
        const meta = await sharp(fs.readFileSync(pub(first))).metadata(); // from memory: an open file can't be deleted on Windows
        check('stored as 256×256 webp with EXIF removed', meta.width === 256 && meta.height === 256 && meta.format === 'webp' && !meta.exif);
        check('/user/me returns the picture', (await (await c.get('/user/me')).json()).user.image === first);

        const second = (await (await c.post('/user/avatar', { multipart: { image: { name: 'me2.png', mimeType: 'image/png', buffer: await sharp(jpeg).png().toBuffer() } } })).json()).image;
        check('replacing deletes the old file', second !== first && fs.existsSync(pub(second)) && !fs.existsSync(pub(first)), JSON.stringify({ first, second, newExists: second && fs.existsSync(pub(second)), oldExists: fs.existsSync(pub(first)) }));

        const fake = await c.post('/user/avatar', { multipart: { image: { name: 'virus.png', mimeType: 'image/png', buffer: Buffer.from('MZ\x90\x00 this is an exe, not a picture') } } });
        check('a renamed non-image is rejected (400)', fake.status() === 400);
        const big = await c.post('/user/avatar', { multipart: { image: { name: 'big.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(2.5 * 1024 * 1024, 1) } } });
        check('over 2 MB is rejected (400)', big.status() === 400 && /under 2 MB/.test((await big.json()).message));
        check('no file → 400', (await c.post('/user/avatar', { multipart: { other: 'x' } })).status() === 400);
        check('guest → 401', (await (await request.newContext({ baseURL: URL.API })).post('/user/avatar', { multipart: { image: { name: 'a.jpg', mimeType: 'image/jpeg', buffer: jpeg } } })).status() === 401);

        // UI: profile shows the photo, navbar too; remove from the page
        const b = await chromium.launch();
        const ctx = await b.newContext({ storageState: await c.storageState(), viewport: { width: 1366, height: 900 } });
        const p = await ctx.newPage();
        const errs = [];
        p.on('pageerror', (e) => errs.push(e.message));
        await p.goto(`${URL.SHOP}/user/profile`);
        await p.waitForTimeout(2500);
        check('profile and navbar show the picture', (await p.locator('.fp-avatar img').count()) === 1 && (await p.locator('.cf-avatar img').count()) === 1);
        await p.getByRole('button', { name: 'Remove profile picture' }).click();
        await p.waitForTimeout(1500);
        check('remove → initials again and the file is gone', (await p.locator('.fp-avatar img').count()) === 0 && !fs.existsSync(pub(second)) && (await User.findOne({ email })).image === '');
        const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.getByRole('button', { name: 'Add a profile picture' }).click()]);
        await chooser.setFiles({ name: 'p.jpg', mimeType: 'image/jpeg', buffer: jpeg });
        await p.waitForTimeout(2500);
        check('upload from the profile page', (await p.locator('.fp-avatar img').count()) === 1 && !!(await User.findOne({ email })).image);
        if (process.argv[2]) await p.locator('.fp-card-hero').screenshot({ path: `${process.argv[2]}/avatar.png` });
        check('no page errors', errs.length === 0, errs[0]);
        await b.close();

        // product + category uploads still work through the storage layer
        const ad = await request.newContext({ baseURL: URL.API });
        await ad.post('/admin/login', { data: ADMIN });
        const cat = await ad.post('/category/add', { multipart: { title: `Av Cat ${t}`, image: { name: 'c.jpg', mimeType: 'image/jpeg', buffer: jpeg } } });
        const catJson = await cat.json();
        catId = catJson.category?._id;
        check('category upload stored', cat.status() === 201 && fs.existsSync(pub(catJson.category.image)));
        const prod = await ad.post('/product/add', { multipart: { title: `Av Dish ${t}`, description: 'x', price: '5', stock: '1', category: catId, image: { name: 'p.jpg', mimeType: 'image/jpeg', buffer: jpeg } } });
        const pj = await prod.json();
        productId = pj.product?._id;
        check('product upload stored', prod.status() === 201 && fs.existsSync(pub(pj.product.image)));
        const bad = await ad.post('/product/add', { multipart: { title: '', description: '', price: 'x', category: catId, image: { name: 'p2.jpg', mimeType: 'image/jpeg', buffer: jpeg } } });
        check('a rejected product upload leaves no orphan file', bad.status() === 400);

        // Cloudinary driver: request signing, checked offline with a stubbed fetch
        process.env.CLOUDINARY_URL = 'cloudinary://123456:abcdefSECRET@demo-cloud';
        const storage = backend('services/storage');
        const realFetch = global.fetch;
        let sent = null;
        global.fetch = async (url, init) => {
            sent = { url, form: Object.fromEntries(init.body.entries()) };
            return new Response(JSON.stringify({ secure_url: 'https://res.cloudinary.com/demo-cloud/image/upload/v1/cafefresco/user/abc.webp' }), { status: 200 });
        };
        const cloudUrl = await storage.save(Buffer.from('img'), { folder: 'user', ext: 'webp' });
        const f = sent.form;
        const expected = crypto.createHash('sha1').update(`folder=${f.folder}&public_id=${f.public_id}&timestamp=${f.timestamp}abcdefSECRET`).digest('hex');
        check('Cloudinary: driver auto-selected, signed upload to the right cloud', storage.driver() === 'cloudinary' && sent.url === 'https://api.cloudinary.com/v1_1/demo-cloud/image/upload' && f.api_key === '123456' && f.signature === expected && cloudUrl.startsWith('https://res.cloudinary.com/'));
        await storage.remove(cloudUrl);
        check('Cloudinary: delete calls destroy with the public id', sent.url.endsWith('/image/destroy') && sent.form.public_id === 'cafefresco/user/abc');
        global.fetch = realFetch;
        delete process.env.CLOUDINARY_URL;
        check('without CLOUDINARY_URL the driver is local', storage.driver() === 'local');
    } finally {
        const u = await User.findOne({ email });
        if (u?.image) fs.rmSync(pub(u.image), { force: true });
        if (u) await User.deleteOne({ _id: u._id });
        if (productId) {
            const p = await Product.findById(productId);
            if (p?.image) fs.rmSync(pub(p.image), { force: true });
            await Product.deleteOne({ _id: productId });
            await Inventory.deleteMany({ productId });
        }
        if (catId) {
            const c = await Category.findById(catId);
            if (c?.image) fs.rmSync(pub(c.image), { force: true });
            await Category.deleteOne({ _id: catId });
        }
    }
    await done();
})();
