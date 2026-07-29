'use strict';

/**
 * BidSecure Engine — engine/aucpEngine.js
 * Dedicated business logic engine for BidSecure Online Auction Portal.
 * Handles:
 *  - Crypto encryption / decryption (AES-256-GCM)
 *  - Bid validation, ranking, and placement
 *  - Configurable fraud detection rule engine
 *  - Auction lifecycle management & scheduled resolution
 *  - Simulated payment processing
 *  - Report generation
 */

const crypto = require('crypto');
const db = require('../config/db');

// Encryption Config
const ALGORITHM = 'aes-256-gcm';
const DEFAULT_KEY_HEX = '6f8d2b9e4a1c5f3a7b8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b0a';

function getEncryptionKey() {
  const hex = process.env.ENCRYPTION_KEY || DEFAULT_KEY_HEX;
  return Buffer.from(hex.padEnd(64, '0').slice(0, 64), 'hex');
}

// ─── 1. Encryption & Decryption (AES-256-GCM) ────────────────────────────────
function encryptData(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Format: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptData(encryptedPayload) {
  if (!encryptedPayload) return null;
  try {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) return encryptedPayload; // fallback if unencrypted legacy
    
    const [ivHex, authTagHex, encryptedText] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = getEncryptionKey();
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[Crypto Engine] Decryption failed:', err.message);
    return '[Decryption Error / Invalid Key]';
  }
}

// ─── 2. Fraud Flag Detection Rules ───────────────────────────────────────────
const FRAUD_CONFIG = {
  RAPID_BIDS_TIME_WINDOW_SEC: 60,
  RAPID_BIDS_MAX_COUNT: 4,
  IMPLAUSIBLE_JUMP_MULTIPLIER: 3.0
};

async function checkFraudRules(listingId, bidderId, proposedAmount) {
  const flags = [];

  // Fetch listing details
  const [listings] = await db.query('SELECT seller_id, current_highest_bid, starting_price FROM listings WHERE id = ?', [listingId]);
  if (listings.length === 0) return flags;
  const listing = listings[0];

  // Rule 1: Self-Bidding Detection (Bidder is the seller)
  if (listing.seller_id === bidderId) {
    flags.push({
      type: 'SELF_BIDDING',
      details: `User #${bidderId} attempted to place a bid on their own listing #${listingId}.`
    });
  }

  // Rule 2: Rapid Consecutive Bids (Shill Bidding indicator)
  const [recentBids] = await db.query(
    `SELECT COUNT(*) as count FROM bids 
     WHERE bidder_id = ? AND listing_id = ? 
     AND placed_at >= DATE_SUB(NOW(), INTERVAL ? SECOND)`,
    [bidderId, listingId, FRAUD_CONFIG.RAPID_BIDS_TIME_WINDOW_SEC]
  );
  if (recentBids[0].count >= FRAUD_CONFIG.RAPID_BIDS_MAX_COUNT) {
    flags.push({
      type: 'RAPID_CONSECUTIVE_BIDS',
      details: `User #${bidderId} placed ${recentBids[0].count + 1} bids on listing #${listingId} within ${FRAUD_CONFIG.RAPID_BIDS_TIME_WINDOW_SEC} seconds.`
    });
  }

  // Rule 3: Implausible Bid Jump
  const baseline = parseFloat(listing.current_highest_bid) > 0 
    ? parseFloat(listing.current_highest_bid) 
    : parseFloat(listing.starting_price);
  
  if (baseline > 0 && proposedAmount >= baseline * FRAUD_CONFIG.IMPLAUSIBLE_JUMP_MULTIPLIER) {
    flags.push({
      type: 'IMPLAUSIBLE_BID_JUMP',
      details: `User #${bidderId} submitted a bid of ₦${proposedAmount.toLocaleString()} which is ${FRAUD_CONFIG.IMPLAUSIBLE_JUMP_MULTIPLIER}x or more above baseline ₦${baseline.toLocaleString()}.`
    });
  }

  return flags;
}

async function recordFraudFlag(userId, listingId, flagType, details) {
  await db.query(
    `INSERT INTO fraud_flags (user_id, listing_id, flag_type, details, flagged_at, reviewed)
     VALUES (?, ?, ?, ?, NOW(), 0)`,
    [userId, listingId, flagType, details]
  );
  console.warn(`[Fraud Engine] FLAG RECORDED - User: ${userId}, Listing: ${listingId}, Type: ${flagType}`);
}

