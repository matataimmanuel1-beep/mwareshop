const express = require('express');
const path = require('path');
const loki = require('lokijs');

const app = express();

// Middlewares to handle form submissions and serve styles/images
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure EJS template engine mapping
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Initialize the Pure JavaScript Database 
const db = new loki('database.db', {
    autoload: true,
    autoloadCallback: databaseInitialize,
    autosave: true, 
    autosaveInterval: 4000
});

// Create the orders data collection if it doesn't exist
function databaseInitialize() {
    let orders = db.getCollection('orders');
    if (!orders) {
        orders = db.addCollection('orders');
        console.log('Database collections initialized successfully.');
    }
}

// 1. HOME ROUTE: Render your main shop page
app.get('/', (req, res) => {
    res.render('index'); 
});

// 2. CHECKOUT ROUTE: Receive dynamic order data from forms and save it
app.post('/checkout', (req, res) => {
    try {
        const ordersCollection = db.getCollection('orders');
        
        // Grab values from the incoming frontend form structure
        const newOrder = {
            customerName: req.body.name || 'Anonymous Guest',
            email: req.body.email || 'No email provided',
            items: req.body.items || 'Cart details unspecified',
            total: req.body.total || '0.00',
            date: new Date().toISOString()
        };

        // Insert directly into memory (saves to file automatically every 4 seconds)
        ordersCollection.insert(newOrder);
        console.log('Order successfully logged in database:', newOrder);

        // Send confirmation back to user
        res.send('<h1>Order Received!</h1><p>Your order has been recorded. Thank you for shopping with us.</p><a href="/">Go Back Home</a>');
    } catch (error) {
        console.error('Checkout error handler failed:', error);
        res.status(500).send('Internal Server Error processing order.');
    }
});

// 3. ADMIN VIEW ROUTE: Review your saved client orders later
app.get('/admin/orders', (req, res) => {
    const ordersCollection = db.getCollection('orders');
    const allOrders = ordersCollection ? ordersCollection.find() : [];
    
    // Returns a raw list of orders to verify your data is tracking properly
    res.json(allOrders);
});

// 4. PORT ROUTING FOR CLOUD SERVERS (Bypasses local 3000 hardcode crashes)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Application successfully loaded and listening online on port ${PORT}`);
});

