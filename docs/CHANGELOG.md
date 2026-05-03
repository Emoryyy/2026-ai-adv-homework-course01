# 更新日誌

所有重要變更記錄於此文件。格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)。

---

## [1.0.0] — 2026-05-03

### 新增

**用戶認證系統**
- `POST /api/auth/register` — 用戶註冊，bcrypt 加密密碼，回傳 JWT
- `POST /api/auth/login` — 用戶登入，回傳 JWT
- `GET /api/auth/profile` — 取得目前用戶資料（需 JWT）
- JWT HS256，有效期 7 天

**商品功能**
- `GET /api/products` — 公開商品列表（分頁：page、limit）
- `GET /api/products/:id` — 公開商品詳情
- `GET /api/admin/products` — 管理員商品列表
- `POST /api/admin/products` — 新增商品
- `PUT /api/admin/products/:id` — 更新商品
- `DELETE /api/admin/products/:id` — 刪除商品（pending 訂單保護）
- Seed 資料：8 筆花卉商品

**購物車功能**
- `GET /api/cart` — 查看購物車
- `POST /api/cart` — 加入購物車（累加機制）
- `PATCH /api/cart/:itemId` — 更新數量
- `DELETE /api/cart/:itemId` — 移除項目
- 雙模式認證：JWT Bearer（已登入）+ X-Session-Id（訪客）

**訂單功能**
- `POST /api/orders` — 從購物車建立訂單（SQLite transaction：建立訂單 + 扣庫存 + 清空購物車）
- `GET /api/orders` — 查詢我的訂單列表
- `GET /api/orders/:id` — 查詢訂單詳情
- `PATCH /api/orders/:id/pay` — 模擬支付（success/fail）
- `GET /api/admin/orders` — 管理員查詢所有訂單（status 篩選）
- `GET /api/admin/orders/:id` — 管理員訂單詳情（含用戶資訊）

**前台頁面（SSR + Vue.js 3）**
- 首頁（商品列表、分頁）
- 商品詳情頁
- 購物車頁
- 結帳頁
- 登入/註冊頁
- 我的訂單頁
- 訂單詳情頁
- 管理員商品管理頁
- 管理員訂單管理頁
- 404 頁面

**基礎架構**
- Express.js 4.22.1 + better-sqlite3 12.8.0
- EJS 模板引擎（front / admin layout 繼承）
- Tailwind CSS 4.2.2 utility-first 樣式
- middleware：session、auth、admin、errorHandler
- SQLite WAL 模式、外鍵約束
- Swagger/OpenAPI 3.0 文件自動產生

**測試**
- Vitest 4.1.5 + Supertest 7.2.2
- 6 個測試檔，依序執行：auth → products → cart → orders → adminProducts → adminOrders
- 測試輔助函式：getAdminToken()、registerUser()

---

## 文件更新記錄格式說明

新增版本時，在此文件頂部（`[1.0.0]` 之前）插入新條目：

```markdown
## [版本號] — YYYY-MM-DD

### 新增
- 功能描述

### 修改
- 變更描述

### 修復
- 錯誤修復描述

### 移除
- 移除功能描述
```
