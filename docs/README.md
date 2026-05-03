# 花卉電商平台

以花卉為主題的全端電商應用，作為課程作業示範 RESTful API、JWT 認證、購物車與訂單流程的完整實作。

## 技術棧

| 層級 | 技術 | 版本 |
|------|------|------|
| 執行環境 | Node.js | LTS |
| Web 框架 | Express.js | 4.22.1 |
| 資料庫 | better-sqlite3 (SQLite) | 12.8.0 |
| 認證 | jsonwebtoken + bcrypt | 9.0.2 / 6.0.0 |
| 模板引擎 | EJS | 5.0.1 |
| 前端框架 | Vue.js 3 (Global Build, CDN) | 3.x |
| CSS 框架 | Tailwind CSS | 4.2.2 |
| 測試框架 | Vitest + Supertest | 4.1.5 / 7.2.2 |
| API 文件 | swagger-jsdoc | 6.2.8 |
| 其他 | uuid, cors, dotenv | — |

## 快速開始

### 前置需求

- Node.js LTS（建議 20+）
- npm

### 安裝與啟動

```bash
# 1. 複製專案
git clone <repo-url>
cd 2026-ai-adv-homework-course01-main

# 2. 安裝相依套件
npm install

# 3. 設定環境變數
cp .env.example .env
# 必填：編輯 .env，設定 JWT_SECRET

# 4. 啟動開發伺服器（需兩個 terminal）
npm run dev:server   # Terminal 1：啟動 Express
npm run dev:css      # Terminal 2：Tailwind watch

# 或一次性建置 CSS 後啟動（正式環境）
npm start
```

### 存取應用

| 路徑 | 說明 |
|------|------|
| http://localhost:3001 | 首頁（商品列表） |
| http://localhost:3001/login | 登入 / 註冊 |
| http://localhost:3001/cart | 購物車 |
| http://localhost:3001/checkout | 結帳頁 |
| http://localhost:3001/orders | 我的訂單 |
| http://localhost:3001/admin/products | 管理後台 — 商品管理 |
| http://localhost:3001/admin/orders | 管理後台 — 訂單管理 |

### 預設帳號

| 角色 | Email | 密碼 |
|------|-------|------|
| 管理員 | admin@hexschool.com | 12345678 |

> 可透過 `.env` 中的 `ADMIN_EMAIL` / `ADMIN_PASSWORD` 修改預設管理員帳密。

## 常用指令

```bash
npm start            # 建置 CSS → 啟動伺服器
npm run dev:server   # 只啟動伺服器（不重建 CSS）
npm run dev:css      # Tailwind watch 模式
npm run css:build    # 單次 minify CSS
npm test             # 執行所有測試
npm run openapi      # 產生 openapi.json
```

## 文件索引

| 文件 | 說明 |
|------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 目錄結構、啟動流程、API 路由、DB Schema、認證機制 |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | 開發規範、命名規則、新增模組步驟、環境變數表 |
| [FEATURES.md](./FEATURES.md) | 功能清單、端點總覽、業務邏輯說明 |
| [TESTING.md](./TESTING.md) | 測試架構、執行順序、撰寫新測試指引 |
| [CHANGELOG.md](./CHANGELOG.md) | 版本更新記錄 |
