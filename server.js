const express = require('express');
const path = require('path');
const loki = require('lokijs');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Initialize Pure JavaScript Database File
const db = new loki('database.db', {
    autoload: true,
    autoloadCallback: databaseInitialize,
    autosave: true, 
    autosaveInterval: 4000
});

function databaseInitialize() {
    // Ensure all data sheets exist safely in cloud storage
    if (!db.getCollection('orders')) db.addCollection('orders');
    if (!db.getCollection('products')) db.addCollection('products');
    
    let info = db.getCollection('info');
    if (!info) {
        info = db.addCollection('info');
        // Seed mock fallback business details so templates don't crash
        info.insert({
            email: 'info@mwareshop.com',
            phone: '+254 700 000000',
            address: 'Mombasa, Kenya'
        });
    }
    console.log('All JavaScript data tables ready.');
}

// 1. HOME VIEW ROUTE: Safely supplies dummy arrays and info structures
app.get('/', (req, res) => {
    try {
        const infoCollection = db.getCollection('info');
        const productsCollection = db.getCollection('products');
        
        const businessInfo = infoCollection ? infoCollection.findOne() : { email: '', phone: '', address: '' };
        const allProducts = productsCollection ? productsCollection.find() : [];

        // Passes the required components directly down into index.ejs
        res.render('index', { 
            products: allProducts, 
            info: businessInfo,
            user: null 
        });
    } catch (err) {
        res.status(500).send("Template variable rendering failure.");
    }
});

// 2. CHECKOUT SUBMISSION ROUTE
app.post('/checkout', (req, res) => {
    const orders = db.getCollection('orders');
    orders.insert({
        customerName: req.body.name || 'Walk-in Client',
        items: req.body.items || 'Inventory Items',
        total: req.body.total || '0.00',
        date: new Date().toISOString()
    });
    res.send('<h1>Order Processed!</h1><a href="/">Return to Storefront</a>');
});

// 3. ADMIN LIST ROUTES
app.get('/admin/orders', (req, res) => {
    res.json(db.getCollection('orders').find());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Online portal active on port ${PORT}`));

