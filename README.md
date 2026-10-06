# BidSecure — Secure Online Auction Portal for Calabar 🛡️

**BidSecure** (CSS Prefix: `aucp-*`) is a complete, production-ready full-stack web application designed for secure online bidding, seller listing management, automated auction resolution, simulated payment settlement, and rule-based fraud detection in Calabar, Cross River State.

Built with **Node.js + Express.js**, **EJS Templating**, **MySQL (parameterized queries only)**, and a dedicated **business engine (`engine/aucpEngine.js`)**.

---

## 🚀 Quick Setup Instructions

### Prerequisites
- Node.js (v18+)
- MySQL Server (running on port 3306 or via Docker)

### Option A: Local Development Setup
1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Ensure `.env` exists (copied from `.env.example`):
   ```ini
   PORT=3000
   NODE_ENV=development
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=root
   DB_NAME=bidsecure_db
   SESSION_SECRET=bidsecure_secret_key_calabar_2026_secure_auction
   ENCRYPTION_KEY=6f8d2b9e4a1c5f3a7b8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b0a
   ```

3. **Initialize & Seed Database:**
   Import `db/schema.sql` into MySQL, then execute the seeder:
   ```bash
   npm run seed
   ```

4. **Start Application:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### Option B: Docker Compose Setup
Run full stack (MySQL + App) in containerized environment:
```bash
docker-compose up --build
```
Access at [http://localhost:3000](http://localhost:3000).

---

## 🔑 Default Test Credentials

All seed accounts use the default password: `password123`

| Role | Name | Email | Default Password | Capabilities |
|---|---|---|---|---|
| **Administrator** | System Administrator | `admin@bidsecure.com` | `password123` | Full system audit, fraud flags, user suspension, CSV reports |
| **Buyer / Seller** | Effiong Bassey | `effiong@calabar.com` | `password123` | Bid placement, seller listing creation, payment settlement |
| **Buyer / Seller** | Blessing Ekpenyong | `blessing@calabar.com` | `password123` | Bid placement, seller listing creation, payment settlement |
| **Buyer / Seller** | Okon Edet | `okon@calabar.com` | `password123` | Bid placement, seller listing creation, payment settlement |
| **Buyer / Seller** | Arit Archibong | `arit@calabar.com` | `password123` | Bid placement, seller listing creation, payment settlement |

---

## ⚙️ Architecture & Module Deep-Dive

### 1. Dedicated Business Logic Engine (`engine/aucpEngine.js`)
All core rules and algorithms are strictly encapsulated in `engine/aucpEngine.js` rather than being scattered across route handlers:

- **Cryptographic Engine (AES-256-GCM):**
  Uses Node's native `crypto` module (`Cipheriv` and `Decipheriv` with a 96-bit random IV and authTag) to encrypt payment references and sensitive identity data at rest before saving to MySQL.
  - `encryptData(plaintext)`
  - `decryptData(ciphertext)`

- **Server-Side Bid Validation & Ranking:**
  - `validateAndPlaceBid(listingId, bidderId, bidAmount)`:
    1. Verifies listing status is `active` and current server time `< end_at`.
    2. Validates user identity profile completion (`name`, `contact`, `address`).
    3. Rejects self-bidding (seller bidding on own item).
    4. Enforces minimum bid increment threshold (`current_highest_bid + 1.00` or starting price).
    5. Atomic transaction inserts bid into append-only `bids` audit table and updates `listings.current_highest_bid`.

- **Fraud Monitoring & Detection Engine:**
  - `checkFraudRules(listingId, bidderId, proposedAmount)`:
    - **Rule 1 (Self-Bidding):** Flags and blocks seller from placing bids on own listing.
    - **Rule 2 (Rapid Consecutive Bids):** Detects if user submits >4 bids in 60s (shill bidding indicator).
    - **Rule 3 (Implausible Bid Jump):** Flags bids that jump 3.0x or higher above current baseline.

- **Scheduled Auction Lifecycle Resolution:**
  - `resolveExpiredAuctions()`: Triggered via background cron every 30 seconds.
  - Queries active listings where `end_at <= NOW()`.
  - Determines highest bid. If highest bid meets or exceeds seller's `reserve_price`, marks listing status as `ended` and creates a `transactions` record (`pending_payment`). If reserve is not met, transitions listing to `unsold`.

- **Simulated Payment Settlement:**
  - `processSimulatedPayment(...)`: Validates winning bidder, generates a simulated reference string, encrypts it via AES-256-GCM, transitions transaction status to `completed`, and updates listing status to `sold`.

---

## 🎨 Design System & UI Constraints
- **Flat CSS Design Tokens (`public/css/aucp.css`):**
  All CSS classes follow the mandatory `aucp-*` namespace.
- **Strict Color Rules:** Solid color tokens only — NO gradients anywhere.
- **Typography:** Inter Google Font.
- **Live Auction View:** Real-time countdown timer & background polling every 5s (`public/js/aucp-auction.js`).

---

## 📂 Project Directory Structure

```
online auction portal/
├── app.js                      # Main Express server entry point & cron setup
├── config/
│   └── db.js                   # mysql2 promise pool connection
├── engine/
│   └── aucpEngine.js           # Business logic, crypto, fraud rules, resolution
├── middleware/
│   ├── authMiddleware.js       # Login, admin, identity verification gates
│   └── uploadMiddleware.js     # Multer image upload configuration
├── routes/
│   ├── pages/                  # EJS Page-rendering routes
│   │   ├── authRoutes.js
│   │   ├── buyerRoutes.js
│   │   ├── sellerRoutes.js
│   │   └── adminRoutes.js
│   └── api/                    # JSON API routes
│       ├── apiBids.js
│       ├── apiListings.js
│       ├── apiTransactions.js
│       └── apiAdmin.js
├── views/                      # EJS templates & partials
│   ├── partials/               # head, footer, topbar, sidebars (buyer/seller/admin)
│   ├── auth/                   # login, register
│   ├── buyer/                  # dashboard, browse, auction (live), bid history, won
│   ├── seller/                 # dashboard, create listing, my listings, bids
│   ├── admin/                  # dashboard, fraud flags, auctions, users, reports
│   └── payment/                # checkout, success
├── public/
│   ├── css/aucp.css            # Custom flat CSS design system
│   └── js/
│       ├── aucp-main.js        # Main UI JS
│       └── aucp-auction.js     # Polling JS for live auction updates
├── db/
│   ├── schema.sql              # MySQL table definitions
│   ├── seed.sql                # Pure SQL initial dataset
│   └── seed.js                 # Dynamic Node seeding script
├── Dockerfile                  # Container definition
├── docker-compose.yml          # MySQL + App orchestration
└── README.md
```
