# 測試規範

## 測試架構

| 工具 | 版本 | 用途 |
|------|------|------|
| Vitest | 4.1.5 | 測試 runner、assertions |
| Supertest | 7.2.2 | HTTP 端對端測試（不啟動真實 server） |

測試直接操作 `app.js` 匯出的 Express 實例，使用 `src/database.sqlite` 的記憶體狀態（每次 `npm test` 都是全新的 SQLite 資料庫）。

## 測試檔案與執行順序

**執行順序由 `vitest.config.js` 的 `sequence.files` 控制，必須依序執行**：

| 順序 | 檔案 | 說明 |
|------|------|------|
| 1 | `tests/auth.test.js` | 用戶註冊與登入（後續測試依賴此步驟產生 token） |
| 2 | `tests/products.test.js` | 公開商品端點（list, detail, 404） |
| 3 | `tests/cart.test.js` | 購物車（訪客 + 已登入，依賴 auth.test.js 的用戶） |
| 4 | `tests/orders.test.js` | 訂單建立與查詢（依賴 cart.test.js 的購物車狀態） |
| 5 | `tests/adminProducts.test.js` | 管理員商品 CRUD（依賴 auth.test.js 的 admin token） |
| 6 | `tests/adminOrders.test.js` | 管理員訂單查詢（依賴先前測試建立的訂單） |

> **不可並行執行**：Vitest 設定 `pool: 'forks'` + `sequence.concurrent: false`，所有測試共享同一 SQLite 資料庫狀態。

## 輔助函式（tests/setup.js）

`tests/setup.js` 提供測試共用輔助函式，不直接匯出測試 suite：

```javascript
const { app, request, getAdminToken, registerUser } = require('./setup');
```

| 函式 | 回傳 | 說明 |
|------|------|------|
| `app` | Express app | 直接 require('./app')，供 supertest 使用 |
| `request` | supertest instance | `supertest(app)` |
| `getAdminToken()` | Promise\<string\> | 以預設管理員帳號登入，回傳 JWT token |
| `registerUser(suffix)` | Promise\<{token, userId}\> | 註冊新測試用戶（email 加入 suffix 確保唯一） |

**getAdminToken 實作**：
```javascript
async function getAdminToken() {
  const res = await request.post('/api/auth/login').send({
    email: process.env.ADMIN_EMAIL || 'admin@hexschool.com',
    password: process.env.ADMIN_PASSWORD || '12345678'
  });
  return res.body.data.token;
}
```

**registerUser 實作**：
```javascript
async function registerUser(suffix = '') {
  const email = `test${suffix}${Date.now()}@example.com`;
  const res = await request.post('/api/auth/register').send({
    email,
    password: 'password123',
    name: `Test User ${suffix}`
  });
  return { token: res.body.data.token, userId: res.body.data.user.id };
}
```

## 執行測試

```bash
# 執行所有測試（依序）
npm test

# 或直接使用 vitest
npx vitest run

# 觀看模式（開發時使用）
npx vitest
```

## 各測試檔案說明

### auth.test.js

**測試情境**：
- 正常註冊 → 201 + token
- 缺少必填欄位 → 400
- 密碼少於 6 碼 → 400
- 重複 email → 409
- 正常登入 → 200 + token
- 錯誤密碼 → 401
- 使用 token 取得 profile → 200
- 無 token 取得 profile → 401

### products.test.js

**測試情境**：
- 取得商品列表（預設分頁）→ 200 + pagination
- 取得商品列表（自訂 page/limit）→ 200
- 取得單一商品 → 200
- 取得不存在商品 → 404

### cart.test.js

**前置**：使用 `registerUser()` 建立測試用戶；準備 `X-Session-Id` 測試訪客模式。

**測試情境**：
- 訪客模式加入購物車（X-Session-Id）→ 200
- 已登入用戶加入購物車（Bearer token）→ 200
- 重複加入同商品 → 累加 quantity
- 加入不存在商品 → 404
- 加入超過庫存數量 → 400
- 查看購物車 → 200 + items + total
- 更新數量 → 200
- 超過庫存更新 → 400
- 移除項目 → 200
- 無認證 → 401

