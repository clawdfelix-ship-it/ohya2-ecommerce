# OHYA2.0 電商系統完善清單

## 當前狀態
- ✅ 基礎Admin Dashboard
- ✅ Products CRUD + 搜尋
- ✅ Orders 新增/編輯 (揀產品)
- ⚠️ Customers API 未完成
- ⚠️ Marketing 只係本地端優惠碼
- ⚠️ Analytics 數據分析
- ⚠️ Import/Export

---

## 需要完善既功能

### 1. Dashboard (數據分析)
- [ ] 銷售額圖表 (按日/按月)
- [ ] 暢銷產品排行榜
- [ ] 客戶分析 (新客戶/回購率)
- [ ] 訂單狀態分佈
- [ ] KPI Cards: 今日訂單、銷售額、利潤

### 2. Products (產品管理)
- [ ] 分類管理 (CRUD)
- [ ] 庫存追蹤 + _LOW STOCK ALERT_
- [ ] 產品圖片上傳
- [ ] 產品詳情編輯
- [ ] 批量操作 (刪除/上架/下架)

### 3. Orders (訂單管理)
- [ ] 訂單狀態: pending → processing → shipped → completed / cancelled / refunded
- [ ] 訂單詳情 (產品列表、客戶資料)
- [ ] 取消訂單 + 退款
- [ ] 批量狀態更新
- [ ] 訂單篩選 (日期、狀態、客戶)

### 4. Customers (客戶管理)
- [ ] 客戶列表 + 搜尋
- [ ] 客戶詳情 (訂單歷史、總消費)
- [ ] 會員等級 (VIP/Silver/Bronze)
- [ ] 客戶標籤
- [ ] 新增/編輯客戶 API

### 5. Marketing (營銷)
- [ ] 優惠碼 CRUD
- [ ] 優惠碼使用統計
- [ ] 閃購/特價設定
- [ ] 首頁橫幅管理

### 6. Analytics (數據分析)
- [ ] 銷售報告 (日/週/月/年)
- [ ] 產品銷售排行
- [ ] 客戶消費分析
- [ ] 轉化率分析

### 7. Settings (系統設定)
- [ ] 商店資訊 (名稱、聯繫)
- [ ] 付款設定 (銀行戶口)
- [ ] 運費設定 (免運門檻、運費)
- [ ] 通知設定

---

## Technical Notes

### Database Schema (已有)
- users (id, email, password, name, phone, address, is_admin)
- products (id, product_code, name, price, description, category, stock, image_url, active)
- orders (id, user_id, total, status, created_at)
- order_items (id, order_id, product_id, quantity, price)

### 需要新增既Table
- categories (id, name, description)
- coupons (id, code, discount, expire_date, active)
- customer_tags (id, customer_id, tag)
- order_history (id, order_id, status, note, created_at)

### API Endpoints 需要
- GET/POST /api/categories
- PUT/DELETE /api/categories/:id
- GET/POST /api/coupons
- PUT/DELETE /api/coupons/:id
- POST /api/customers
- GET /api/analytics/sales
- GET /api/analytics/products
