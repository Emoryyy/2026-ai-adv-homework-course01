# CLAUDE.md

## 專案概述

花卉電商平台 — Node.js / Express + SQLite + EJS + Vue.js 3 + Tailwind CSS 4

後端 REST API 搭配伺服器端渲染 (SSR) 的全端應用，具備使用者認證、商品管理、購物車（雙模式：已登入 JWT + 訪客 Session）、訂單與支付模擬功能。

## 常用指令

```bash
# 開發
node server.js                          # 啟動伺服器（需先建置 CSS）
npm run dev:server                      # 只啟動伺服器
npm run dev:css                         # Tailwind watch 模式

# 建置
npm start                               # 建置 CSS 後啟動伺服器（正式環境）
npm run css:build                       # 單次 minify CSS

# 測試
npm test                                # 執行所有測試（依序）

# 工具
npm run openapi                         # 產生 openapi.json（需各 Route 的 JSDoc）
```

## 關鍵規則

- **JWT_SECRET 必須設定**：server.js 啟動時若無此環境變數，直接 `process.exit(1)`
- **購物車雙模式認證**：已登入用戶使用 Bearer token；訪客使用 `X-Session-Id` header，兩者互斥，未設定則回傳 401
- **訂單建立為 SQLite transaction**：扣庫存、建立 order_items、清空購物車皆在同一 transaction 內，不可拆分
- **刪除商品前須確認**：若商品存在於 `pending` 狀態的訂單中，刪除會回傳 409，前端須顯示錯誤訊息
- **測試執行有順序依賴**：vitest.config.js 中定義了執行順序，auth → products → cart → orders → adminProducts → adminOrders，不可並行
- **功能開發須記錄計畫**：使用 `docs/plans/YYYY-MM-DD-<feature>.md`；功能完成後移至 `docs/plans/archive/`

## 詳細文件

- [./docs/README.md](./docs/README.md) — 項目介紹與快速開始
- [./docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — 架構、目錄結構、資料流
- [./docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) — 開發規範、命名規則、環境變數
- [./docs/FEATURES.md](./docs/FEATURES.md) — 功能列表、端點總覽與行為描述
- [./docs/TESTING.md](./docs/TESTING.md) — 測試規範與指南
- [./docs/CHANGELOG.md](./docs/CHANGELOG.md) — 更新日誌
