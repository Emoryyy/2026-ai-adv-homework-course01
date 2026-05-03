# 開發規範

## 環境變數

`.env.example` 為範本，複製為 `.env` 後填入實際值。

| 變數 | 用途 | 必要 | 預設值 |
|------|------|------|--------|
| `JWT_SECRET` | JWT 簽名密鑰 | **必填** | — |
| `PORT` | HTTP 監聽 port | 選填 | `3001` |
| `BASE_URL` | 伺服器 URL（OpenAPI 文件用） | 選填 | `http://localhost:3001` |
| `FRONTEND_URL` | CORS 允許的前端來源 | 選填 | `http://localhost:3001` |
| `ADMIN_EMAIL` | 初始管理員帳號 | 選填 | `admin@hexschool.com` |
| `ADMIN_PASSWORD` | 初始管理員密碼 | 選填 | `12345678` |
| `ECPAY_MERCHANT_ID` | ECPay 特店代號（未整合） | 選填 | `3002607` |
| `ECPAY_HASH_KEY` | ECPay Hash Key（未整合） | 選填 | — |
| `ECPAY_HASH_IV` | ECPay Hash IV（未整合） | 選填 | — |
| `ECPAY_ENV` | ECPay 環境（未整合） | 選填 | `staging` |

> `JWT_SECRET` 未設定時 `server.js` 會直接 `process.exit(1)`，是唯一的硬性啟動條件。

## 命名規則

### 檔案命名

| 類型 | 規則 | 範例 |
|------|------|------|
| Route 檔案 | `camelCase` + `Routes.js` | `cartRoutes.js` |
| Middleware 檔案 | `camelCase` + `Middleware.js` | `authMiddleware.js` |
| 測試檔案 | `camelCase` + `.test.js` | `adminProducts.test.js` |
| 前端 Vue 頁面 | `kebab-case.js` | `product-detail.js` |
| EJS 模板 | `kebab-case.ejs` | `product-detail.ejs` |
| 計畫文件 | `YYYY-MM-DD-kebab-case.md` | `2026-05-03-payment-integration.md` |

### JavaScript 命名

| 類型 | 規則 | 範例 |
|------|------|------|
| 變數、函式 | `camelCase` | `cartItems`, `generateOrderNo` |
| 類別 | `PascalCase` | `Auth` |
| 常數 / 設定值 | `UPPER_SNAKE_CASE` | `JWT_SECRET`, `TOKEN_KEY` |
| 路由 handler | 不具名函式（直接傳入 router） | `router.get('/', (req, res) => {})` |

### 資料庫欄位命名

全部使用 `snake_case`，對應 JavaScript 時建議保持原欄位名稱（不轉換）。
範例：`user_id`、`order_no`、`created_at`。

## 模組系統

本專案使用 **CommonJS**（`require` / `module.exports`）。
- 後端：所有 `.js` 均用 CommonJS
- 前端 Vue.js 腳本：直接掛載至全域 `window`，無模組系統（非 ESM）

## 新增 API Route

1. 在 `src/routes/` 建立 `<featureName>Routes.js`，使用 `express.Router()`
2. 每個 handler 回傳統一格式：`{ data, error, message }`
3. 在 `app.js` 掛載：
   ```javascript
   const featureRoutes = require('./src/routes/featureRoutes');
   app.use('/api/feature', featureRoutes);
   ```
4. 若需認證，在 router 內使用 middleware：
   ```javascript
   const authMiddleware = require('../middleware/authMiddleware');
   const adminMiddleware = require('../middleware/adminMiddleware');
   router.use(authMiddleware);           // 需登入
   router.use(adminMiddleware);          // 需 admin（在 auth 之後）
   ```
5. 在 route handler 加入 JSDoc（供 `npm run openapi` 使用）

### Route Handler 範本

```javascript
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

/**
 * @openapi
 * /api/feature:
 *   get:
 *     tags: [Feature]
 *     summary: 取得資料
 *     responses:
 *       200:
 *         description: 成功
 */
router.get('/', (req, res) => {
  try {
    const result = db.prepare('SELECT * FROM table').all();
    res.json({ data: result, error: null, message: '取得成功' });
  } catch (err) {
    res.status(500).json({ data: null, error: 'SERVER_ERROR', message: '伺服器錯誤' });
  }
});

module.exports = router;
```

