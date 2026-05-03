# 功能清單

## 完成狀態總覽

| 功能模組 | 狀態 | 說明 |
|----------|------|------|
| 用戶認證 | 完成 | 註冊、登入、JWT 認證、角色管理 |
| 商品瀏覽 | 完成 | 列表（分頁）、詳情 |
| 商品管理（管理員） | 完成 | CRUD，含庫存管理 |
| 購物車（雙模式） | 完成 | 訪客 Session + 已登入 JWT |
| 訂單建立與查詢 | 完成 | 從購物車建立、訂單歷史 |
| 支付模擬 | 完成 | 模擬成功/失敗（ECPay 尚未整合） |
| 訂單管理（管理員） | 完成 | 查詢全部訂單、狀態篩選 |
| 前台 SSR 頁面 | 完成 | 所有頁面（EJS + Vue.js） |
| OpenAPI 文件 | 完成 | swagger-jsdoc + generate-openapi.js |
| ECPay 金流 | 未完成 | 僅有環境變數佔位符 |

---

## 用戶認證

### POST /api/auth/register — 註冊

**行為**：建立新用戶帳號，回傳用戶資料與 JWT token。

| 欄位 | 必填 | 說明 |
|------|------|------|
| email | 必填 | 唯一，重複時回傳 409 |
| password | 必填 | 最少 6 個字元 |
| name | 必填 | 顯示名稱 |

**業務邏輯**：
1. 檢查所有必填欄位（缺少 → 400）
2. 檢查 email 是否已存在（已存在 → 409）
3. `bcrypt.hash(password, 10)` 產生 password_hash
4. 以 UUID v4 為 id 插入 users 表
5. 產生 JWT（payload: `{ userId, email, role: 'user' }`，有效期 7 天）
6. 回傳 `{ user: { id, email, name, role }, token }`

**錯誤情境**：

| HTTP | error 欄位 | 觸發條件 |
|------|-----------|----------|
| 400 | INVALID_INPUT | 缺少 email、password 或 name |
| 400 | INVALID_INPUT | password 少於 6 個字元 |
| 409 | EMAIL_EXISTS | email 已被註冊 |

---

### POST /api/auth/login — 登入

**行為**：以 email + password 驗證，回傳 JWT token。

| 欄位 | 必填 | 說明 |
|------|------|------|
| email | 必填 | — |
| password | 必填 | — |

**業務邏輯**：
1. 以 email 查詢用戶（不存在 → 401，避免洩漏用戶是否存在）
2. `bcrypt.compareSync(password, user.password_hash)` 驗證密碼（不符 → 401）
3. 產生 JWT，有效期 7 天
4. 回傳 `{ user: { id, email, name, role }, token }`

**錯誤情境**：

| HTTP | error 欄位 | 觸發條件 |
|------|-----------|----------|
| 400 | INVALID_INPUT | 缺少 email 或 password |
| 401 | INVALID_CREDENTIALS | email 不存在或密碼錯誤 |

---

### GET /api/auth/profile — 取得用戶資料

**行為**：回傳目前登入用戶的完整資料（不含 password_hash）。

**認證**：Bearer token 必填。

**回應**：`{ id, email, name, role, created_at }`

---

## 商品瀏覽

### GET /api/products — 商品列表

**行為**：以分頁方式回傳商品列表，無需認證。

**查詢參數**：

| 參數 | 型別 | 必填 | 預設 | 限制 |
|------|------|------|------|------|
| page | integer | 否 | 1 | ≥ 1 |
| limit | integer | 否 | 10 | 1 ~ 100 |

**回應**：
```json
{
  "data": {
    "products": [{ "id": "...", "name": "...", "price": 299, "stock": 10, "image_url": "..." }],
    "pagination": { "total": 8, "page": 1, "limit": 10, "totalPages": 1 }
  },
  "error": null,
  "message": "取得成功"
}
```

---

### GET /api/products/:id — 商品詳情

**行為**：回傳單一商品完整資料。

**回應**：`{ id, name, description, price, stock, image_url, created_at, updated_at }`

**錯誤情境**：商品不存在 → 404

---

## 商品管理（管理員）

所有路由需 **JWT Bearer token + admin 角色**。非 admin → 403，未認證 → 401。

### GET /api/admin/products — 管理員商品列表

與公開 `/api/products` 相同結構，但可用於管理後台。

---

