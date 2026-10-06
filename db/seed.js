'use strict';

/**
 * BidSecure — Database Seeder Script
 */

const { initDatabase } = require('./initDatabase');

async function run() {
  try {
    await initDatabase(true);
    console.log('🎉 Seeding and database reset completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  }
}

run();
