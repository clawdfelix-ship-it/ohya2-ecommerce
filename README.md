# OHYA2.0 E-Commerce Setup Instructions

## Prerequisites
- Node.js (v14+) installed
- npm or yarn

## Quick Start

1. **Install dependencies:**
```bash
cd ohya2-ecommerce
npm install
```

2. **Start the server:**
```bash
npm start
```

3. **Access the site:**
- Frontend: http://localhost:3000
- Admin Panel: http://localhost:3000/admin
- Default admin login: admin@ohya2.com / admin123

## Default Bank Transfer Details (configurable)
- Bank: HSBC
- Account: 123-456-789
- Account Name: OHYA2.0

## CSV Import/Export (Bulk Product Management)

### Export Products
In the Admin Panel → Products section, click **"📥 Export CSV"** to download all products as a CSV file.

### Import Products
In the Admin Panel → Products section, click **"📤 Import CSV"** to upload a CSV file with products.

**CSV Format:**
```csv
product_code,name,price,description,barcode,category,stock,active,image_url
PROD001,Premium Vibrator,599,High quality vibrator,1234567890,Vibrators,50,TRUE,/uploads/products/vibrator.jpg
PROD002,Massage Oil,199,Relaxing massage oil,,Massage,100,TRUE,
```

**CSV Columns:**
| Column | Required | Description |
|--------|----------|-------------|
| product_code | No | Unique product code (used for updates) |
| name | Yes | Product name |
| price | Yes | Product price |
| description | No | Product description |
| barcode | No | Product barcode |
| category | No | Product category |
| stock | No | Stock quantity (default: 0) |
| active | No | TRUE/FALSE (default: TRUE) |
| image_url | No | Full URL to product image |

**Import Behavior:**
- If product_code matches an existing product → **updates** that product
- If product_code is new/empty → **creates** new product

## Project Structure
```
ohya2-ecommerce/
├── server.js           # Main Express server
├── database.js         # SQLite database setup
├── package.json        # Dependencies
├── public/             # Static files
│   ├── index.html      # Main storefront
│   ├── product.html    # Product detail page
│   ├── cart.html       # Shopping cart
│   ├── checkout.html   # Checkout with bank transfer
│   ├── login.html      # User login
│   ├── register.html   # User registration
│   ├── admin/          # Admin panel
│   │   └── index.html  # Admin dashboard
│   ├── css/
│   │   └── style.css   # Main styles
│   └── js/
│       ├── main.js     # Main frontend logic
│       ├── cart.js     # Cart functionality
│       └── admin.js    # Admin functionality
│   └── uploads/        # Product images & payment proofs
└── data/
    └── ohya.db         # SQLite database (auto-created)
```

## Features
- Product catalog with categories
- Shopping cart (localStorage)
- User registration/login
- Bank transfer checkout with proof upload
- Admin panel for product management
- Order management

## Security Notes
- Change default admin credentials after first login
- In production, add SSL/HTTPS
- Configure proper file upload restrictions
