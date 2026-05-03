# 架構說明

## 目錄結構

```
/
├── app.js                          Express 應用程式實例（middleware + routes 組裝，不含 listen）
├── server.js                       進入點：驗證環境變數、啟動 HTTP 監聽
├── package.json
├── .env.example                    環境變數範本
├── swagger-config.js               OpenAPI 3.0 設定（title、servers、security schemes）
├── generate-openapi.js             CLI 腳本：掃描 JSDoc 產生 openapi.json
├── vitest.config.js                測試執行順序設定
│
├── src/
│   ├── database.js                 SQLite 連線、建表 DDL、seed 資料插入
│   ├── middleware/
│   │   ├── sessionMiddleware.js    讀取 X-Session-Id header → req.sessionId
│   │   ├── authMiddleware.js       驗證 JWT Bearer token → req.user
│   │   ├── adminMiddleware.js      檢查 req.user.role === 'admin'（需在 authMiddleware 之後）
│   │   └── errorHandler.js        全域錯誤處理（Express error handler，4 個參數）
│   └── routes/
│       ├── authRoutes.js           POST /register, POST /login, GET /profile
│       ├── productRoutes.js        GET /products, GET /products/:id
│       ├── adminProductRoutes.js   CRUD /admin/products（需 auth + admin）
│       ├── cartRoutes.js           購物車 CRUD（雙模式：JWT / Session）
│       ├── orderRoutes.js          建立訂單、查詢訂單、模擬支付
│       ├── adminOrderRoutes.js     管理員查詢所有訂單
│       └── pageRoutes.js           SSR 頁面路由，res.render() EJS 模板
│
├── public/
│   ├── css/
│   │   ├── input.css               Tailwind 指令（@tailwind base/components/utilities）
│   │   └── output.css              Tailwind 編譯輸出（npm run css:build 產生）
│   ├── stylesheets/
│   │   └── style.css               額外自訂 CSS
│   └── js/
│       ├── auth.js                 客戶端 Auth class（localStorage 存取、token 管理）
│       ├── api.js                  封裝 fetch，自動附加 token/sessionId，401 時重導向登入頁
│       ├── notification.js         Toast 通知系統（success / error / info）
│       ├── header-init.js          動態更新 header（登入狀態、使用者名稱）
│       └── pages/
│           ├── index.js            首頁 Vue app（商品列表、分頁、加入購物車）
│           ├── product-detail.js   商品詳情 Vue app
│           ├── cart.js             購物車 Vue app
│           ├── checkout.js         結帳 Vue app（建立訂單、模擬支付）
│           ├── login.js            登入/註冊 Vue app
│           ├── orders.js           我的訂單列表 Vue app
│           ├── order-detail.js     訂單詳情 Vue app
│           ├── admin-products.js   管理員商品 CRUD Vue app
│           └── admin-orders.js     管理員訂單管理 Vue app
│
├── views/
│   ├── layouts/
│   │   ├── front.ejs               前台共用 Layout（包含 head, header, footer partials）
│   │   └── admin.ejs               後台共用 Layout（包含 admin-header, admin-sidebar partials）
│   ├── pages/
│   │   ├── index.ejs               首頁（掛載 index.js Vue app）
│   │   ├── product-detail.ejs      商品詳情頁
│   │   ├── cart.ejs                購物車頁
│   │   ├── checkout.ejs            結帳頁
│   │   ├── login.ejs               登入/註冊頁
│   │   ├── orders.ejs              我的訂單頁
│   │   ├── order-detail.ejs        訂單詳情頁
│   │   ├── 404.ejs                 404 錯誤頁
│   │   └── admin/
│   │       ├── products.ejs        管理員商品管理頁
│   │       └── orders.ejs          管理員訂單管理頁
│   └── partials/
│       ├── head.ejs                <head> 標籤（CSS、meta）
│       ├── header.ejs              前台導覽列（登入狀態感知）
│       ├── footer.ejs              頁腳
│       ├── notification.ejs        Toast 容器 HTML
│       ├── admin-header.ejs        後台頂部 navbar
│       └── admin-sidebar.ejs       後台側邊欄
│
└── tests/
    ├── setup.js                    測試輔助函式（app export、getAdminToken、registerUser）
    ├── auth.test.js
    ├── products.test.js
    ├── cart.test.js
    ├── orders.test.js
    ├── adminProducts.test.js
    └── adminOrders.test.js
```

## 啟動流程