### POST /api/admin/products — 新增商品

| 欄位 | 必填 | 型別 | 說明 |
|------|------|------|------|
| name | 必填 | string | 商品名稱 |
| description | 選填 | string | 商品描述 |
| price | 必填 | integer | 單價，必須 > 0 |
| stock | 必填 | integer | 庫存，必須 ≥ 0 |
| image_url | 選填 | string | 圖片 URL |

**回應**：201 + 完整商品物件

---

### PUT /api/admin/products/:id — 更新商品

**行為**：部分更新，僅傳入需更新的欄位。

**驗證規則**：
- `name` 若傳入，不可為空字串
- `price` 若傳入，必須 > 0
- `stock` 若傳入，必須 ≥ 0

**業務邏輯**：更新時同步更新 `updated_at` 欄位為 `datetime('now')`

---

### DELETE /api/admin/products/:id — 刪除商品

**業務邏輯**：
1. 查詢商品是否存在（不存在 → 404）
2. 檢查是否有 `status = 'pending'` 的訂單包含此商品（有 → 409）
3. 從 products 表刪除

**重要**：`paid` 或 `failed` 訂單的商品可以刪除（因為 order_items 已快照名稱與價格，不影響訂單記錄）；只有 `pending` 訂單因為可能還需要扣庫存而被保護。

**錯誤情境**：

| HTTP | error 欄位 | 觸發條件 |
|------|-----------|----------|
| 404 | NOT_FOUND | 商品不存在 |
| 409 | PRODUCT_IN_USE | 商品存在於 pending 訂單中 |

---

## 購物車（雙模式認證）

購物車同時支援**已登入用戶**（JWT）與**訪客**（X-Session-Id），兩者購物車資料分開儲存。

**認證識別邏輯**（cartRoutes.js）：
- 請求帶有 `Authorization: Bearer <token>` → 使用 userId 作為 cart key
- 請求帶有 `X-Session-Id: <uuid>` → 使用 sessionId 作為 cart key
- 兩者均無 → 401

---

### GET /api/cart — 查看購物車

**行為**：回傳目前購物車所有項目，包含商品快照資料與計算總金額。

**回應**：
```json
{
  "data": {
    "items": [
      {
        "id": "cart-item-uuid",
        "product_id": "product-uuid",
        "quantity": 2,
        "product": { "name": "玫瑰花束", "price": 599, "stock": 10, "image_url": "..." }
      }
    ],
    "total": 1198
  }
}
```

---

### POST /api/cart — 加入購物車

| 欄位 | 必填 | 說明 |
|------|------|------|
| productId | 必填 | 商品 UUID |
| quantity | 否 | 預設 1，必須 ≥ 1 |

**業務邏輯（累加機制）**：
1. 確認商品存在（不存在 → 404）
2. 查詢購物車中是否已有此商品
3. **若已存在**：現有 quantity + 新 quantity，並驗證新總量不超過庫存
4. **若不存在**：新增 cart_items 記錄，並驗證 quantity ≤ stock

> 購物車不會因重複加入而報錯，而是自動累加數量。

**錯誤情境**：

| HTTP | 觸發條件 |
|------|----------|
| 404 | 商品不存在 |
| 400 | quantity < 1 |
| 400 | 總數量超過庫存 |

---

### PATCH /api/cart/:itemId — 更新購物車數量

| 欄位 | 必填 | 說明 |
|------|------|------|
| quantity | 必填 | 新數量，必須 ≥ 1 |

**業務邏輯**：
1. 確認 cart_items 屬於目前用戶/session（防止跨用戶修改 → 404）
2. 驗證新 quantity 不超過商品庫存
3. 更新數量

---

### DELETE /api/cart/:itemId — 移除購物車項目

**業務邏輯**：驗證 cart_items 屬於目前用戶/session 後刪除。

---

## 訂單

所有訂單路由需 **JWT Bearer token**（必須是已登入用戶）。

### POST /api/orders — 建立訂單

**行為**：從購物車建立訂單，使用 SQLite transaction 確保原子性。

| 欄位 | 必填 | 說明 |
|------|------|------|
| recipientName | 必填 | 收件人姓名 |
| recipientEmail | 必填 | 收件人信箱 |
| recipientAddress | 必填 | 收件地址 |

