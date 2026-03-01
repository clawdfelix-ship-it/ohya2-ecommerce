/**
 * OHYA2.0 Telegram Bot - CRM Bot for Adult Products Store
 * 
 * Features:
 * - Welcome messages for new customers
 * - Order status notifications
 * - New product / restock / flash sale alerts
 * - Order lookup
 * - Broadcast to subscribers
 * 
 * Language: Cantonese (廣東話)
 */

const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

// Bot configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';

// Database helper
let sql = null;
function initDatabase(db) {
  sql = db;
}

// Initialize bot (only if token is set)
let bot = null;
let isBotEnabled = false;

function initBot(database) {
  if (sql === null && database) {
    initDatabase(database);
  }
  
  if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.log('⚠️ Telegram Bot: No token configured. Set TELEGRAM_BOT_TOKEN env var to enable.');
    return null;
  }
  
  try {
    bot = new TelegramBot(BOT_TOKEN, { polling: true });
    isBotEnabled = true;
    console.log('✅ OHYA2.0 Telegram Bot initialized!');
    
    setupBotCommands();
    setupBotCallbacks();
    
    return bot;
  } catch (e) {
    console.error('❌ Telegram Bot init error:', e.message);
    return null;
  }
}

// ==================== BOT COMMANDS ====================

function setupBotCommands() {
  if (!bot) return;
  
  // /start - Welcome and subscribe
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name || '朋友';
    
    // Save subscriber to database
    await subscribeUser(chatId, msg.from);
    
    const welcomeMsg = `
👋 歡迎呀 ${userName}！

🔞 OHYA2.0 成人用品店

我可以幫你：
📦 查詢訂單狀態
🛒 睇最新產品
🔔 接收最新優惠通知
📞 聯絡客戶服務

輸入 /help 可以睇到所有指令！
    `.trim();
    
    sendMessage(chatId, welcomeMsg);
  });
  
  // /help - Show all commands
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    
    const helpMsg = `
📱 OHYA2.0 指令列表

可用指令：
/start - 開始使用 / 重新訂閱
/help - 睇呢個幫助訊息
/order [訂單編號] - 查詢訂單狀態
/products - 睇最新產品
/unsubscribe - 取消訂閱通知
/cancel - 取消當前操作

其他功能：
💰 優惠碼優惠
📦 匿蹤包裝送貨
🔒 私隱保障

有問題？可以搵我地客戶服務！
    `.trim();
    
    sendMessage(chatId, helpMsg);
  });
  
  // /order - Look up order
  bot.onText(/\/order(?:\s+(\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const orderId = match[1];
    
    if (!orderId) {
      sendMessage(chatId, '📝 請輸入訂單編號，例如：\n/order 123');
      return;
    }
    
    try {
      // Get order from database
      const orders = await sql`
        SELECT o.*, u.name as customer_name, u.phone
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.id = ${orderId}
      `;
      
      if (orders.length === 0) {
        sendMessage(chatId, `❌ 搵唔到訂單 #${orderId}`);
        return;
      }
      
      const order = orders[0];
      
      // Get order items
      const items = await sql`
        SELECT oi.*, p.name as product_name
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ${orderId}
      `;
      
      // Sanitize product names for privacy
      const sanitizedItems = items.map(item => ({
        ...item,
        product_name: sanitizeProductName(item.product_name, item.category)
      }));
      
      const statusText = getOrderStatusText(order.status);
      const statusEmoji = getOrderStatusEmoji(order.status);
      
      const orderMsg = `
📦 訂單資料 #${order.id}

👤 客戶：${order.customer_name || 'Guest'}
📞 電話：${order.phone || 'N/A'}
📍 狀態：${statusEmoji} ${statusText}
📅 日期：${new Date(order.created_at).toLocaleDateString('zh-HK')}

🛍️ 貨品：
${sanitizedItems.map(i => `• ${i.product_name} x${i.quantity}`).join('\n')}

💰 總額：HK$ ${order.total}

${order.tracking_number ? `📬 物流單號：${order.tracking_number}` : ''}
      `.trim();
      
      sendMessage(chatId, orderMsg);
    } catch (e) {
      console.error('Order lookup error:', e);
      sendMessage(chatId, '❌ 系統錯誤，請稍後再試');
    }
  });
  
  // /products - Show latest products
  bot.onText(/\/products/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      const products = await sql`
        SELECT * FROM products 
        WHERE active = 1 
        ORDER BY id DESC 
        LIMIT 5
      `;
      
      if (products.length === 0) {
        sendMessage(chatId, '暫時未有產品');
        return;
      }
      
      let productsMsg = '🆕 最新產品\n\n';
      
      products.forEach(p => {
        productsMsg += `📦 ${p.name}\n`;
        productsMsg += `   💵 HK$ ${p.price_retail || p.price}\n`;
        productsMsg += `   📦 庫存: ${p.stock > 0 ? '有貨' : '缺貨'}\n\n`;
      });
      
      productsMsg += '👉 想睇更多？去我地網站啦！';
      
      sendMessage(chatId, productsMsg);
    } catch (e) {
      sendMessage(chatId, '❌ 系統錯誤');
    }
  });
  
  // /unsubscribe
  bot.onText(/\/unsubscribe/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      await sql`
        DELETE FROM telegram_subscribers WHERE telegram_id = ${chatId}
      `;
      
      sendMessage(chatId, `
😢 已經取消訂閱...

唔使擔心，你可以隨時輸入 /start 再次訂閱！
有咩需要可以隨時搵我地！
      `.trim());
    } catch (e) {
      sendMessage(chatId, '❌ 取消訂閱失敗，請稍後再試');
    }
  });
  
  // Handle order ID queries (conversational)
  bot.on('message', async (msg) => {
    if (msg.text && /^\d{4,}$/.test(msg.text.trim())) {
      // Looks like an order ID
      const orderId = parseInt(msg.text.trim());
      // Simulate /order command
      bot.emit('text', msg); // This won't trigger the regex, so we handle manually
    }
  });
}

