'use strict';

/**
 * BidSecure — JSON API: Bids Endpoint
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const engine = require('../../engine/aucpEngine');
const { requireLogin } = require('../../middleware/authMiddleware');

// GET /api/bids/:listingId/live (Public / Polling endpoint for live auction view)
router.get('/:listingId/live', async (req, res) => {
  const listingId = req.params.listingId;

  try {
    const [listings] = await db.query(
      'SELECT id, title, starting_price, current_highest_bid, end_at, status FROM listings WHERE id = ?',
      [listingId]
    );

    if (listings.length === 0) {
      return res.status(404).json({ success: false, message: 'Listing not found.' });
    }

    const listing = listings[0];
    const now = new Date();
    const endAt = new Date(listing.end_at);
    const timeRemainingMs = Math.max(0, endAt.getTime() - now.getTime());

    const [bids] = await db.query(
      `SELECT b.id, b.amount, b.placed_at, u.name as bidder_name
       FROM bids b
       JOIN users u ON b.bidder_id = u.id
       WHERE b.listing_id = ?
       ORDER BY b.amount DESC, b.placed_at ASC`,
      [listingId]
    );

    res.json({
      success: true,
      listingId: listing.id,
      status: listing.status,
      startingPrice: listing.starting_price,
      currentHighestBid: listing.current_highest_bid,
      endAt: listing.end_at,
      timeRemainingMs,
      bids
    });
  } catch (err) {
    console.error('[API Bids] Error fetching live updates:', err);
    res.status(500).json({ success: false, message: 'Server error fetching live bid updates.' });
  }
});

// POST /api/bids/:listingId (Place bid via API - Server-side validation authoritative)
router.post('/:listingId', requireLogin, async (req, res) => {
  const listingId = req.params.listingId;
  const bidderId = req.session.user.id;
  const { amount } = req.body;

  try {
    const result = await engine.validateAndPlaceBid(listingId, bidderId, amount);

    if (!result.success) {
      return res.status(result.code || 400).json({
        success: false,
        message: result.message
      });
    }

    res.json({
      success: true,
      message: result.message,
      newHighestBid: result.newHighestBid
    });
  } catch (err) {
    console.error('[API Bids] Error placing bid:', err);
    res.status(500).json({ success: false, message: 'Server error submitting bid.' });
  }
});

module.exports = router;