// ─── 3. Real-Time Bid Validation & Placement ──────────────────────────────────
async function validateAndPlaceBid(listingId, bidderId, bidAmount) {
  const amount = parseFloat(bidAmount);
  if (isNaN(amount) || amount <= 0) {
    return { success: false, code: 400, message: 'Invalid bid amount.' };
  }

  // Fetch listing details
  const [listings] = await db.query('SELECT * FROM listings WHERE id = ?', [listingId]);
  if (listings.length === 0) {
    return { success: false, code: 404, message: 'Listing not found.' };
  }

  const listing = listings[0];
  const now = new Date();

  // Rule: Reject bids after end_at timestamp (Server-side time check is authoritative)
  if (listing.status !== 'active' || now >= new Date(listing.end_at)) {
    return { success: false, code: 400, message: 'Bidding has closed for this auction.' };
  }

  // Rule: Verify bidder identity completion (name, contact, address)
  const [users] = await db.query('SELECT account_status, can_bid, name, contact, address FROM users WHERE id = ?', [bidderId]);
  if (users.length === 0) {
    return { success: false, code: 401, message: 'User account invalid.' };
  }
  const user = users[0];
  if (user.account_status !== 'active' || !user.can_bid) {
    return { success: false, code: 403, message: 'Your account is restricted from placing bids.' };
  }
  if (!user.name || !user.contact || !user.address) {
    return { success: false, code: 400, message: 'Please complete your identity profile (name, contact, address) before bidding.' };
  }

  // Check Fraud Rules
  const fraudFlags = await checkFraudRules(listingId, bidderId, amount);

  // If bidder is seller -> hard reject and log fraud flag
  const isSelfBidding = fraudFlags.some(f => f.type === 'SELF_BIDDING');
  if (isSelfBidding) {
    for (const flag of fraudFlags) {
      await recordFraudFlag(bidderId, listingId, flag.type, flag.details);
    }
    return { success: false, code: 403, message: 'Security Alert: You cannot bid on your own listing.' };
  }

  // Server-side bid amount threshold check
  const currentHighest = parseFloat(listing.current_highest_bid);
  const startingPrice = parseFloat(listing.starting_price);
  const minimumRequiredBid = currentHighest > 0 ? currentHighest + 1.00 : startingPrice;

  if (amount < minimumRequiredBid) {
    return { 
      success: false, 
      code: 400, 
      message: `Bid amount must be at least ₦${minimumRequiredBid.toLocaleString('en-NG', { minimumFractionDigits: 2 })}.` 
    };
  }

  // Record minor non-fatal fraud flags (e.g. rapid bids or jump bids) while permitting valid bid
  for (const flag of fraudFlags) {
    await recordFraudFlag(bidderId, listingId, flag.type, flag.details);
  }

  // Atomic transaction: Insert bid record into append-only log & update listing current_highest_bid
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      'INSERT INTO bids (listing_id, bidder_id, amount, placed_at) VALUES (?, ?, ?, NOW())',
      [listingId, bidderId, amount]
    );

    await connection.query(
      'UPDATE listings SET current_highest_bid = ? WHERE id = ?',
      [amount, listingId]
    );

    await connection.commit();

    return {
      success: true,
      message: 'Bid placed successfully!',
      newHighestBid: amount
    };
  } catch (err) {
    await connection.rollback();
    console.error('[Bid Engine] Error placing bid:', err);
    return { success: false, code: 500, message: 'Database error placing bid.' };
  } finally {
    connection.release();
  }
}

// ─── 4. Auction Lifecycle & Resolution ────────────────────────────────────────
async function resolveExpiredAuctions() {
  const [expiredListings] = await db.query(
    `SELECT * FROM listings 
     WHERE status = 'active' AND end_at <= NOW()`
  );

  if (expiredListings.length === 0) return 0;

  let resolvedCount = 0;

  for (const listing of expiredListings) {
    const listingId = listing.id;

    // Fetch highest bid for this listing
    const [highestBids] = await db.query(
      `SELECT * FROM bids 
       WHERE listing_id = ? 
       ORDER BY amount DESC, placed_at ASC LIMIT 1`,
      [listingId]
    );

    const reservePrice = listing.reserve_price ? parseFloat(listing.reserve_price) : 0;
    const hasHighestBid = highestBids.length > 0;
    const winningBid = hasHighestBid ? highestBids[0] : null;
    const winningAmount = winningBid ? parseFloat(winningBid.amount) : 0;

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      if (hasHighestBid && winningAmount >= reservePrice) {
        // Reserve met! Mark listing as 'ended' (pending payment) & create transaction record
        await connection.query('UPDATE listings SET status = "ended" WHERE id = ?', [listingId]);

        await connection.query(
          `INSERT INTO transactions (listing_id, winner_id, seller_id, final_price, status, created_at)
           VALUES (?, ?, ?, ?, 'pending_payment', NOW())
           ON DUPLICATE KEY UPDATE final_price = VALUES(final_price)`,
          [listingId, winningBid.bidder_id, listing.seller_id, winningAmount]
        );

        console.log(`[Lifecycle Engine] Auction #${listingId} WON by User #${winningBid.bidder_id} for ₦${winningAmount}`);
      } else {
        // Reserve not met or no bids placed -> Mark as 'unsold'
        await connection.query('UPDATE listings SET status = "unsold" WHERE id = ?', [listingId]);
        console.log(`[Lifecycle Engine] Auction #${listingId} ENDED UNSOLD (Highest bid: ₦${winningAmount}, Reserve: ₦${reservePrice})`);
      }

      await connection.commit();
      resolvedCount++;
    } catch (err) {
      await connection.rollback();
      console.error(`[Lifecycle Engine] Error resolving auction #${listingId}:`, err);
    } finally {
      connection.release();
    }
  }

  return resolvedCount;
}

