const crypto = require('crypto');
const https = require('https');

// ECPay CheckMacValue 專用 URL encode（CMV-SHA256 協議，不可用於 AES 加密）
// 規則：encodeURIComponent → %20→+ → ~→%7e → '→%27 → toLowerCase → .NET 保留字元還原
function ecpayUrlEncode(source) {
  let encoded = encodeURIComponent(source)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7e')
    .replace(/'/g, '%27');
  encoded = encoded.toLowerCase();
  const restore = {
    '%2d': '-', '%5f': '_', '%2e': '.', '%21': '!',
    '%2a': '*', '%28': '(', '%29': ')',
  };
  for (const [k, v] of Object.entries(restore)) {
    encoded = encoded.split(k).join(v);
  }
  return encoded;
}

function generateCheckMacValue(params, hashKey, hashIv) {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([k]) => k !== 'CheckMacValue')
  );
  const sorted = Object.keys(filtered)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const paramStr = sorted.map(k => `${k}=${filtered[k]}`).join('&');
  const raw = `HashKey=${hashKey}&${paramStr}&HashIV=${hashIv}`;
  const encoded = ecpayUrlEncode(raw);
  return crypto.createHash('sha256').update(encoded, 'utf8').digest('hex').toUpperCase();
}

// timing-safe 驗證，防止 timing attack
function verifyCheckMacValue(params, hashKey, hashIv) {
  const received = (params.CheckMacValue || '').toUpperCase();
  const calculated = generateCheckMacValue(params, hashKey, hashIv);
  const bufA = Buffer.from(received);
  const bufB = Buffer.from(calculated);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// 台灣時間（UTC+8），格式 yyyy/MM/dd HH:mm:ss
function getMerchantTradeDate() {
  return new Date()
    .toLocaleString('sv-SE', {
      timeZone: 'Asia/Taipei',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    })
    .replace(/-/g, '/');
}

function getEcpayConfig() {
  const isStage = (process.env.ECPAY_ENV || 'staging') !== 'production';
  const base = isStage
    ? 'https://payment-stage.ecpay.com.tw'
    : 'https://payment.ecpay.com.tw';
  return {
    merchantId: process.env.ECPAY_MERCHANT_ID,
    hashKey: process.env.ECPAY_HASH_KEY,
    hashIv: process.env.ECPAY_HASH_IV,
    paymentUrl: `${base}/Cashier/AioCheckOut/V5`,
    queryUrl: `${base}/Cashier/QueryTradeInfo/V5`,
  };
}

// 呼叫 QueryTradeInfo/V5，回傳解析後物件
// TradeStatus: '0'=未付款, '1'=已付款, '10200095'=交易失敗
function queryTradeInfo(merchantTradeNo, config) {
  return new Promise((resolve, reject) => {
    const params = {
      MerchantID: config.merchantId,
      MerchantTradeNo: merchantTradeNo,
      TimeStamp: String(Math.floor(Date.now() / 1000)),
    };
    params.CheckMacValue = generateCheckMacValue(params, config.hashKey, config.hashIv);

    const body = new URLSearchParams(params).toString();
    const url = new URL(config.queryUrl);

    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(Object.fromEntries(new URLSearchParams(data)));
        } catch (e) {
          reject(new Error('QueryTradeInfo 回應解析失敗：' + data));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('QueryTradeInfo 請求逾時'));
    });
    req.write(body);
    req.end();
  });
}

module.exports = {
  generateCheckMacValue,
  verifyCheckMacValue,
  getMerchantTradeDate,
  getEcpayConfig,
  queryTradeInfo,
};
