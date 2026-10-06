'use strict';

/**
 * BidSecure — Page Routes: Seller Portal
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const upload = require('../../middleware/uploadMiddleware');
const { requireLogin, requireVerified } = require('../../middleware/authMiddleware');

router.use(requireLogin);
router.use(requireVerified);

// GET /seller/dashboard
router.get('/dashboard', async (req, res, next) => {
  const sellerId = req.session.user.id;

  try {
    const [activeCount] = await db.query('SELECT COUNT(*) as count FROM listings WHERE seller_id = ? AND status = "active"', [sellerId]);
    const [draftCount] = await db.query('SELECT COUNT(*) as count FROM listings WHERE seller_id = ? AND status = "draft"', [sellerId]);
    const [soldCount] = await db.query('SELECT COUNT(*) as count FROM listings WHERE seller_id = ? AND status = "sold"', [sellerId]);
    const [revenue] = await db.query('SELECT COALESCE(SUM(final_price), 0) as total FROM transactions WHERE seller_id = ? AND status = "completed"', [sellerId]);

    const [recentListings] = await db.query(
      `SELECT * FROM listings WHERE seller_id = ? ORDER BY created_at DESC LIMIT 5`,
      [sellerId]
    );

    res.render('seller/dashboard', {
      activeTab: 'seller-dashboard',
      stats: {
        activeListingsCount: activeCount[0].count,
        draftListingsCount: draftCount[0].count,
        completedSalesCount: soldCount[0].count,
        totalRevenue: parseFloat(revenue[0].total)
      },
      listings: recentListings
    });
  } catch (err) {
    next(err);
  }
});

// GET /seller/create-listing
router.get('/create-listing', (req, res) => {
  res.render('seller/create-listing', {
    activeTab: 'create-listing',
    error: null
  });
});

// POST /seller/create-listing (Multer photo upload + DB record creation)
router.post('/create-listing', upload.array('images', 10), async (req, res, next) => {
  const sellerId = req.session.user.id;
  const { title, category, description, reserve_price, duration_days, status } = req.body;

  if (!title || !category || !description || !req.files || req.files.length === 0) {
    return res.render('seller/create-listing', {
      activeTab: 'create-listing',
      error: 'Please fill in all required fields and upload an item image.'
    });
  }

  try {
    const startAt = new Date();
    const days = parseInt(duration_days || '3', 10);
    const endAt = new Date(startAt.getTime() + days * 24 * 60 * 60 * 1000);

    const reservePriceNum = reserve_price && parseFloat(reserve_price) > 0 ? parseFloat(reserve_price) : null;
    const listingStatus = status === 'draft' ? 'draft' : 'active';

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        `INSERT INTO listings (seller_id, title, description, category, starting_price, reserve_price, current_highest_bid, start_at, end_at, status, created_at)
         VALUES (?, ?, ?, ?, 0.00, ?, 0.00, ?, ?, ?, NOW())`,
        [sellerId, title.trim(), description.trim(), category.trim(), reservePriceNum, startAt, endAt, listingStatus]
      );

      const listingId = result.insertId;

      for (const file of req.files) {
        await connection.query(
          `INSERT INTO listing_images (listing_id, filename, storage_path, created_at)
           VALUES (?, ?, ?, NOW())`,
          [listingId, file.filename, file.path]
        );
      }

      await connection.commit();
      res.redirect('/seller/my-listings?success=Listing created successfully!');
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
});

// GET /seller/my-listings
router.get('/my-listings', async (req, res, next) => {
  const sellerId = req.session.user.id;

  try {
    const [listings] = await db.query(
      `SELECT l.*, 
         (SELECT COUNT(*) FROM bids WHERE listing_id = l.id) as bid_count
       FROM listings l
       WHERE l.seller_id = ?
       ORDER BY l.created_at DESC`,
      [sellerId]
    );

    res.render('seller/my-listings', {
      activeTab: 'my-listings',
      listings,
      success: req.query.success || null
    });
  } catch (err) {
    next(err);
  }
});

// POST /seller/publish-listing/:id
router.post('/publish-listing/:id', async (req, res, next) => {
  const listingId = req.params.id;
  const sellerId = req.session.user.id;

  try {
    await db.query('UPDATE listings SET status = "active" WHERE id = ? AND seller_id = ? AND status = "draft"', [listingId, sellerId]);
    res.redirect('/seller/my-listings?success=Listing published and is now live for bidding!');
  } catch (err) {
    next(err);
  }
});

// GET /seller/listing-bids/:id
router.get('/listing-bids/:id', async (req, res, next) => {
  const listingId = req.params.id;
  const sellerId = req.session.user.id;

  try {
    const [listings] = await db.query('SELECT * FROM listings WHERE id = ? AND seller_id = ?', [listingId, sellerId]);
    if (listings.length === 0) {
      return res.status(404).render('error', {
        title: '404 – Listing Not Found',
        message: 'The requested listing does not exist under your account.',
        code: 404
      });
    }

    const [bids] = await db.query(
      `SELECT b.*, u.name as bidder_name, u.contact as bidder_contact
       FROM bids b
       JOIN users u ON b.bidder_id = u.id
       WHERE b.listing_id = ?
       ORDER BY b.amount DESC, b.placed_at ASC`,
      [listingId]
    );

    res.render('seller/listing-bids', {
      activeTab: 'my-listings',
      listing: listings[0],
      bids
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
