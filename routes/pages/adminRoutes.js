'use strict';

/**
 * BidSecure — Page Routes: Administrator Console
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const engine = require('../../engine/aucpEngine');
const { requireLogin, requireAdmin } = require('../../middleware/authMiddleware');

router.use(requireLogin);
router.use(requireAdmin);

// GET /admin/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const [userCount] = await db.query('SELECT COUNT(*) as count FROM users');
    const [listingCount] = await db.query('SELECT COUNT(*) as count FROM listings');
    const [activeListingCount] = await db.query('SELECT COUNT(*) as count FROM listings WHERE status = "active"');
    const [unreviewedFlagsCount] = await db.query('SELECT COUNT(*) as count FROM fraud_flags WHERE reviewed = 0');
    const [salesTotal] = await db.query('SELECT COALESCE(SUM(final_price), 0) as total FROM transactions WHERE status = "completed"');

    const [unreviewedFlags] = await db.query(
      `SELECT f.*, u.name as user_name, u.email as user_email, l.title as listing_title
       FROM fraud_flags f
       JOIN users u ON f.user_id = u.id
       LEFT JOIN listings l ON f.listing_id = l.id
       WHERE f.reviewed = 0
       ORDER BY f.flagged_at DESC LIMIT 10`
    );

    res.render('admin/dashboard', {
      activeTab: 'admin-dashboard',
      stats: {
        totalUsers: userCount[0].count,
        totalListings: listingCount[0].count,
        activeListings: activeListingCount[0].count,
        pendingFlags: unreviewedFlagsCount[0].count,
        totalSalesValue: parseFloat(salesTotal[0].total)
      },
      unreviewedFlags,
      success: req.query.success || null
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/fraud-flags
router.get('/fraud-flags', async (req, res, next) => {
  try {
    const [flags] = await db.query(
      `SELECT f.*, u.name as user_name, u.email as user_email, u.account_status as user_status, l.title as listing_title
       FROM fraud_flags f
       JOIN users u ON f.user_id = u.id
       LEFT JOIN listings l ON f.listing_id = l.id
       ORDER BY f.flagged_at DESC`
    );

    res.render('admin/fraud-flags', {
      activeTab: 'fraud-flags',
      flags,
      success: req.query.success || null
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/fraud-flags/review/:id
router.post('/fraud-flags/review/:id', async (req, res, next) => {
  const flagId = req.params.id;

  try {
    await db.query('UPDATE fraud_flags SET reviewed = 1 WHERE id = ?', [flagId]);
    res.redirect('/admin/fraud-flags?success=Flag marked as reviewed and resolved.');
  } catch (err) {
    next(err);
  }
});

// GET /admin/auctions
router.get('/auctions', async (req, res, next) => {
  try {
    const [listings] = await db.query(
      `SELECT l.*, u.name as seller_name 
       FROM listings l
       JOIN users u ON l.seller_id = u.id
       ORDER BY l.created_at DESC`
    );

    res.render('admin/auctions', {
      activeTab: 'all-auctions',
      listings,
      success: req.query.success || null
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/auctions/delete/:id
router.post('/auctions/delete/:id', async (req, res, next) => {
  const listingId = req.params.id;

  try {
    await db.query('DELETE FROM listings WHERE id = ?', [listingId]);
    res.redirect('/admin/auctions?success=Auction listing removed from portal.');
  } catch (err) {
    next(err);
  }
});

// GET /admin/users
router.get('/users', async (req, res, next) => {
  try {
    const [users] = await db.query('SELECT * FROM users ORDER BY created_at DESC');

    res.render('admin/users', {
      activeTab: 'users-mgmt',
      users,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/users/suspend/:id
router.post('/users/suspend/:id', async (req, res, next) => {
  const userId = req.params.id;

  try {
    await db.query('UPDATE users SET account_status = "suspended" WHERE id = ? AND role != "admin"', [userId]);
    res.redirect('/admin/users?success=User account suspended.');
  } catch (err) {
    next(err);
  }
});

// POST /admin/users/activate/:id
router.post('/admin/users/activate/:id', async (req, res, next) => {
  const userId = req.params.id;

  try {
    await db.query('UPDATE users SET account_status = "active" WHERE id = ?', [userId]);
    res.redirect('/admin/users?success=User account reactivated.');
  } catch (err) {
    next(err);
  }
});

// GET /admin/reports
router.get('/reports', async (req, res, next) => {
  const startDate = req.query.startDate || '2026-01-01';
  const endDate = req.query.endDate || new Date().toISOString().split('T')[0];

  try {
    const reportData = await engine.getAdminReportData(startDate, endDate);

    res.render('admin/reports', {
      activeTab: 'reports',
      startDate,
      endDate,
      reportData
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
