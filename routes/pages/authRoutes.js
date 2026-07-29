'use strict';

/**
 * BidSecure — Page Routes: Authentication & Public Portal Pages
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../../config/db');

// GET / (High-Energy Public Home Page matching Image 3 visual direction)
router.get('/', async (req, res, next) => {
  try {
    const [liveAuctions] = await db.query(
      `SELECT l.*, u.name as seller_name,
        (SELECT filename FROM listing_images WHERE listing_id = l.id LIMIT 1) as image_filename
       FROM listings l
       JOIN users u ON l.seller_id = u.id
       WHERE l.status = 'active' AND l.end_at > NOW()
       ORDER BY l.created_at DESC LIMIT 6`
    );

    const featuredItem = liveAuctions.length > 0 ? liveAuctions[0] : null;

    res.render('home', {
      liveAuctions,
      featuredItem
    });
  } catch (err) {
    next(err);
  }
});

// GET /how-it-works (Dedicated Security FAQs & System Guide)
router.get('/how-it-works', (req, res) => {
  res.render('how-it-works');
});

// GET /login
router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.role === 'admin' ? '/admin/dashboard' : '/buyer/dashboard');
  }
  res.render('auth/login', {
    error: req.query.error || null,
    success: req.query.registered ? 'Account created successfully! Please sign in below.' : null,
    returnUrl: req.query.returnUrl || ''
  });
});

// POST /login
router.post('/login', async (req, res, next) => {
  const { email, password, returnUrl } = req.body;

  if (!email || !password) {
    return res.render('auth/login', {
      error: 'Please provide both email address and password.',
      success: null,
      returnUrl
    });
  }

  try {
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    
    if (users.length === 0) {
      await db.query('INSERT INTO login_audit (email, success, ip_address, attempted_at) VALUES (?, 0, ?, NOW())', [email, req.ip]);
      return res.render('auth/login', {
        error: 'Invalid credentials provided. Please check email and password.',
        success: null,
        returnUrl
      });
    }

    const user = users[0];

    if (user.account_status !== 'active') {
      await db.query('INSERT INTO login_audit (email, success, ip_address, attempted_at) VALUES (?, 0, ?, NOW())', [email, req.ip]);
      return res.render('auth/login', {
        error: 'Your account has been suspended by an administrator.',
        success: null,
        returnUrl
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      await db.query('INSERT INTO login_audit (email, success, ip_address, attempted_at) VALUES (?, 0, ?, NOW())', [email, req.ip]);
      return res.render('auth/login', {
        error: 'Invalid credentials provided. Please check email and password.',
        success: null,
        returnUrl
      });
    }

    await db.query('INSERT INTO login_audit (email, success, ip_address, attempted_at) VALUES (?, 1, ?, NOW())', [email, req.ip]);

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      can_bid: user.can_bid,
      can_sell: user.can_sell
    };

    if (returnUrl && returnUrl.startsWith('/')) {
      return res.redirect(returnUrl);
    }

    if (user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    }
    res.redirect('/buyer/dashboard');
  } catch (err) {
    next(err);
  }
});

// GET /register
router.get('/register', (req, res) => {
  res.render('auth/register', { error: null });
});

// POST /register
router.post('/register', async (req, res, next) => {
  const { name, email, password, contact, address } = req.body;

  if (!name || !email || !password || !contact || !address) {
    return res.render('auth/register', {
      error: 'All identity fields (Name, Email, Password, Contact, Address) are required.'
    });
  }

  try {
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing.length > 0) {
      return res.render('auth/register', {
        error: 'An account with this email address already exists.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.query(
      `INSERT INTO users (name, email, password_hash, contact, address, role, account_status, can_bid, can_sell)
       VALUES (?, ?, ?, ?, ?, 'user', 'active', 1, 1)`,
      [name.trim(), email.trim().toLowerCase(), passwordHash, contact.trim(), address.trim()]
    );

    res.redirect('/login?registered=1');
  } catch (err) {
    next(err);
  }
});

// GET /logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
