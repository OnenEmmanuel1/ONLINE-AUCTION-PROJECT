'use strict';

/**
 * BidSecure — Page Routes: Buyer Bidding Portal & Public Auction Views
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const engine = require('../../engine/aucpEngine');
const { requireLogin, requireVerified } = require('../../middleware/authMiddleware');

// ─── PUBLIC ROUTES (Guests can browse, search, & view live auction details) ───

// GET /buyer/browse (Publicly accessible)
router.get('/browse', async (req, res, next) => {
  const { q, category } = req.query;

  try {
    let sql = `
      SELECT l.*, u.name as seller_name,
        (SELECT filename FROM listing_images WHERE listing_id = l.id LIMIT 1) as image_filename
      FROM listings l
      JOIN users u ON l.seller_id = u.id
      WHERE l.status = 'active' AND l.end_at > NOW()
    `;
    const params = [];

    if (q && q.trim() !== '') {
      sql += ` AND (l.title LIKE ? OR l.description LIKE ?)`;
      params.push(`%${q.trim()}%`, `%${q.trim()}%`);
    }

    if (category && category.trim() !== '') {
      sql += ` AND l.category = ?`;
      params.push(category.trim());
    }

    sql += ` ORDER BY l.created_at DESC`;

    const [listings] = await db.query(sql, params);
    const [categoriesResult] = await db.query('SELECT DISTINCT category FROM listings');
    const categories = categoriesResult.map(c => c.category);

    res.render('buyer/browse', {
      activeTab: 'browse',
      query: { q, category },
      listings,
      categories
    });
  } catch (err) {
    next(err);
  }
});

// GET /buyer/auction/:id (Publicly accessible view)
router.get('/auction/:id', async (req, res, next) => {
  const listingId = req.params.id;

  try {
    const [listings] = await db.query(
      `SELECT l.*, u.name as seller_name, u.contact as seller_contact 
       FROM listings l
       JOIN users u ON l.seller_id = u.id
       WHERE l.id = ?`,
      [listingId]
    );

    if (listings.length === 0) {
      return res.status(404).render('error', {
        title: '404 – Listing Not Found',
        message: 'The requested auction listing does not exist.',
        code: 404
      });
    }

    const listing = listings[0];

    const [images] = await db.query('SELECT * FROM listing_images WHERE listing_id = ?', [listingId]);
    const [bids] = await db.query(
      `SELECT b.*, u.name as bidder_name 
       FROM bids b
       JOIN users u ON b.bidder_id = u.id
       WHERE b.listing_id = ?
       ORDER BY b.amount DESC, b.placed_at ASC`,
      [listingId]
    );

    res.render('buyer/auction', {
      activeTab: 'browse',
      listing,
      images,
      bids
    });
  } catch (err) {
    next(err);
  }
});

// ─── AUTHENTICATED ROUTES (Require Login & Identity Profile Verification) ─────

// GET /buyer/dashboard
router.get('/dashboard', requireLogin, requireVerified, async (req, res, next) => {
  const userId = req.session.user.id;

  try {
    const [bidsCount] = await db.query('SELECT COUNT(DISTINCT listing_id) as count FROM bids WHERE bidder_id = ?', [userId]);
    const [wonCount] = await db.query('SELECT COUNT(*) as count FROM transactions WHERE winner_id = ?', [userId]);
    const [totalSpent] = await db.query('SELECT COALESCE(SUM(final_price), 0) as total FROM transactions WHERE winner_id = ? AND status = "completed"', [userId]);
    
    const [liveAuctions] = await db.query(
      `SELECT l.*, u.name as seller_name 
       FROM listings l
       JOIN users u ON l.seller_id = u.id
       WHERE l.status = 'active' AND l.end_at > NOW()
       ORDER BY l.created_at DESC LIMIT 6`
    );

    res.render('buyer/dashboard', {
      activeTab: 'dashboard',
      queryVerify: req.query.verify || null,
      stats: {
        activeBidsCount: bidsCount[0].count,
        wonCount: wonCount[0].count,
        totalSpent: parseFloat(totalSpent[0].total)
      },
      liveAuctions
    });
  } catch (err) {
    next(err);
  }
});

// GET /buyer/bid-history
router.get('/bid-history', requireLogin, requireVerified, async (req, res, next) => {
  const userId = req.session.user.id;

  try {
    const [bids] = await db.query(
      `SELECT b.*, l.title as listing_title, l.category, l.status as listing_status, l.current_highest_bid
       FROM bids b
       JOIN listings l ON b.listing_id = l.id
       WHERE b.bidder_id = ?
       ORDER BY b.placed_at DESC`,
      [userId]
    );

    res.render('buyer/bid-history', {
      activeTab: 'bids',
      bids
    });
  } catch (err) {
    next(err);
  }
});

// GET /buyer/won-auctions
router.get('/won-auctions', requireLogin, requireVerified, async (req, res, next) => {
  const userId = req.session.user.id;

  try {
    const [transactions] = await db.query(
      `SELECT t.*, l.title as listing_title, u.name as seller_name
       FROM transactions t
       JOIN listings l ON t.listing_id = l.id
       JOIN users u ON t.seller_id = u.id
       WHERE t.winner_id = ?
       ORDER BY t.created_at DESC`,
      [userId]
    );

    res.render('buyer/won-auctions', {
      activeTab: 'won',
      transactions,
      success: req.query.success ? 'Payment completed successfully! Transaction status updated to COMPLETED.' : null
    });
  } catch (err) {
    next(err);
  }
});

// GET /payment/checkout/:txId
router.get('/payment/checkout/:txId', requireLogin, requireVerified, async (req, res, next) => {
  const txId = req.params.txId;
  const userId = req.session.user.id;

  try {
    const [transactions] = await db.query(
      `SELECT t.*, l.title as listing_title, u.name as seller_name
       FROM transactions t
       JOIN listings l ON t.listing_id = l.id
       JOIN users u ON t.seller_id = u.id
       WHERE t.id = ?`,
      [txId]
    );

    if (transactions.length === 0 || transactions[0].winner_id !== userId) {
      return res.status(404).render('error', {
        title: '404 – Settlement Record Not Found',
        message: 'Invalid transaction record or unauthorized access.',
        code: 404
      });
    }

    res.render('payment/checkout', {
      activeTab: 'won',
      transaction: transactions[0],
      error: req.query.error || null
    });
  } catch (err) {
    next(err);
  }
});

// POST /payment/checkout/:txId (Execute Simulated Payment Engine Process)
router.post('/payment/checkout/:txId', requireLogin, requireVerified, async (req, res, next) => {
  const txId = req.params.txId;
  const userId = req.session.user.id;
  const { card_name, card_number, expiry, cvv } = req.body;

  try {
    const result = await engine.processSimulatedPayment(txId, userId, card_name, card_number, expiry, cvv);

    if (!result.success) {
      return res.render('payment/checkout', {
        activeTab: 'won',
        transaction: { id: txId, listing_title: 'Auction Item', seller_name: 'Seller', final_price: 0 },
        error: result.message
      });
    }

    res.redirect(`/payment/success?tx=${txId}`);
  } catch (err) {
    next(err);
  }
});

// GET /payment/success
router.get('/payment/success', requireLogin, requireVerified, async (req, res, next) => {
  const txId = req.query.tx;
  const userId = req.session.user.id;

  try {
    const [transactions] = await db.query(
      `SELECT t.*, l.title as listing_title, u.name as seller_name, u.contact as seller_contact
       FROM transactions t
       JOIN listings l ON t.listing_id = l.id
       JOIN users u ON t.seller_id = u.id
       WHERE t.id = ?`,
      [txId]
    );

    if (transactions.length === 0 || transactions[0].winner_id !== userId) {
      return res.redirect('/buyer/won-auctions');
    }

    const tx = transactions[0];
    const decryptedRef = engine.decryptData(tx.payment_reference_encrypted);

    res.render('payment/success', {
      activeTab: 'won',
      transaction: tx,
      decryptedRef
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
