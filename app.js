'use strict';

/**
 * BidSecure — app.js
 * Main application entry point for BidSecure Secure Online Auction Portal
 */

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const morgan = require('morgan');
const path = require('path');
const cron = require('node-cron');

const db = require('./config/db');
const engine = require('./engine/aucpEngine');

// Page Route Imports
const authRoutes = require('./routes/pages/authRoutes');
const buyerRoutes = require('./routes/pages/buyerRoutes');
const sellerRoutes = require('./routes/pages/sellerRoutes');
const adminRoutes = require('./routes/pages/adminRoutes');

// JSON API Route Imports
const apiBids = require('./routes/api/apiBids');
const apiListings = require('./routes/api/apiListings');
const apiTransactions = require('./routes/api/apiTransactions');
const apiAdmin = require('./routes/api/apiAdmin');

const app = express();

// ─── 1. View Engine ───────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── 2. Global Middleware ─────────────────────────────────────────────────────
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session Setup
const SESSION_SECRET = process.env.SESSION_SECRET || 'bidsecure_secret_key_calabar_2026_secure_auction';
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true behind HTTPS proxy in production
    httpOnly: true,
    maxAge: 12 * 60 * 60 * 1000 // 12 hours
  }
}));

// Inject logged-in user state into all EJS templates
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

// ─── 3. Page Routes ───────────────────────────────────────────────────────────
app.use('/', authRoutes);
app.use('/buyer', buyerRoutes);
app.use('/seller', sellerRoutes);
app.use('/admin', adminRoutes);

// ─── 4. JSON API Routes ───────────────────────────────────────────────────────
app.use('/api/bids', apiBids);
app.use('/api/listings', apiListings);
app.use('/api/transactions', apiTransactions);
app.use('/api/admin', apiAdmin);

// ─── 5. 404 Handler ───────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'API Endpoint not found.' });
  }
  res.status(404).render('error', {
    title: '404 – Page Not Found',
    message: 'The requested page does not exist on BidSecure.',
    code: 404
  });
});

// ─── 6. 500 Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[BidSecure App Error]:', err);
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(500).json({ success: false, message: err.message || 'Internal server error.' });
  }
  res.status(500).render('error', {
    title: '500 – Server Error',
    message: err.message || 'An unexpected server error occurred.',
    code: 500
  });
});

// ─── 7. Server Initialization & Cron Engine Loop ─────────────────────────────
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Verify MySQL Connection
    await db.query('SELECT 1');
    console.log('[BidSecure DB] MySQL database connected successfully.');

    // Start background auction lifecycle resolution job (Runs every 30 seconds)
    cron.schedule('*/30 * * * * *', async () => {
      try {
        const resolved = await engine.resolveExpiredAuctions();
        if (resolved > 0) {
          console.log(`[Cron Resolution] Auto-resolved ${resolved} expired auction(s).`);
        }
      } catch (cronErr) {
        console.error('[Cron Resolution Error]:', cronErr.message);
      }
    });
    console.log('[BidSecure Engine] Auction lifecycle resolution cron scheduled (30s interval).');

    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🛡️  BidSecure Calabar Portal running on http://localhost:${PORT}`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('[BidSecure App Startup Failed]:', err.message);
    process.exit(1);
  }
}

startServer();
