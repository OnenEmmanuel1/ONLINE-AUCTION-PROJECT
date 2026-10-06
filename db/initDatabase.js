'use strict';

/**
 * BidSecure — Database Auto-Initializer & Seeder
 * Safely creates tables without attempting OS directory rmdir (avoiding errno 41).
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const engine = require('../engine/aucpEngine');

async function initDatabase(forceRecreate = false) {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '';
  const dbName = process.env.DB_NAME || 'bidsecure_db';

  let conn;
  try {
    // 1. Connect to MySQL Server
    conn = await mysql.createConnection({
      host,
      port,
      user,
      password
    });

    // Ensure database exists (safe - does not drop DB directory)
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${dbName}\``);

    // If forceRecreate (seeding / reset), drop individual tables safely with foreign keys disabled
    if (forceRecreate) {
      console.log(`[DB Init] Resetting all tables in '${dbName}'...`);
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      const tablesToDrop = [
        'login_audit',
        'fraud_flags',
        'transactions',
        'bids',
        'listing_images',
        'listings',
        'users'
      ];
      for (const tbl of tablesToDrop) {
        try {
          await conn.query(`DROP TABLE IF EXISTS \`${tbl}\``);
        } catch (e) {
          // Ignore if table doesn't exist
        }
      }
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    // 2. Create Tables Sequentially
    console.log('[DB Init] Creating tables if not exist...');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(150) NOT NULL,
        \`email\` VARCHAR(150) NOT NULL UNIQUE,
        \`password_hash\` VARCHAR(255) NOT NULL,
        \`contact\` VARCHAR(50) DEFAULT NULL,
        \`address\` TEXT DEFAULT NULL,
        \`role\` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
        \`account_status\` ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
        \`can_bid\` TINYINT(1) NOT NULL DEFAULT 1,
        \`can_sell\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`listings\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`seller_id\` INT NOT NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`description\` TEXT NOT NULL,
        \`category\` VARCHAR(100) NOT NULL,
        \`starting_price\` DECIMAL(12,2) NOT NULL,
        \`reserve_price\` DECIMAL(12,2) DEFAULT NULL,
        \`current_highest_bid\` DECIMAL(12,2) DEFAULT 0.00,
        \`start_at\` DATETIME NOT NULL,
        \`end_at\` DATETIME NOT NULL,
        \`status\` ENUM('draft', 'active', 'ended', 'sold', 'unsold') NOT NULL DEFAULT 'active',
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`seller_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`listing_images\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`listing_id\` INT NOT NULL,
        \`filename\` VARCHAR(255) NOT NULL,
        \`storage_path\` VARCHAR(255) NOT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`listing_id\`) REFERENCES \`listings\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`bids\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`listing_id\` INT NOT NULL,
        \`bidder_id\` INT NOT NULL,
        \`amount\` DECIMAL(12,2) NOT NULL,
        \`placed_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`listing_id\`) REFERENCES \`listings\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`bidder_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`transactions\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`listing_id\` INT NOT NULL UNIQUE,
        \`winner_id\` INT NOT NULL,
        \`seller_id\` INT NOT NULL,
        \`final_price\` DECIMAL(12,2) NOT NULL,
        \`payment_reference_encrypted\` TEXT DEFAULT NULL,
        \`status\` ENUM('pending_payment', 'completed') NOT NULL DEFAULT 'pending_payment',
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`completed_at\` DATETIME DEFAULT NULL,
        FOREIGN KEY (\`listing_id\`) REFERENCES \`listings\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`winner_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`seller_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`fraud_flags\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`listing_id\` INT DEFAULT NULL,
        \`flag_type\` VARCHAR(100) NOT NULL,
        \`details\` TEXT NOT NULL,
        \`flagged_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`reviewed\` TINYINT(1) NOT NULL DEFAULT 0,
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`listing_id\`) REFERENCES \`listings\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`login_audit\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`email\` VARCHAR(150) NOT NULL,
        \`success\` TINYINT(1) NOT NULL,
        \`ip_address\` VARCHAR(45) DEFAULT NULL,
        \`attempted_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('[DB Init] All database tables verified.');

    // 3. Check if initial seed data is present
    const [userRows] = await conn.query('SELECT COUNT(*) as count FROM users');
    const userCount = userRows[0].count;

    if (userCount === 0 || forceRecreate) {
      console.log('[DB Init] Seeding initial data (Admin, Users, Listings, Images, Bids, Transactions)...');

      // Clear existing records if forceRecreate
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      await conn.query('TRUNCATE TABLE login_audit');
      await conn.query('TRUNCATE TABLE fraud_flags');
      await conn.query('TRUNCATE TABLE transactions');
      await conn.query('TRUNCATE TABLE bids');
      await conn.query('TRUNCATE TABLE listing_images');
      await conn.query('TRUNCATE TABLE listings');
      await conn.query('TRUNCATE TABLE users');
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');

      const passwordHash = await bcrypt.hash('password123', 10);

      // Seed Users (1 Admin + 4 Users)
      const [adminResult] = await conn.query(
        `INSERT INTO users (name, email, password_hash, contact, address, role, account_status, can_bid, can_sell) 
         VALUES (?, ?, ?, ?, ?, 'admin', 'active', 1, 1)`,
        ['System Administrator', 'admin@bidsecure.com', passwordHash, '+2348011112222', '10 Marian Road, Calabar', 'admin']
      );

      const [user1] = await conn.query(
        `INSERT INTO users (name, email, password_hash, contact, address, role, account_status, can_bid, can_sell) 
         VALUES (?, ?, ?, ?, ?, 'user', 'active', 1, 1)`,
        ['Effiong Bassey', 'effiong@calabar.com', passwordHash, '+2348022223333', '45 Watt Market Street, Calabar', 'user']
      );

      const [user2] = await conn.query(
        `INSERT INTO users (name, email, password_hash, contact, address, role, account_status, can_bid, can_sell) 
         VALUES (?, ?, ?, ?, ?, 'user', 'active', 1, 1)`,
        ['Blessing Ekpenyong', 'blessing@calabar.com', passwordHash, '+2348033334444', '12 Mary Slessor Avenue, Calabar', 'user']
      );

      const [user3] = await conn.query(
        `INSERT INTO users (name, email, password_hash, contact, address, role, account_status, can_bid, can_sell) 
         VALUES (?, ?, ?, ?, ?, 'user', 'active', 1, 1)`,
        ['Okon Edet', 'okon@calabar.com', passwordHash, '+2348044445555', '88 Murtala Mohammed Highway, Calabar', 'user']
      );

      const [user4] = await conn.query(
        `INSERT INTO users (name, email, password_hash, contact, address, role, account_status, can_bid, can_sell) 
         VALUES (?, ?, ?, ?, ?, 'user', 'active', 1, 1)`,
        ['Arit Archibong', 'arit@calabar.com', passwordHash, '+2348055556666', '23 Target Road, Calabar', 'user']
      );

      const u1Id = user1.insertId;
      const u2Id = user2.insertId;
      const u3Id = user3.insertId;
      const u4Id = user4.insertId;

      // Seed Listings
      const now = new Date();
      const future3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const future7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const past2Days = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const past5Days = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

      // Listing 1: Nike Off-White
      const [l1] = await conn.query(
        `INSERT INTO listings (seller_id, title, description, category, starting_price, reserve_price, current_highest_bid, start_at, end_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [u1Id, 'Nike x Off-White - Air Force 1 "Volt" (Size 43)', 'Limited edition deadstock Virgil Abloh collaboration sneakers with original zip-tie tag and box provenance.', 'Fashion & Jewelry', 150000.00, 180000.00, 240000.00, past2Days, future3Days]
      );
      await conn.query(`INSERT INTO listing_images (listing_id, filename, storage_path) VALUES (?, ?, ?)`, 
        [l1.insertId, 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800&auto=format&fit=crop', 'external']);

      // Listing 2: Louis Vuitton Bag
      const [l2] = await conn.query(
        `INSERT INTO listings (seller_id, title, description, category, starting_price, reserve_price, current_highest_bid, start_at, end_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [u2Id, 'Louis Vuitton x Murakami - Monogram Multicolore Bag Set', 'Rare collector Takashi Murakami canvas luxury handbag. Includes dust bag and certificate of authenticity.', 'Fashion & Jewelry', 450000.00, 500000.00, 580000.00, past2Days, future7Days]
      );
      await conn.query(`INSERT INTO listing_images (listing_id, filename, storage_path) VALUES (?, ?, ?)`, 
        [l2.insertId, 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop', 'external']);

      // Listing 3: Bearbrick
      const [l3] = await conn.query(
        `INSERT INTO listings (seller_id, title, description, category, starting_price, reserve_price, current_highest_bid, start_at, end_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [u3Id, 'Bearbrick x BAPE - Shark Camo Edition 1000% Figure', 'Iconic Medicom Toy collectible figure in 70cm height. Pristine condition with original packaging.', 'Art & Antiques', 350000.00, 400000.00, 420000.00, past2Days, future3Days]
      );
      await conn.query(`INSERT INTO listing_images (listing_id, filename, storage_path) VALUES (?, ?, ?)`, 
        [l3.insertId, 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop', 'external']);

      // Listing 4: iPhone 14 Pro Max
      const [l4] = await conn.query(
        `INSERT INTO listings (seller_id, title, description, category, starting_price, reserve_price, current_highest_bid, start_at, end_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [u2Id, 'iPhone 14 Pro Max - Deep Purple (256GB)', 'Neatly used Apple iPhone 14 Pro Max with battery health at 94%. Factory unlocked, includes box and fast charger.', 'Electronics', 520000.00, 550000.00, 610000.00, past2Days, future7Days]
      );
      await conn.query(`INSERT INTO listing_images (listing_id, filename, storage_path) VALUES (?, ?, ?)`, 
        [l4.insertId, 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&auto=format&fit=crop', 'external']);

      // Listing 5: Toyota Camry (Sold)
      const [l5] = await conn.query(
        `INSERT INTO listings (seller_id, title, description, category, starting_price, reserve_price, current_highest_bid, start_at, end_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sold')`,
        [u1Id, 'Toyota Camry 2015 XLE - Foreign Used', 'Clean V6 engine, leather interior, duty fully paid at Calabar Sea Port. Ready for immediate drive-off.', 'Vehicles', 3500000.00, 4000000.00, 4200000.00, past5Days, past2Days]
      );
      await conn.query(`INSERT INTO listing_images (listing_id, filename, storage_path) VALUES (?, ?, ?)`, 
        [l5.insertId, 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&auto=format&fit=crop', 'external']);

      // Listing 6: Calabar Monolith Sculpture
      const [l6] = await conn.query(
        `INSERT INTO listings (seller_id, title, description, category, starting_price, reserve_price, current_highest_bid, start_at, end_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [u4Id, 'Authentic Calabar Basalt Monolith Miniature Sculpture', 'Hand-carved basalt monolith replica from Ikom, Cross River State. Exceptional historic African craftsmanship.', 'Cultural Artifacts', 80000.00, 100000.00, 125000.00, now, future7Days]
      );
      await conn.query(`INSERT INTO listing_images (listing_id, filename, storage_path) VALUES (?, ?, ?)`, 
        [l6.insertId, 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop', 'external']);

      // Seed Bids
      await conn.query(
        `INSERT INTO bids (listing_id, bidder_id, amount, placed_at) VALUES 
         (?, ?, 160000.00, DATE_SUB(NOW(), INTERVAL 12 HOUR)),
         (?, ?, 200000.00, DATE_SUB(NOW(), INTERVAL 10 HOUR)),
         (?, ?, 240000.00, DATE_SUB(NOW(), INTERVAL 1 HOUR)),
         (?, ?, 540000.00, DATE_SUB(NOW(), INTERVAL 5 HOUR)),
         (?, ?, 610000.00, DATE_SUB(NOW(), INTERVAL 2 HOUR))`,
        [l1.insertId, u2Id, l1.insertId, u3Id, l1.insertId, u4Id, l4.insertId, u1Id, l4.insertId, u3Id]
      );

      // Listing 7: Apple Watch Ultra 2 (Ended - Awaiting Payment)
      const [l7] = await conn.query(
        `INSERT INTO listings (seller_id, title, description, category, starting_price, reserve_price, current_highest_bid, start_at, end_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ended')`,
        [u2Id, 'Apple Watch Ultra 2 - Titanium Case (49mm)', 'GPS + Cellular rugged smartwatch with Ocean Band. Auction ended, winning bidder settlement pending.', 'Electronics', 350000.00, 400000.00, 450000.00, past5Days, past2Days]
      );
      await conn.query(`INSERT INTO listing_images (listing_id, filename, storage_path) VALUES (?, ?, ?)`, 
        [l7.insertId, 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800&auto=format&fit=crop', 'external']);

      // Completed Transaction #1
      const encryptedRef = engine.encryptData('SIM-PAY-CALABAR-CAMRY-982371-COMPLETED');
      await conn.query(
        `INSERT INTO transactions (listing_id, winner_id, seller_id, final_price, payment_reference_encrypted, status, completed_at)
         VALUES (?, ?, ?, ?, ?, 'completed', DATE_SUB(NOW(), INTERVAL 1 DAY))`,
        [l5.insertId, u4Id, u1Id, 4200000.00, encryptedRef]
      );

      // Pending Transaction #2 (Ready for simulated payment checkout)
      await conn.query(
        `INSERT INTO transactions (listing_id, winner_id, seller_id, final_price, payment_reference_encrypted, status)
         VALUES (?, ?, ?, ?, NULL, 'pending_payment')`,
        [l7.insertId, u4Id, u2Id, 450000.00]
      );

      // Fraud Flags
      await conn.query(
        `INSERT INTO fraud_flags (user_id, listing_id, flag_type, details, reviewed) VALUES 
         (?, ?, 'SELF_BIDDING', 'User tried to place bid on own listing #1 (Nike Off-White).', 0),
         (?, ?, 'RAPID_CONSECUTIVE_BIDS', 'User placed 4 bids in 15 seconds on Listing #2.', 0)`,
        [u1Id, l1.insertId, u3Id, l2.insertId]
      );

      console.log('[DB Init] Seed data successfully populated!');
    }

    return true;
  } catch (err) {
    console.error('[DB Init Error]:', err.message);
    throw err;
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}

if (require.main === module) {
  initDatabase(true)
    .then(() => {
      console.log('Database initialization complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { initDatabase };