### orders.test.js

**前置**：使用 `registerUser()` + 加入商品至購物車。

**測試情境**：
- 建立訂單（購物車有商品）→ 201 + order_no 格式正確
- 建立訂單後購物車清空 → GET /api/cart 回傳空 items
- 建立訂單後庫存扣減 → GET /api/products/:id stock 減少
- 空購物車建立訂單 → 400
- 查詢我的訂單列表 → 200
- 查詢訂單詳情 → 200 + items
- 查詢他人訂單 → 404
- 模擬支付成功 → status = 'paid'
- 模擬支付失敗 → status = 'failed'
- 對已支付訂單再次支付 → 400

### adminProducts.test.js

**前置**：使用 `getAdminToken()` 取得管理員 token。

**測試情境**：
- 管理員取得商品列表 → 200
- 新增商品（完整欄位）→ 201
- 新增商品（缺少必填）→ 400
- 新增商品（price = 0）→ 400
- 更新商品（部分更新）→ 200
- 更新商品（stock < 0）→ 400
- 刪除商品 → 200
- 刪除不存在商品 → 404
- 一般用戶存取 → 403
- 未認證存取 → 401

### adminOrders.test.js

**前置**：依賴 orders.test.js 建立的訂單資料。

**測試情境**：
- 管理員取得所有訂單（含分頁）→ 200
- 以 status 篩選訂單 → 200（只回傳對應 status）
- 取得訂單詳情（含 user 資訊）→ 200
- 一般用戶存取 → 403
- 未認證存取 → 401

## 撰寫新測試的步驟

1. 在 `tests/` 新增 `<feature>.test.js`
2. 引入 setup 輔助函式：
   ```javascript
   const { app, request, getAdminToken, registerUser } = require('./setup');
   ```
3. 使用 `describe` 分組，`it` 描述情境：
   ```javascript
   describe('Feature', () => {
     let token;
     let createdId;
   
     beforeAll(async () => {
       const result = await registerUser('feature');
       token = result.token;
     });
   
     it('should do something', async () => {
       const res = await request(app)
         .post('/api/feature')
         .set('Authorization', `Bearer ${token}`)
         .send({ key: 'value' });
   
       expect(res.status).toBe(201);
       expect(res.body.data).toHaveProperty('id');
       createdId = res.body.data.id;
     });
   });
   ```
4. 在 `vitest.config.js` 的 `sequence.files` 陣列中加入新檔案（按依賴順序）：
   ```javascript
   sequence: {
     files: [
       'tests/auth.test.js',
       'tests/products.test.js',
       // ...
       'tests/feature.test.js'  // 加在這裡
     ]
   }
   ```

## 常見陷阱

### 1. 測試資料庫狀態依賴
測試間有狀態依賴，例如 `orders.test.js` 的測試假設購物車中有商品（由 `cart.test.js` 加入）。若單獨執行 `orders.test.js` 可能失敗。

**解法**：永遠使用 `npm test` 執行全部測試，或在 `beforeAll` 中自行設定前置狀態。

### 2. Bcrypt 速度問題
正式環境 bcrypt 使用 saltRounds=10，大量測試時很慢。

**解法**：`tests/setup.js` 設定 `process.env.NODE_ENV = 'test'`，database.js 的 seed 函式在 test 模式使用 saltRounds=1。

### 3. 訪客購物車 Session ID 必須是 UUID
`X-Session-Id` 的值應為 UUID v4 格式（前端由 `Auth.getOrCreateSessionId()` 產生）。測試中直接硬編碼一個 UUID 字串即可：
```javascript
const sessionId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
```

### 4. 訂單 ID vs 訂單編號
- `id`：UUID v4（內部 primary key）
- `order_no`：`ORD-YYYYMMDD-XXXXX`（顯示用）
測試 `GET /api/orders/:id` 要使用 `id`（UUID），不是 `order_no`。

### 5. 購物車清空後無法查詢
訂單建立後購物車被清空，後續的 `GET /api/cart` 回傳空 items 而非 404，注意 assert 目標。