// ==================== CALLBACK QUERIES ====================

function setupBotCallbacks() {
  if (!bot) return;
  
  bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    
    if (data === 'view_order') {
      // Handle view order callback
    }
  });
}

// ==================== NOTIFICATION FUNCTIONS ====================

// Send message to a specific user
async function sendMessage(chatId, text, options = {}) {
  if (!bot || !isBotEnabled) {
    console.log('[Telegram Bot] Would send:', text.substring(0, 50));
    return false;
  }
  
  try {
    await bot.sendMessage(chatId, text, options);
    return true;
  } catch (e) {
    console.error('[Telegram Bot] Send error:', e.message);
    return false;
  }
}

// Send to all subscribers (broadcast)
async function broadcastToSubscribers(message, options = {}) {
  if (!bot || !isBotEnabled) {
    console.log('[Telegram Bot] Would broadcast:', message.substring(0, 50));
    return { success: 0, failed: 0 };
  }
  
  try {
    const subscribers = await sql`
      SELECT telegram_id FROM telegram_subscribers WHERE active = 1
    `;
    
    let success = 0;
    let failed = 0;
    
    for (const sub of subscribers) {
      try {
        await bot.sendMessage(sub.telegram_id, message, options);
        success++;
      } catch (e) {
        failed++;
      }
    }
    
    return { success, failed };
  } catch (e) {
    console.error('[Telegram Bot] Broadcast error:', e);
    return { success: 0, failed: 0 };
  }
}

