'use strict';

/**
 * BidSecure — Authentication & Authorization Middleware
 */

const db = require('../config/db');

// Ensure user is logged in
function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
    }
    return res.redirect('/login?returnUrl=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

// Ensure user is administrator
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(403).json({ success: false, message: 'Access denied. Administrator privilege required.' });
    }
    return res.status(403).render('error', {
      title: '403 – Access Denied',
      message: 'You do not have administrative privilege to access this page.',
      code: 403
    });
  }
  next();
}

// Ensure user account is active and verified (has complete profile name, contact, address)
async function requireVerified(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }

  const userId = req.session.user.id;
  try {
    const [users] = await db.query('SELECT account_status, name, contact, address, can_bid, can_sell FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      req.session.destroy();
      return res.redirect('/login');
    }

    const user = users[0];
    if (user.account_status !== 'active') {
      return res.status(403).render('error', {
        title: '403 – Account Suspended',
        message: 'Your account has been suspended by an administrator. Please contact support.',
        code: 403
      });
    }

    if (!user.name || !user.contact || !user.address) {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(400).json({ 
          success: false, 
          message: 'Identity verification required. Please complete your name, contact phone number, and address in your profile.' 
        });
      }
      return res.redirect('/buyer/dashboard?verify=required');
    }

    // Refresh session user state
    req.session.user.can_bid = user.can_bid;
    req.session.user.can_sell = user.can_sell;

    next();
  } catch (err) {
    console.error('[Auth Middleware] Error verifying user:', err);
    next(err);
  }
}

module.exports = {
  requireLogin,
  requireAdmin,
  requireVerified
};
