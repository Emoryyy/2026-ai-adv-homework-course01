# ECPay 綠界金流整合計劃

## 背景

本專案為花卉電商平台，付款功能原為模擬（`PATCH /api/orders/:id/pay`）。本次整合真實綠界 ECPay AIO 全方位金流。因專案運行於 localhost 無法接收 ServerNotify（ReturnURL S2S），改以 **OrderResultURL（瀏覽器端重導）+ QueryTradeInfo 主動查詢**雙重驗證。

## 流程架構

```
用戶點「前往付款」
       ↓
POST /api/ecpay/checkout/:orderId  (JWT auth)
       ↓
回傳 { actionUrl, params }（含 CheckMacValue）
       ↓
前端動態建立 <form> 並 submit → payment-stage.ecpay.com.tw
       ↓
用戶在綠界頁面完成刷卡（測試卡 4311-9522-2222-2222, 3DS: 1234）
       ↓
ECPay 透過瀏覽器 POST → POST /api/ecpay/return (OrderResultURL)
       ↓
呼叫 QueryTradeInfo 主動驗證 TradeStatus
       ↓
更新訂單狀態 → redirect /orders/:id?paymentResult=success|failed
```

## 異動檔案

### 新建
- `src/utils/ecpay.js` — CheckMacValue / QueryTradeInfo 工具函式
- `src/routes/ecpayRoutes.js` — ECPay 金流路由

### 修改
- `src/database.js` — 加 `merchant_trade_no` 欄位 migration
- `app.js` — 註冊 `/api/ecpay` 路由
- `views/pages/order-detail.ejs` — 替換模擬按鈕 → ECPay 付款按鈕
- `public/js/pages/order-detail.js` — 替換 simulatePay → handlePayWithEcpay

## 測試

- 測試信用卡：`4311-9522-2222-2222`，有效期任意，CVV `222`，3DS `1234`
- 環境：`ECPAY_ENV=staging`，使用 `payment-stage.ecpay.com.tw`