**業務邏輯（Transaction）**：
1. 取得用戶購物車所有項目（含商品資料）
2. 若購物車為空 → 400
3. 逐一檢查每件商品庫存是否足夠（庫存不足 → 400，列出商品名）
4. 計算總金額 = sum(price × quantity)
5. 以 `db.transaction()` 執行以下操作：
   a. 產生訂單編號（`ORD-YYYYMMDD-XXXXX`）
   b. 插入 orders 記錄
   c. 逐一插入 order_items 記錄（快照商品名稱與價格）
   d. 逐一扣減 products.stock
   e. 刪除用戶購物車所有項目
6. 回傳完整訂單資料（含 items）

**Transaction 的重要性**：若任一步驟失敗（例如庫存扣減衝突），整個操作回滾，不會出現「訂單建立但庫存未扣」的半完成狀態。

**回應（201）**：
```json
{
  "data": {
    "id": "...",
    "order_no": "ORD-20260503-A1B2C",
    "total_amount": 1198,
    "status": "pending",
    "items": [...],
    "created_at": "2026-05-03 12:00:00"
  }
}
```

---

### GET /api/orders — 查詢我的訂單列表

**行為**：回傳目前登入用戶的所有訂單（不含 items），按建立時間倒序。

**回應**：`{ orders: [{ id, order_no, total_amount, status, created_at }] }`

---

### GET /api/orders/:id — 查詢訂單詳情

**行為**：回傳單一訂單完整資料，含 items。

**安全機制**：僅能查詢自己的訂單（`WHERE id = ? AND user_id = ?`），查詢他人訂單會回傳 404（而非 403，避免洩漏資訊）。

**回應**：`{ id, order_no, recipient_name, recipient_email, recipient_address, total_amount, status, created_at, items: [{...}] }`

---

### PATCH /api/orders/:id/pay — 模擬支付

**行為**：模擬支付閘道回呼，更新訂單狀態。

| 欄位 | 必填 | 說明 |
|------|------|------|
| action | 必填 | `'success'` 或 `'fail'` |

**業務邏輯**：
1. 確認訂單屬於目前用戶
2. 確認訂單狀態為 `pending`（非 pending → 400，訂單已處理）
3. `action === 'success'` → status 改為 `paid`
4. `action === 'fail'` → status 改為 `failed`
5. 回傳更新後訂單（含 items）

**注意**：此為模擬 API，正式整合 ECPay 後此端點將被替換。

---

## 訂單管理（管理員）

需 **JWT Bearer token + admin 角色**。

### GET /api/admin/orders — 管理員訂單列表

**查詢參數**：

| 參數 | 型別 | 必填 | 預設 | 說明 |
|------|------|------|------|------|
| page | integer | 否 | 1 | — |
| limit | integer | 否 | 10 | — |
| status | string | 否 | （全部） | `pending`、`paid` 或 `failed` |

**回應**：`{ orders: [...], pagination: { total, page, limit, totalPages } }`

---

### GET /api/admin/orders/:id — 管理員訂單詳情

**行為**：與用戶端訂單詳情相似，但包含下單用戶資訊。

**回應包含額外欄位**：`{ ...order, items: [...], user: { name, email } }`

---

## Seed 商品資料

系統啟動時若 products 表為空，自動插入 8 筆花卉商品：

| 商品名稱 | 售價（NTD） | 庫存 |
|----------|-------------|------|
| 玫瑰花束 | 599 | 50 |
| 向日葵 | 299 | 100 |
| 薰衣草 | 399 | 75 |
| 百合花 | 499 | 60 |
| 繡球花 | 459 | 45 |
| 鬱金香 | 349 | 80 |
| 非洲菊 | 249 | 120 |
| 蘭花盆栽 | 899 | 30 |

---

## 非標準機制說明

### 雙模式購物車

訪客（未登入）可使用 `X-Session-Id` header 進行購物車操作，session ID 由前端 `auth.js` 的 `Auth.getOrCreateSessionId()` 產生並存入 localStorage。用戶登入後，訪客購物車不會自動合併（此為目前已知限制）。

### 訂單商品快照

`order_items` 儲存下單時的 `product_name` 和 `product_price`，而非僅儲存 `product_id`。這確保商品後續被修改或刪除時，歷史訂單記錄仍然正確。

### 訂單刪除保護

商品刪除時若有 `pending` 狀態的訂單，API 回傳 409。`paid` 和 `failed` 訂單中的商品不受此保護，因為快照已保存資料。