// ─── 5. Simulated Payment Processing ──────────────────────────────────────────
async function processSimulatedPayment(transactionId, userId, cardHolderName, cardNumber, expiry, cvv) {
  // Validate transaction
  const [transactions] = await db.query(
    `SELECT t.*, l.title as listing_title 
     FROM transactions t
     JOIN listings l ON t.listing_id = l.id
     WHERE t.id = ?`,
    [transactionId]
  );

  if (transactions.length === 0) {
    return { success: false, code: 404, message: 'Transaction not found.' };
  }

  const tx = transactions[0];
  if (tx.winner_id !== userId) {
    return { success: false, code: 403, message: 'Unauthorized. You are not the winner of this auction.' };
  }
  if (tx.status === 'completed') {
    return { success: false, code: 400, message: 'Payment for this transaction has already been completed.' };
  }

  // Generate simulated reference string
  const rawReference = `SIM-PAY-CALABAR-${tx.id}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Encrypt payment reference using AES-256-GCM per requirement
  const encryptedRef = encryptData(rawReference);

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Update transaction
    await connection.query(
      `UPDATE transactions 
       SET status = 'completed', payment_reference_encrypted = ?, completed_at = NOW()
       WHERE id = ?`,
      [encryptedRef, transactionId]
    );

    // 2. Update listing status to 'sold'
    await connection.query(
      `UPDATE listings SET status = 'sold' WHERE id = ?`,
      [tx.listing_id]
    );

    await connection.commit();

    return {
      success: true,
      message: 'Simulated payment processed successfully!',
      reference: rawReference,
      listingTitle: tx.listing_title,
      finalPrice: tx.final_price
    };
  } catch (err) {
    await connection.rollback();
    console.error('[Payment Engine] Error processing payment:', err);
    return { success: false, code: 500, message: 'Database error processing payment.' };
  } finally {
    connection.release();
  }
}

// ─── 6. Reporting & Analytics ──────────────────────────────────────────────────
async function getAdminReportData(startDate, endDate) {
  const start = startDate ? `${startDate} 00:00:00` : '2020-01-01 00:00:00';
  const end = endDate ? `${endDate} 23:59:59` : '2099-12-31 23:59:59';

  const [summary] = await db.query(
    `SELECT 
       (SELECT COUNT(*) FROM listings WHERE created_at BETWEEN ? AND ?) as total_listings,
       (SELECT COUNT(*) FROM bids WHERE placed_at BETWEEN ? AND ?) as total_bids,
       (SELECT COUNT(*) FROM transactions WHERE status = 'completed' AND completed_at BETWEEN ? AND ?) as completed_sales,
       (SELECT COALESCE(SUM(final_price), 0) FROM transactions WHERE status = 'completed' AND completed_at BETWEEN ? AND ?) as total_sales_value,
       (SELECT COUNT(*) FROM fraud_flags WHERE flagged_at BETWEEN ? AND ?) as total_fraud_flags`,
    [start, end, start, end, start, end, start, end, start, end]
  );

  const [recentFlags] = await db.query(
    `SELECT f.*, u.name as user_name, u.email as user_email, l.title as listing_title
     FROM fraud_flags f
     JOIN users u ON f.user_id = u.id
     LEFT JOIN listings l ON f.listing_id = l.id
     WHERE f.flagged_at BETWEEN ? AND ?
     ORDER BY f.flagged_at DESC LIMIT 50`,
    [start, end]
  );

  return {
    summary: summary[0],
    recentFlags
  };
}

module.exports = {
  encryptData,
  decryptData,
  checkFraudRules,
  recordFraudFlag,
  validateAndPlaceBid,
  resolveExpiredAuctions,
  processSimulatedPayment,
  getAdminReportData
};