```
server.js
  │
  ├── 檢查 process.env.JWT_SECRET（若無，process.exit(1)）
  ├── require('./app')
  │     ├── require('./src/database')   ← SQLite 連線 + 建表 + 補種 seed 資料
  │     ├── express()
  │     ├── cors({ origin: FRONTEND_URL })
  │     ├── express.json()
  │     ├── express.urlencoded({ extended: true })
  │     ├── sessionMiddleware          ← 所有路由前注入 req.sessionId
  │     ├── /api/auth      → authRoutes
  │     ├── /api/products  → productRoutes
  │     ├── /api/admin/products → adminProductRoutes（auth + admin 在 routes 內使用）
  │     ├── /api/cart      → cartRoutes（auth 或 session 在 routes 內使用）
  │     ├── /api/orders    → orderRoutes（auth 在 routes 內使用）
  │     ├── /api/admin/orders → adminOrderRoutes（auth + admin 在 routes 內使用）
  │     ├── /              → pageRoutes（SSR）
  │     ├── 404 handler（JSON vs HTML 依 Accept header 區分）
  │     └── errorHandler（全域錯誤捕捉）
  │
  └── app.listen(PORT || 3001)
```

**重要**：`app.js` 本身不呼叫 `listen()`，因此測試可以直接 `require('./app')` 而不會佔用 port。

## API 路由總覽

| 方法 | 路徑 | 認證 | 說明 |
|------|------|------|------|
| POST | /api/auth/register | 無 | 註冊新用戶 |
| POST | /api/auth/login | 無 | 登入取得 JWT |
| GET | /api/auth/profile | JWT | 取得目前用戶資料 |
| GET | /api/products | 無 | 商品列表（分頁） |
| GET | /api/products/:id | 無 | 單一商品詳情 |
| GET | /api/admin/products | JWT + Admin | 管理員商品列表 |
| POST | /api/admin/products | JWT + Admin | 新增商品 |
| PUT | /api/admin/products/:id | JWT + Admin | 更新商品 |
| DELETE | /api/admin/products/:id | JWT + Admin | 刪除商品 |
| GET | /api/cart | JWT 或 Session | 查看購物車 |
| POST | /api/cart | JWT 或 Session | 加入購物車 |
| PATCH | /api/cart/:itemId | JWT 或 Session | 更新數量 |
| DELETE | /api/cart/:itemId | JWT 或 Session | 移除項目 |
| POST | /api/orders | JWT | 從購物車建立訂單 |
| GET | /api/orders | JWT | 查詢我的訂單列表 |
| GET | /api/orders/:id | JWT | 查詢單一訂單 |
| PATCH | /api/orders/:id/pay | JWT | 模擬支付（success/fail） |
| GET | /api/admin/orders | JWT + Admin | 管理員查詢所有訂單 |
| GET | /api/admin/orders/:id | JWT + Admin | 管理員查詢訂單詳情 |

### 頁面路由（SSR）

| 路徑 | Layout | 說明 |
|------|--------|------|
| GET / | front.ejs | 首頁 |
| GET /products/:id | front.ejs | 商品詳情 |
| GET /cart | front.ejs | 購物車 |
| GET /checkout | front.ejs | 結帳頁 |
| GET /login | front.ejs | 登入/註冊 |
| GET /orders | front.ejs | 我的訂單 |
| GET /orders/:id | front.ejs | 訂單詳情 |
| GET /admin/products | admin.ejs | 管理員商品管理 |
| GET /admin/orders | admin.ejs | 管理員訂單管理 |
| GET /404 | front.ejs | 404 頁面 |

## 統一回應格式

所有 `/api/*` 路由均回傳此結構：

```json
{
  "data": null,
  "error": null,
  "message": "操作成功"
}
```

- `data`：成功時的回應資料（物件、陣列或 null）
- `error`：錯誤代碼字串（例如 `"INVALID_INPUT"`、`"NOT_FOUND"`），成功時為 null
- `message`：人類可讀訊息（中文）

**成功範例（201）：**
```json
{
  "data": { "id": "uuid", "email": "user@example.com", "name": "王小明", "role": "user" },
  "error": null,
  "message": "註冊成功"
}
```

**錯誤範例（400）：**
```json
{
  "data": null,
  "error": "INVALID_INPUT",
  "message": "請填寫所有必要欄位"
}
```

## 認證與授權機制

### JWT 規格

| 參數 | 值 |
|------|-----|
| 演算法 | HS256 |
| 有效期 | 7 天（`expiresIn: '7d'`） |
| Payload | `{ userId, email, role }` |
| 密鑰來源 | `process.env.JWT_SECRET` |

### Middleware 行為

**authMiddleware**（`src/middleware/authMiddleware.js`）：
1. 讀取 `Authorization: Bearer <token>` header
2. `jwt.verify(token, JWT_SECRET)` 驗證簽名與有效期
3. 成功：`req.user = { userId, email, role }`
4. 失敗：回傳 `401 { error: 'UNAUTHORIZED', message: '請先登入' }`

**adminMiddleware**（`src/middleware/adminMiddleware.js`）：
- 依賴 `req.user`（必須在 authMiddleware 之後使用）
- 檢查 `req.user.role === 'admin'`
- 非 admin：回傳 `403 { error: 'FORBIDDEN', message: '無權限' }`

