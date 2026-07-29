'use strict';

/**
 * BidSecure — JSON API: Transactions Endpoint
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const engine = require('../../engine/aucpEngine');
const { requireLogin } = require('../../middleware/authMiddleware');

router.use(requireLogin);

// GET /api/transactions/my-purchases
router.get('/my-purchases', async (req, res) => {
  const userId = req.session.user.id;

  try {
    const [transactions] = await db.query(
      `SELECT t.id, t.listing_id, t.final_price, t.status, t.created_at, l.title as listing_title
       FROM transactions t
       JOIN listings l ON t.listing_id = l.id
       WHERE t.winner_id = ?
       ORDER BY t.created_at DESC`,
      [userId]
    );

    res.json({ success: true, count: transactions.length, transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});

// POST /api/transactions/:id/pay (Execute simulated payment)
router.post('/:id/pay', async (req, res) => {
  const txId = req.params.id;
  const userId = req.session.user.id;
  const { cardHolderName, cardNumber, expiry, cvv } = req.body;

  try {
    const result = await engine.processSimulatedPayment(txId, userId, cardHolderName, cardNumber, expiry, cvv);

    if (!result.success) {
      return res.status(result.code || 400).json({ success: false, message: result.message });
    }

    res.json({
      success: true,
      message: result.message,
      reference: result.reference,
      listingTitle: result.listingTitle,
      finalPrice: result.finalPrice
    });
  } catch (err) {
    console.error('[API Transactions] Error processing payment:', err);
    res.status(500).json({ success: false, message: 'Server error processing payment.' });
  }
});

module.exports = router;
