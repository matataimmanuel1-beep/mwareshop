const express = require('express');
const session = require('express-session');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

const app = express();
const db = new sqlite3.Database('./database.db');

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, 'public/uploads/'); },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));

app.use(session({
    secret: 'super-secure-mwareshop-key',
    resave: false,
    saveUninitialized: true
}));

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT, price REAL, description TEXT, image TEXT, in_stock INTEGER DEFAULT 1
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER, items_summary TEXT, total_price REAL, status TEXT DEFAULT 'Pending'
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS contact_info (
        id INTEGER PRIMARY KEY, email TEXT, phone TEXT, address TEXT, currency TEXT DEFAULT '$'
    )`);
    db.run(`INSERT OR IGNORE INTO contact_info (id, email, phone, address, currency) 
            VALUES (1, 'admin@mwareshop.com', '123-456-7890', 'Mwareshop HQ', '$')`);
    db.run(`CREATE TABLE IF NOT EXISTS admin_credentials (
        id INTEGER PRIMARY KEY, password TEXT
    )`);
    db.run(`INSERT OR IGNORE INTO admin_credentials (id, password) VALUES (1, 'password123')`);
    db.run(`CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT, phone TEXT, email TEXT UNIQUE, password TEXT
    )`);
});

function checkAdmin(req, res, next) {
    if (req.session.isAdmin) return next();
    res.redirect('/admin/login');
}
function checkCustomer(req, res, next) {
    if (req.session.customer) return next();
    res.redirect('/customer/login');
}

app.use((req, res, next) => {
    res.locals.customer = req.session.customer || null;
    next();
});

// ==========================================
//             STOREFRONT & CART ROUTES
// ==========================================

app.get('/', (req, res) => {
    db.all('SELECT * FROM products', [], (err, products) => {
        db.get('SELECT * FROM contact_info WHERE id = 1', [], (err, info) => {
            const cart = req.session.cart || [];
            res.render('index', { products: products || [], cart, info: info || { currency: '$' } });
        });
    });
});

app.post('/cart/add', (req, res) => {
    const productId = parseInt(req.body.product_id);
    const orderQty = parseInt(req.body.quantity) || 1;
    if (!req.session.cart) req.session.cart = [];
    
    db.get('SELECT * FROM products WHERE id = ?', [productId], (err, product) => {
        if (product && product.in_stock === 1) {
            const existingItem = req.session.cart.find(item => item.id === productId);
            if (existingItem) { existingItem.qty += orderQty; } 
            else { req.session.cart.push({ id: product.id, title: product.title, price: product.price, qty: orderQty }); }
        }
        res.redirect('/');
    });
});

app.get('/cart/clear', (req, res) => {
    req.session.cart = [];
    res.redirect('/');
});

app.post('/order/checkout', checkCustomer, (req, res) => {
    const cart = req.session.cart || [];
    if (cart.length === 0) return res.send('<h1>Your cart is empty! <a href="/">Go Back</a></h1>');
    
    let itemsSummary = cart.map(item => `${item.title} (x${item.qty})`).join(', ');
    let totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    
    db.run('INSERT INTO orders (customer_id, items_summary, total_price, status) VALUES (?, ?, ?, "Pending")',
        [req.session.customer.id, itemsSummary, totalPrice], (err) => {
            req.session.cart = [];
            res.redirect('/customer/dashboard');
        });
});

app.get('/contact', (req, res) => {
    db.get('SELECT * FROM contact_info WHERE id = 1', [], (err, info) => {
        const storeDetails = info || { email: 'admin@mwareshop.com', phone: '123-456-7890', address: 'Mwareshop HQ', currency: '$' };
        res.render('contact', { info: storeDetails });
    });
});

// ==========================================
//          CUSTOMER AUTH & DASHBOARD
// ==========================================

app.get('/customer/register', (req, res) => {
    res.render('customer-register', { error: null });
});

app.post('/customer/register', (req, res) => {
    const { name, phone, email, password } = req.body;
    db.run('INSERT INTO customers (name, phone, email, password) VALUES (?, ?, ?, ?)',
        [name, phone, email, password], (err) => {
            if (err) return res.render('customer-register', { error: 'Email already registered.' });
            res.redirect('/customer/login');
        });
});

app.get('/customer/login', (req, res) => {
    res.render('customer-login', { error: null });
});

app.post('/customer/login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM customers WHERE email = ? AND password = ?', [email, password], (err, row) => {
        if (row) {
            req.session.customer = { id: row.id, name: row.name, email: row.email };
            return res.redirect('/customer/dashboard');
        }
        res.render('customer-login', { error: 'Invalid details' });
    });
});

app.get('/customer/dashboard', checkCustomer, (req, res) => {
    db.all('SELECT * FROM orders WHERE customer_id = ? ORDER BY id DESC', [req.session.customer.id], (err, orders) => {
        db.get('SELECT * FROM contact_info WHERE id = 1', [], (err, info) => {
            res.render('customer-dashboard', { orders: orders || [], info: info || { currency: '$' } });
        });
    });
});

app.post('/customer/confirm-receipt/:id', checkCustomer, (req, res) => {
    db.run('UPDATE orders SET status = "Received" WHERE id = ? AND customer_id = ? AND status = "Confirmed (Sold)"', 
        [req.params.id, req.session.customer.id], () => {
            res.redirect('/customer/dashboard');
        });
});

app.get('/customer/logout', (req, res) => {
    req.session.customer = null;
    res.redirect('/');
});

// ==========================================
//               ADMIN WORKFLOWS
// ==========================================

app.get('/admin/login', (req, res) => {
    res.render('admin-login');
});

app.post('/admin/login', (req, res) => {
    db.get('SELECT password FROM admin_credentials WHERE id = 1', [], (err, row) => {
        if (row && req.body.password === row.password) { 
            req.session.isAdmin = true;
            return res.redirect('/admin');
        }
        res.send('Access Denied');
    });
});

// Upgraded Admin Dashboard Route: Dynamically generates storefront QR invite streaming handles
app.get('/admin', checkAdmin, (req, res) => {
    // Generate a link using the host server domain details (falls back to local development string)
    const storeLink = req.protocol + '://' + req.get('host');
    
    QRCode.toDataURL(storeLink, { width: 200, margin: 2 }, function (err, url) {
        db.all('SELECT * FROM products', [], (err, products) => {
            db.all(`SELECT orders.*, customers.name, customers.phone 
                    FROM orders JOIN customers ON orders.customer_id = customers.id 
                    ORDER BY orders.id DESC`, [], (err, orders) => {
                db.get('SELECT * FROM contact_info WHERE id = 1', [], (err, info) => {
                    res.render('admin', { products: products || [], orders: orders || [], info: info || { currency: '$' }, shopQrCode: url });
                });
            });
        });
    });
});

app.post('/admin/confirm-sale/:id', checkAdmin, (req, res) => {
    db.run('UPDATE orders SET status = "Confirmed (Sold)" WHERE id = ? AND status = "Pending"', [req.params.id], () => {
        res.redirect('/admin');
    });
});

app.post('/admin/add-product', checkAdmin, upload.single('image'), (req, res) => {
    const { title, price, description } = req.body;
    const imagePath = req.file ? '/uploads/' + req.file.filename : '';
    db.run('INSERT INTO products (title, price, description, image, in_stock) VALUES (?, ?, ?, ?, 1)', [title, price, description, imagePath], () => res.redirect('/admin'));
});

app.post('/admin/toggle-stock/:id', checkAdmin, (req, res) => {
    const productId = parseInt(req.params.id);
    const currentStock = parseInt(req.body.current_stock);
    const newStock = currentStock === 1 ? 0 : 1;
    db.run('UPDATE products SET in_stock = ? WHERE id = ?', [newStock, productId], () => res.redirect('/admin'));
});

app.post('/admin/delete-product/:id', checkAdmin, (req, res) => {
    const productId = parseInt(req.params.id);
    db.get('SELECT image FROM products WHERE id = ?', [productId], (err, product) => {
        if (product && product.image) {
            const absoluteImagePath = path.join(__dirname, 'public', product.image);
            if (fs.existsSync(absoluteImagePath)) fs.unlinkSync(absoluteImagePath);
        }
        db.run('DELETE FROM products WHERE id = ?', [productId], () => res.redirect('/admin'));
    });
});

app.post('/admin/update-contact', checkAdmin, (req, res) => {
    const { email, phone, address, currency } = req.body;
db.run('UPDATE contact_info SET email = ?, phone = ?, address = ?, currency = ? WHERE id = 1', [email, phone, address, currency], () => res.redirect('/admin'));});app.post('/admin/update-password', checkAdmin, (req, res) => {const { new_password, confirm_password } = req.body;if (new_password !== confirm_password) return res.send('Passwords do not match! Go Back');db.run('UPDATE admin_credentials SET password = ? WHERE id = 1', [new_password], () => res.send('Password changed! Dashboard'));});app.get('/logout', (req, res) => {req.session.isAdmin = false;res.redirect('/');});app.listen(3000, '0.0.0.0', () => console.log('Server running on http://localhost:3000'));
