'use strict';

/**
 * BidSecure — JSON API: Admin & Audit Reports Endpoint
 */

const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const db = require('../../config/db');
const engine = require('../../engine/aucpEngine');
const { requireLogin, requireAdmin } = require('../../middleware/authMiddleware');

router.use(requireLogin);
router.use(requireAdmin);

// GET /api/admin/fraud-flags
router.get('/fraud-flags', async (req, res) => {
  try {
    const [flags] = await db.query(
      `SELECT f.*, u.name as user_name, u.email as user_email, l.title as listing_title
       FROM fraud_flags f
       JOIN users u ON f.user_id = u.id
       LEFT JOIN listings l ON f.listing_id = l.id
       ORDER BY f.flagged_at DESC`
    );

    res.json({ success: true, count: flags.length, flags });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch fraud flags.' });
  }
});

// GET /api/admin/reports/csv (CSV Export for Auction Volume, Sales, Fraud Activity)
router.get('/reports/csv', async (req, res) => {
  const startDate = req.query.startDate || '2026-01-01';
  const endDate = req.query.endDate || new Date().toISOString().split('T')[0];

  try {
    const reportData = await engine.getAdminReportData(startDate, endDate);

    // Prepare report data rows for CSV
    const reportRows = [
      {
        Report_Period: `${startDate} to ${endDate}`,
        Total_Listings_Created: reportData.summary.total_listings,
        Total_Bids_Submitted: reportData.summary.total_bids,
        Completed_Sales_Count: reportData.summary.completed_sales,
        Gross_Sales_Value_NGN: reportData.summary.total_sales_value,
        Total_Fraud_Flags: reportData.summary.total_fraud_flags,
        Exported_At: new Date().toISOString()
      }
    ];

    const fields = [
      'Report_Period',
      'Total_Listings_Created',
      'Total_Bids_Submitted',
      'Completed_Sales_Count',
      'Gross_Sales_Value_NGN',
      'Total_Fraud_Flags',
      'Exported_At'
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(reportRows);

    res.header('Content-Type', 'text/csv');
    res.attachment(`BidSecure_Audit_Report_${startDate}_to_${endDate}.csv`);
    return res.send(csv);
  } catch (err) {
    console.error('[API Admin] Error exporting CSV:', err);
    res.status(500).json({ success: false, message: 'Failed to generate CSV audit report.' });
  }
});

module.exports = router;