// Notify customer about order status change
async function notifyOrderStatus(orderId, status, customerName, phone) {
  if (!sql) return;
  
  try {
    // Find subscriber by name/phone
    const subscriber = await sql`
      SELECT telegram_id FROM telegram_subscribers 
      WHERE name = ${customerName} OR phone = ${phone}
      LIMIT 1
    `;
    
    if (subscriber.length === 0) {
      console.log(`[Telegram Bot] No subscriber found for order #${orderId}`);
      return;
    }
    
    const statusText = getOrderStatusText(status);
    const statusEmoji = getOrderStatusEmoji(status);
    
    const message = `
📦 訂單狀態更新！

訂單 #${orderId} 
狀態：${statusEmoji} ${statusText}

多謝支持！如有問題可以搵我地客戶服務！
    `.trim();
    
    await sendMessage(subscriber[0].telegram_id, message);
  } catch (e) {
    console.error('[Telegram Bot] Order notification error:', e);
  }
}

// Notify about new product
async function notifyNewProduct(product) {
  const message = `
🆕 新產品上架！

📦 ${product.name}
💵 售價：HK$ ${product.price_retail || product.price}
📦 庫存: ${product.stock} 件

${product.description ? product.description.substring(0, 100) + '...' : ''}

👉 去網站睇睇：${process.env.SITE_URL || 'https://ohya2.com'}
  `.trim();
  
  return broadcastToSubscribers(message, {
    parse_mode: 'HTML'
  });
}

// Notify about flash sale
async function notifyFlashSale(product, discountPercent) {
  const originalPrice = product.price_retail || product.price;
  const salePrice = Math.round(originalPrice * (1 - discountPercent / 100));
  
  const message = `
⚡ Flash Sale!!!

📦 ${product.name}
💰 原價：HK$ ${originalPrice}
🔥 特價：HK$ ${salePrice} (${discountPercent}% OFF)
📦 數量有限！

👉 快啲去抢！
  `.trim();
  
  return broadcastToSubscribers(message, {
    parse_mode: 'HTML'
  });
}

// ==================== DATABASE FUNCTIONS ====================

async function subscribeUser(telegramId, telegramUser) {
  if (!sql) return;
  
  try {
    // Check if already subscribed
    const existing = await sql`
      SELECT id FROM telegram_subscribers WHERE telegram_id = ${telegramId}
    `;
    
    if (existing.length > 0) {
      // Update
      await sql`
        UPDATE telegram_subscribers 
        SET active = 1, updated_at = NOW()
        WHERE telegram_id = ${telegramId}
      `;
    } else {
      // Insert
      await sql`
        INSERT INTO telegram_subscribers (telegram_id, name, username, active, subscribed_at)
        VALUES (${telegramId}, ${telegramUser.first_name}, ${telegramUser.username}, 1, NOW())
      `;
    }
    
    console.log(`[Telegram Bot] Subscribed: ${telegramId}`);
  } catch (e) {
    console.error('[Telegram Bot] Subscribe error:', e);
  }
}

// ==================== HELPER FUNCTIONS ====================

function getOrderStatusText(status) {
  const statusMap = {
    'pending': '待處理',
    'processing': '處理中',
    'shipped': '已發貨',
    'completed': '已完成',
    'refunded': '已退款',
    'cancelled': '已取消'
  };
  return statusMap[status] || status;
}

function getOrderStatusEmoji(status) {
  const emojiMap = {
    'pending': '⏳',
    'processing': '📦',
    'shipped': '📬',
    'completed': '✅',
    'refunded': '💸',
    'cancelled': '❌'
  };
  return emojiMap[status] || '📋';
}

// Adult product name sanitization
const ADULT_CATEGORIES = ['オナホール', 'ダッチワイフ', 'おっぱいグッズ', '性感クッション', '成人用品'];
const SANITIZED_NAMES = ['禮品', '日用品', '精品', '飾物', '禮物'];

function sanitizeProductName(productName, category) {
  if (ADULT_CATEGORIES.some(cat => category && category.includes(cat))) {
    return SANITIZED_NAMES[Math.floor(Math.random() * SANITIZED_NAMES.length)];
  }
  return productName;
}

// ==================== EXPORTS ====================

module.exports = {
  initBot,
  initDatabase,
  sendMessage,
  broadcastToSubscribers,
  notifyOrderStatus,
  notifyNewProduct,
  notifyFlashSale,
  isEnabled: () => isBotEnabled
};
