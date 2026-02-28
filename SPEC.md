# OHYA2.0 電商系統完善清單

## 7 大核心模組

### 1. 訂單與交易管理 (Order & Transaction)
- [ ] 訂單總覽 - 篩選(日期/狀態/付款狀態)
- [ ] 批量處理訂單
- [ ] 訂單詳情頁 - 收件人/商品清單/費用結構/時間軸
- [ ] 物流處理 - 填寫單號/發通知
- [ ] 退款處理 - 全額/部分退款

### 2. 商品與庫存管理 (Product & Inventory)
- [ ] 商品編輯器 - 名稱/價格/庫存/描述/圖片
- [ ] 多圖管理
- [ ] 規格與變體 (Variants)
- [ ] 庫存追蹤 - 自動扣減
- [ ] 低庫存警告
- [ ] 分類與標籤

### 3. 顧客與會員管理 (CRM)
- [ ] 顧客檔案 - 消費記錄/偏好
- [ ] 會員等級制度 (VIP/Silver/Bronze)
- [ ] 標籤系統
- [ ] 購物車挽回

### 4. 營銷與促銷工具 (Marketing)
- [ ] 折扣碼管理 - 百分比/固定金額/免運
- [ ] 全站促銷 (Flash Sales)
- [ ] 加價購/組合價
- [ ] 禮品卡

### 5. 數據分析與報表 (Analytics)
- [ ] 實時概覽 Dashboard
- [ ] 銷售報表 - 熱銷排行
- [ ] 客戶分析

### 6. 金流與物流設定 (Payments & Logistics)
- [ ] 付款設定 (銀行/FPS)
- [ ] 運費計算邏輯

### 7. 系統與權限設定 (Settings)
- [ ] 多管理員權限
- [ ] 通知設定

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