**sessionMiddleware**（`src/middleware/sessionMiddleware.js`）：
- 讀取 `X-Session-Id` header
- 設定 `req.sessionId`（可能為 undefined）
- 全域掛載，不阻擋請求

### 購物車雙模式認證（cartRoutes.js 特有）

```
請求到達 /api/cart
    │
    ├── 有 Authorization: Bearer token
    │     └── authMiddleware 驗證 → req.user.userId 作為 cart key
    │
    └── 無 Bearer token，但有 X-Session-Id
          └── sessionMiddleware → req.sessionId 作為 cart key
```

cart_items 表中：
- 已登入用戶：`user_id` 欄位有值，`session_id` 為 null
- 訪客：`session_id` 欄位有值，`user_id` 為 null

## 資料庫 Schema

**位置**：`src/database.sqlite`（git ignore 中，首次執行自動建立）
**設定**：WAL 模式（`PRAGMA journal_mode=WAL`）、外鍵約束（`PRAGMA foreign_keys=ON`）

### users

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| email | TEXT | UNIQUE NOT NULL | 登入帳號 |
| password_hash | TEXT | NOT NULL | bcrypt hash（saltRounds=10） |
| name | TEXT | NOT NULL | 顯示名稱 |
| role | TEXT | NOT NULL, DEFAULT 'user', CHECK IN ('user','admin') | 角色 |
| created_at | TEXT | NOT NULL, DEFAULT datetime('now') | 建立時間 |

### products

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| name | TEXT | NOT NULL | 商品名稱 |
| description | TEXT | — | 商品描述 |
| price | INTEGER | NOT NULL, CHECK(price > 0) | 單價（整數，新台幣） |
| stock | INTEGER | NOT NULL, DEFAULT 0, CHECK(stock >= 0) | 庫存數量 |
| image_url | TEXT | — | 商品圖片 URL |
| created_at | TEXT | NOT NULL, DEFAULT datetime('now') | 建立時間 |
| updated_at | TEXT | NOT NULL, DEFAULT datetime('now') | 更新時間（需手動更新） |

### cart_items

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| session_id | TEXT | — | 訪客 session ID |
| user_id | TEXT | FOREIGN KEY → users(id) | 已登入用戶 ID |
| product_id | TEXT | NOT NULL, FOREIGN KEY → products(id) | 商品 ID |
| quantity | INTEGER | NOT NULL, DEFAULT 1, CHECK(quantity > 0) | 數量 |

### orders

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| order_no | TEXT | UNIQUE NOT NULL | 訂單編號（ORD-YYYYMMDD-XXXXX） |
| user_id | TEXT | NOT NULL, FOREIGN KEY → users(id) | 下單用戶 |
| recipient_name | TEXT | NOT NULL | 收件人姓名 |
| recipient_email | TEXT | NOT NULL | 收件人信箱 |
| recipient_address | TEXT | NOT NULL | 收件地址 |
| total_amount | INTEGER | NOT NULL | 訂單金額 |
| status | TEXT | NOT NULL, DEFAULT 'pending', CHECK IN ('pending','paid','failed') | 訂單狀態 |
| created_at | TEXT | NOT NULL, DEFAULT datetime('now') | 建立時間 |

### order_items

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| order_id | TEXT | NOT NULL, FOREIGN KEY → orders(id) | 所屬訂單 |
| product_id | TEXT | NOT NULL, FOREIGN KEY → products(id) | 商品 ID（快照） |
| product_name | TEXT | NOT NULL | 商品名稱（下單時快照） |
| product_price | INTEGER | NOT NULL | 商品單價（下單時快照） |
| quantity | INTEGER | NOT NULL | 購買數量 |

> **為何 order_items 快照商品資料**：商品未來可能被修改或刪除，訂單記錄必須保存下單當時的名稱與價格。

## 訂單編號格式

```javascript
// ORD-YYYYMMDD-XXXXX（X 為 UUID 前 5 碼，大寫）
function generateOrderNo() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = uuidv4().slice(0, 5).toUpperCase();
  return `ORD-${dateStr}-${random}`;
}
// 範例：ORD-20260503-A1B2C
```

## 第三方整合

### ECPay（金流）

目前**尚未整合**，僅有環境變數佔位符：
- `ECPAY_MERCHANT_ID`
- `ECPAY_HASH_KEY`
- `ECPAY_HASH_IV`
- `ECPAY_ENV`（staging/production）

支付功能目前透過 `PATCH /api/orders/:id/pay` 模擬，`action: 'success'` 或 `action: 'fail'`。

### OpenAPI / Swagger

`swagger-config.js` 定義 OpenAPI 3.0.3 規格，透過 `swagger-jsdoc` 掃描各 route 檔的 JSDoc 註解自動產生。執行 `npm run openapi` 輸出 `openapi.json`。
