const express = require('express');
const db = require('../database');
const authMiddleware = require('../middleware/authMiddleware');
const {
  generateCheckMacValue,
  verifyCheckMacValue,
  getMerchantTradeDate,
  getEcpayConfig,
  queryTradeInfo,
} = require('../utils/ecpay');

const router = express.Router();

// POST /api/ecpay/checkout/:orderId
// 建立 ECPay AIO 付款參數，回傳 { actionUrl, params }
router.post('/checkout/:orderId', authMiddleware, (req, res) => {
  const order = db
    .prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(req.params.orderId, req.user.userId);

  if (!order) {
    return res.status(404).json({ data: null, error: 'NOT_FOUND', message: '訂單不存在' });
  }
  if (order.status !== 'pending' && order.status !== 'failed') {
    return res.status(400).json({ data: null, error: 'INVALID_STATUS', message: '訂單已付款，無法重新付款' });
  }

  // 若先前失敗，重設為 pending 再重新付款
  if (order.status === 'failed') {
    db.prepare("UPDATE orders SET status = 'pending' WHERE id = ?").run(order.id);
  }

  const config = getEcpayConfig();
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  // MerchantTradeNo：去除連字號 + 時間戳後4位，確保每次重試都是新的唯一編號（ECPay 不允許重複）
  const suffix = String(Math.floor(Date.now() / 1000)).slice(-4);
  const merchantTradeNo = (order.order_no.replace(/-/g, '') + suffix).substring(0, 20);

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  // ItemName 以 # 分隔，截至 200 字元避免 ECPay 截斷導致 CheckMacValue 不符
  const itemName = items
    .map(i => `${i.product_name.replace(/#/g, '|')} x${i.quantity}`)
    .join('#')
    .substring(0, 200);

  const params = {
    MerchantID: config.merchantId,
    MerchantTradeNo: merchantTradeNo,
    MerchantTradeDate: getMerchantTradeDate(),
    PaymentType: 'aio',
    TotalAmount: String(order.total_amount),
    TradeDesc: '花卉電商訂單',
    ItemName: itemName,
    ReturnURL: `${baseUrl}/api/ecpay/notify`,
    OrderResultURL: `${baseUrl}/api/ecpay/return`,
    ChoosePayment: 'ALL',
    EncryptType: '1',
  };

  params.CheckMacValue = generateCheckMacValue(params, config.hashKey, config.hashIv);

  // 儲存 merchantTradeNo 供 return/notify 回呼時查詢
  db.prepare('UPDATE orders SET merchant_trade_no = ? WHERE id = ?')
    .run(merchantTradeNo, order.id);

  res.json({
    data: { actionUrl: config.paymentUrl, params },
    error: null,
    message: '成功',
  });
});

// POST /api/ecpay/return
// ECPay OrderResultURL：消費者付款後瀏覽器被導回此端點（Form POST）
// 主動呼叫 QueryTradeInfo 驗證付款狀態，再 redirect 回訂單頁
router.post('/return', async (req, res) => {
  const params = req.body;
  const config = getEcpayConfig();

  if (!verifyCheckMacValue(params, config.hashKey, config.hashIv)) {
    console.error('[ECPay] return CheckMacValue 驗證失敗', params.MerchantTradeNo);
    return res.redirect('/orders?paymentResult=failed');
  }

  const merchantTradeNo = params.MerchantTradeNo;
  const order = db
    .prepare('SELECT * FROM orders WHERE merchant_trade_no = ?')
    .get(merchantTradeNo);

  if (!order) {
    console.error('[ECPay] return 查無訂單 MerchantTradeNo=', merchantTradeNo);
    return res.redirect('/orders?paymentResult=failed');
  }

  // 主動查詢 ECPay 確認付款狀態（不依賴 Form POST 參數，以防竄改）
  try {
    const queryResult = await queryTradeInfo(merchantTradeNo, config);
    const tradeStatus = queryResult.TradeStatus;

    if (tradeStatus === '1') {
      if (order.status === 'pending') {
        db.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").run(order.id);
      }
      return res.redirect(`/orders/${order.id}?paymentResult=success`);
    } else {
      if (order.status === 'pending') {
        db.prepare("UPDATE orders SET status = 'failed' WHERE id = ?").run(order.id);
      }
      return res.redirect(`/orders/${order.id}?paymentResult=failed`);
    }
  } catch (err) {
    // QueryTradeInfo 失敗時 fallback：使用 ECPay 傳回的 RtnCode
    console.error('[ECPay] QueryTradeInfo 失敗，使用 fallback RtnCode:', err.message);
    const rtnCode = String(params.RtnCode || '');
    if (rtnCode === '1') {
      if (order.status === 'pending') {
        db.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").run(order.id);
      }
      return res.redirect(`/orders/${order.id}?paymentResult=success`);
    } else {
      if (order.status === 'pending') {
        db.prepare("UPDATE orders SET status = 'failed' WHERE id = ?").run(order.id);
      }
      return res.redirect(`/orders/${order.id}?paymentResult=failed`);
    }
  }
});

// POST /api/ecpay/notify
// ECPay ReturnURL（S2S）：localhost 無法被 ECPay 到達，此端點作為 stub
// 若部署至公開主機，此端點會正常接收並更新訂單（冪等）
router.post('/notify', (req, res) => {
  const params = req.body;
  const config = getEcpayConfig();

  if (verifyCheckMacValue(params, config.hashKey, config.hashIv)) {
    const rtnCode = String(params.RtnCode || '');
    const merchantTradeNo = params.MerchantTradeNo;

    if (rtnCode === '1' && merchantTradeNo) {
      const order = db
        .prepare('SELECT * FROM orders WHERE merchant_trade_no = ?')
        .get(merchantTradeNo);
      if (order && order.status === 'pending') {
        db.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").run(order.id);
      }
    }
  }

  // ECPay 要求回應純文字 1|OK + HTTP 200，否則最多重送 4 次
  res.status(200).type('text').send('1|OK');
});

module.exports = router;
