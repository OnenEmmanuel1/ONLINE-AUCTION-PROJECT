'use strict';

/**
 * BidSecure — JSON API: Listings Endpoint
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// GET /api/listings (JSON API for active auctions)
router.get('/', async (req, res) => {
  const { category, search } = req.query;

  try {
    let sql = `
      SELECT l.id, l.title, l.category, l.starting_price, l.current_highest_bid, l.end_at, l.status, u.name as seller_name
      FROM listings l
      JOIN users u ON l.seller_id = u.id
      WHERE l.status = 'active' AND l.end_at > NOW()
    `;
    const params = [];

    if (category) {
      sql += ' AND l.category = ?';
      params.push(category);
    }
    if (search) {
      sql += ' AND (l.title LIKE ? OR l.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY l.created_at DESC';

    const [listings] = await db.query(sql, params);
    res.json({ success: true, count: listings.length, listings });
  } catch (err) {
    console.error('[API Listings] Error:', err);
    res.status(500).json({ success: false, message: 'Database query failed.' });
  }
});

// GET /api/listings/:id
router.get('/:id', async (req, res) => {
  try {
    const [listings] = await db.query(
      `SELECT l.*, u.name as seller_name FROM listings l JOIN users u ON l.seller_id = u.id WHERE l.id = ?`,
      [req.params.id]
    );

    if (listings.length === 0) {
      return res.status(404).json({ success: false, message: 'Listing not found.' });
    }

    const [images] = await db.query('SELECT filename, storage_path FROM listing_images WHERE listing_id = ?', [req.params.id]);

    res.json({
      success: true,
      listing: listings[0],
      images
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error retrieving listing.' });
  }
});

module.exports = router;