## 新增 Middleware

1. 在 `src/middleware/` 建立 `<name>Middleware.js`
2. 標準格式：
   ```javascript
   // 一般 middleware（3 個參數）
   function nameMiddleware(req, res, next) {
     // ...
     next();
   }
   
   // 錯誤 middleware（4 個參數，放在最後）
   function errorHandler(err, req, res, next) {
     // ...
     res.status(500).json({ data: null, error: 'SERVER_ERROR', message: '...' });
   }
   
   module.exports = nameMiddleware;
   ```
3. 在 `app.js` 的適當位置掛載

## 新增資料庫 Table

在 `src/database.js` 的 `initializeDatabase()` 函式中新增 DDL：

```javascript
db.exec(`
  CREATE TABLE IF NOT EXISTS new_table (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
```

若需 seed 資料，在 DDL 之後加入：

```javascript
const existing = db.prepare('SELECT COUNT(*) as count FROM new_table').get();
if (existing.count === 0) {
  db.prepare('INSERT INTO new_table ...').run(...);
}
```

## JSDoc 格式說明

路由 JSDoc 供 `swagger-jsdoc` 解析，須符合 OpenAPI 3.0 格式：

```javascript
/**
 * @openapi
 * /api/path:
 *   post:
 *     tags: [TagName]
 *     summary: 一行說明
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [field1]
 *             properties:
 *               field1:
 *                 type: string
 *                 example: 範例值
 *     responses:
 *       200:
 *         description: 成功描述
 *       400:
 *         description: 參數錯誤
 *       401:
 *         description: 未認證
 */
```

Security schemes 已在 `swagger-config.js` 定義：
- `bearerAuth`：JWT Bearer token
- `sessionId`：`X-Session-Id` header（購物車用）

## 計畫歸檔流程

1. **計畫命名格式**：`YYYY-MM-DD-<feature-name>.md`
   - 範例：`2026-05-03-payment-integration.md`

2. **計畫文件結構**：
   ```markdown
   # Feature Name
   
   ## User Story
   As a <role>, I want to <goal> so that <benefit>.
   
   ## Spec
   - 功能規格點 1
   - 功能規格點 2
   
   ## Tasks
   - [ ] Task 1
   - [ ] Task 2
   - [x] Task 3（已完成）
   ```

3. **進行中**：計畫放在 `docs/plans/`

4. **功能完成後**：
   - 將計畫移至 `docs/plans/archive/`
   - 更新 `docs/FEATURES.md`（確認狀態標記）
   - 在 `docs/CHANGELOG.md` 新增版本記錄

## 前端頁面新增流程

1. 在 `views/pages/` 新增 `.ejs` 模板，選擇 layout：
   ```html
   <% layout('layouts/front') %>
   <% locals.pageScript = '/js/pages/new-page.js' %>
   <!-- 頁面 HTML -->
   ```

2. 在 `public/js/pages/` 新增對應 Vue.js 腳本：
   ```javascript
   const { createApp, ref, onMounted } = Vue;
   createApp({
     setup() {
       // Vue 3 Composition API
     }
   }).mount('#app');
   ```

3. 在 `src/routes/pageRoutes.js` 新增 GET 路由：
   ```javascript
   router.get('/new-page', (req, res) => {
     res.render('pages/new-page');
   });
   ```

## 客戶端工具函式

### `public/js/api.js` — API 請求封裝

```javascript
// 自動帶入 token 和 sessionId
const result = await api.get('/api/products');
const result = await api.post('/api/cart', { productId, quantity });
const result = await api.patch('/api/cart/itemId', { quantity: 2 });
const result = await api.delete('/api/cart/itemId');

// 401 時自動重導向 /login
```

### `public/js/auth.js` — 認證狀態管理

```javascript
Auth.getToken()           // 取得 localStorage 中的 JWT
Auth.getUser()            // 取得目前用戶資料（物件）
Auth.setToken(token)      // 儲存 token
Auth.setUser(user)        // 儲存 user
Auth.logout()             // 清除 token、user，重導向 /login
Auth.isLoggedIn()         // boolean
Auth.getOrCreateSessionId()  // 取得或新增訪客 session ID
```

### `public/js/notification.js` — Toast 通知

```javascript
notify.success('操作成功');
notify.error('發生錯誤');
notify.info('提示訊息');
```
