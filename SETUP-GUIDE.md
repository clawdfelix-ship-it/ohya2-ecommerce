# OHYA2.0 Adult Products E-Commerce Setup Guide

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Domain & Hosting Setup](#step-1-domain--hosting-setup)
4. [Step 2: WordPress Installation](#step-2-wordpress-installation)
5. [Step 3: WooCommerce Installation](#step-3-woocommerce-installation)
6. [Step 4: Basic Configuration](#step-4-basic-configuration)
7. [Step 5: Payment Setup - Bank Transfer with Upload](#step-5-payment-setup---bank-transfer-with-upload)
8. [Step 6: Product Catalog Setup](#step-6-product-catalog-setup)
9. [Step 7: User Membership Setup](#step-7-user-membership-setup)
10. [Step 8: Age Verification & Legal](#step-8-age-verification--legal)
11. [Step 9: Admin Backend Guide](#step-9-admin-backend-guide)
12. [Maintenance & Security](#maintenance--security)

---

## Overview

**Site Name:** OHYA2.0  
**Platform:** WordPress + WooCommerce  
**Payment Method:** Bank Transfer with Proof Upload  
**Target:** Adult products e-commerce

This guide is designed for non-technical users. Each step includes clear instructions.

---

## Prerequisites

Before starting, ensure you have:
- [ ] Domain: OHYA2.0 (you already own this)
- [ ] Web Hosting (recommendations below)
- [ ] SSL Certificate (usually free with hosting)
- [ ] Email address for admin account

### Recommended Hosting for Adult Sites
- **StableHost** - Adult-friendly
- **Hostinger** - Budget-friendly
- **Bluehost** - Easy setup
- **A2 Hosting** - Fast performance

*Note: Many mainstream hosts have content restrictions. Choose adult-friendly hosting.*

---

## Step 1: Domain & Hosting Setup

### If you already have hosting:
1. Point your OHYA2.0 domain to your hosting provider's nameservers
2. Wait up to 24-48 hours for DNS propagation

### If you need new hosting:
1. Purchase hosting from an adult-friendly provider
2. Add your domain to the hosting account
3. Install free SSL (Let's Encrypt)

---

## Step 2: WordPress Installation

### Option A: One-Click Install (Recommended)
Most hosting providers offer WordPress installation:
1. Log into your hosting control panel (cPanel/Plesk)
2. Look for "WordPress" or "Website" installer
3. Click install, fill in:
   - Site name: OHYA2.0
   - Admin username: choose a secure username (NOT "admin")
   - Admin password: strong password
   - Admin email: your email
4. Complete installation

### Option B: Manual Install
1. Download WordPress from wordpress.org
2. Upload via FTP to your hosting
3. Create database in MySQL
4. Run wp-admin/install.php

### Post-Installation Steps:
1. Log into wp-admin
2. Go to **Settings > General**
3. Set Timezone to your local timezone
4. Save changes

---

## Step 3: WooCommerce Installation

1. In WordPress admin, go to **Plugins > Add New**
2. Search for "WooCommerce"
3. Click **Install Now** → **Activate**
4. Follow the setup wizard:
   - **Store location:** Set your country
   - **Business type:** Select "Physical and digital products"
   - **Inventory:** Enable stock management (optional)
   - **Shipping:** Set up shipping zones
   - **Payments:** Skip for now (we'll configure bank transfer later)
5. Click **Continue** and complete setup

---

## Step 4: Basic Configuration

### Store Settings
Go to **WooCommerce > Settings**:

#### General Tab
- Currency: HKD (or your preferred currency)
- Currency symbol: $

#### Products Tab
- Default product categories: Create categories like "Toys", "Lingerie", "Accessories", "Wellness"

#### Accounts Tab
- Enable registration: ✓ Yes
- Customer login: Show on "My account" page

#### Privacy Tab
- Enable privacy policy page (required for checkout)

### Create Essential Pages
WooCommerce should auto-create:
- Shop
- Cart
- Checkout
- My Account

If not, create them manually and assign in **WooCommerce > Settings > Advanced**

---

## Step 5: Payment Setup - Bank Transfer with Upload

This is a custom feature. We'll use a custom plugin we provide.

### Installation:

1. Create folder: `wp-content/plugins/ohya-bank-transfer`
2. Create file: `ohya-bank-transfer/ohya-bank-transfer.php`
3. Copy the plugin code from `ohya-bank-transfer-plugin.php`

### Plugin Code Features:
- Custom bank transfer payment method
- Image upload field for payment proof
- Admin能看到上传的付款证明
- 订单状态自动更新

### After installing the plugin:

1. Go to **WooCommerce > Settings > Payments**
2. Enable "Bank Transfer with Proof"
3. Configure:
   - **Bank Name:** 你的銀行名稱
   - **Account Number:** 帳戶號碼
   - **Account Name:** 帳戶名稱
   - **Instructions:** 銀行轉帳說明
4. Save changes

---

## Step 6: Product Catalog Setup

### Creating Products Manually

1. Go to **Products > Add New**
2. Fill in:
   - **Product name:** 產品名稱
   - **Description:** 產品描述
   - **Regular price:** 價格
   - **Product image:** 主圖片
   - **Product gallery:** 更多圖片
3. Set **Product categories** (right sidebar)
4. Set **Product tags** (optional)
5. Click **Publish**

### Bulk Import with CSV

Use our template (see `product-import-template.csv`):

1. Go to **Products > Import**
2. Upload the CSV file
3. Map fields
4. Run import

**Template includes:**
- Product name
- Description
- Price
- SKU
- Category
- Stock
- Images (URLs)

---

## Step 7: User Membership Setup

WooCommerce includes basic membership:

### Enable User Registration

1. Go to **WooCommerce > Settings > Accounts**
2. Enable:
   - Enable registration on "My account" page ✓
   - Enable registration on checkout ✓

### Create My Account Page Content

1. Go to **Pages > All Pages**
2. Edit "My Account" page
3. Add WooCommerce shortcode: `[woocommerce_my_account]`

### User Dashboard Features:
- View order history
- Download past invoices
- Update profile
- Change password

---

## Step 8: Age Verification & Legal

### Required for Adult Sites:

1. **Age Verification Popup**
   - Install plugin: "Age Verify" or "Age Gate"
   - Configure: 18+ / 21+ requirement

2. **Privacy Policy Page**
   - Go to **Settings > Privacy**
   - Create or select privacy policy page

3. **Terms & Conditions**
   - Create page with terms
   - Link from checkout

4. **Disclaimer**
   - Add to footer: "18+ Only / 只供成年人"

### Recommended Plugins:
- Age Gate (free)
- WP Legal Pages (free)

---

## Step 9: Admin Backend Guide

### Daily Tasks:

**Managing Orders:**
1. Go to **WooCommerce > Orders**
2. View new orders
3. Check payment proof images
4. Update order status:
   - "Processing" = Payment received, preparing to ship
   - "Completed" = Shipped/Delivered
   - "Refunded" = Payment returned

**Managing Products:**
1. Go to **Products > All Products**
2. Edit/Delete/Update products
3. Update stock levels

**Managing Customers:**
1. Go to **Users > All Users**
2. View customer accounts
3. Reset passwords if needed

### Reports (WooCommerce > Reports):
- Sales by date
- Top products
- Customer orders

---

## Maintenance & Security

### Regular Backups
- Use plugin: UpdraftPlus
- Schedule: Daily/Weekly
- Store: Cloud (Google Drive/Dropbox)

### Security Recommendations:
1. Use strong passwords
2. Install: Wordfence or Sucuri
3. Keep WordPress/WooCommerce updated
4. Use 2-factor authentication

### Updates:
- Check weekly for plugin/theme updates
- Backup before updating

---

## Quick Reference Card

### Common Tasks:

| Task | Location |
|------|----------|
| Add product | Products > Add New |
| View orders | WooCommerce > Orders |
| Update stock | Products > Edit product |
| Add category | Products > Categories |
| Configure payment | WooCommerce > Settings > Payments |
| View customers | Users > All Users |
| Check payment proof | WooCommerce > Orders > Order details |

---

## Support

- **WooCommerce Docs:** docs.woocommerce.com
- **WordPress Support:** wordpress.org/support
- **Your Hosting Provider:** Check their documentation

---

*Document Version: 1.0*  
*Created for: OHYA2.0 E-Commerce*
