// OHYA2.0 - Age Verification & Privacy Features

const AGE_VERIFICATION_KEY = 'ohya2_age_verified';
const PANIC_BUTTON_KEY = 'ohya2_panic_config';

// ============================================
// AGE VERIFICATION POPUP
// ============================================

function showAgeVerification() {
  // Check if already verified
  if (localStorage.getItem(AGE_VERIFICATION_KEY)) {
    return false;
  }
  
  const overlay = document.createElement('div');
  overlay.id = 'age-verification-overlay';
  overlay.innerHTML = `
    <div class="age-verification-modal">
      <div class="age-logo">🔞</div>
      <h2>年齡確認</h2>
      <p>本網站只適合 18 歲或以上人士瀏覽</p>
      <p class="age-warning">您是否年滿 18 歲？</p>
      <div class="age-buttons">
        <button class="age-btn age-btn-enter" onclick="confirmAge(true)">
          ✅ 我年滿 18 歲
        </button>
        <button class="age-btn age-btn-exit" onclick="confirmAge(false)">
          ❌ 我未滿 18 歲
        </button>
      </div>
      <p class="age-note">按「我年滿 18 歲」即表示您同意瀏覽本網站</p>
    </div>
  `;
  
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    #age-verification-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.95);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      animation: fadeIn 0.3s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .age-verification-modal {
      background: linear-gradient(145deg, #1a1a2e, #16213e);
      padding: 50px 40px;
      border-radius: 20px;
      text-align: center;
      max-width: 420px;
      width: 90%;
      border: 2px solid #ec4899;
      box-shadow: 0 25px 50px rgba(0,0,0,0.5);
      animation: slideUp 0.4s ease;
    }
    @keyframes slideUp {
      from { transform: translateY(30px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .age-logo {
      font-size: 64px;
      margin-bottom: 20px;
    }
    .age-verification-modal h2 {
      color: #fff;
      font-size: 28px;
      margin: 0 0 15px 0;
      font-weight: 700;
    }
    .age-verification-modal p {
      color: #a0aec0;
      font-size: 16px;
      margin: 0 0 10px 0;
      line-height: 1.6;
    }
    .age-warning {
      color: #ec4899 !important;
      font-size: 18px !important;
      font-weight: 600;
      margin: 20px 0 !important;
    }
    .age-buttons {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 30px 0 20px 0;
    }
    .age-btn {
      padding: 16px 32px;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    .age-btn-enter {
      background: linear-gradient(135deg, #10b981, #059669);
      color: #fff;
    }
    .age-btn-enter:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);
    }
    .age-btn-exit {
      background: #374151;
      color: #9ca3af;
    }
    .age-btn-exit:hover {
      background: #4b5563;
    }
    .age-note {
      font-size: 12px !important;
      color: #6b7280 !important;
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(overlay);
  
  return true;
}

function confirmAge(isAdult) {
  if (isAdult) {
    // Save verification status (expires in 30 days)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    localStorage.setItem(AGE_VERIFICATION_KEY, expiryDate.toISOString());
    
    // Remove overlay with animation
    const overlay = document.getElementById('age-verification-overlay');
    overlay.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => {
      overlay.remove();
    }, 300);
  } else {
    // Redirect to Google or show exit message
    alert('很抱歉，您需要年滿 18 歲才能瀏覽本網站。');
    window.location.href = 'https://www.google.com';
  }
}

function checkAgeVerification() {
  const verified = localStorage.getItem(AGE_VERIFICATION_KEY);
  if (verified) {
    const expiryDate = new Date(verified);
    if (new Date() > expiryDate) {
      // Expired, remove and show again
      localStorage.removeItem(AGE_VERIFICATION_KEY);
      return false;
    }
    return true;
  }
  return false;
}

// ============================================
// PANIC BUTTON (緊急按鈕)
// ============================================

function initPanicButton() {
  // Check if panic button is enabled in settings
  const panicConfig = JSON.parse(localStorage.getItem(PANIC_BUTTON_KEY) || '{}');
  if (panicConfig.enabled === false) {
    return; // Disabled by user
  }
  
  const panicBtn = document.createElement('div');
  panicBtn.id = 'panic-button';
  panicBtn.innerHTML = `
    <button class="panic-btn" onclick="showPanicMenu()" title="緊急按鈕">
      ⚡
    </button>
    <div class="panic-menu" id="panic-menu">
      <a href="https://www.google.com" target="_blank" class="panic-item">
        🔍 Google 搜尋
      </a>
      <a href="https://weather.gov.hk" target="_blank" class="panic-item">
        🌤️ 香港天氣
      </a>
      <a href="https://www.youtube.com" target="_blank" class="panic-item">
        📺 YouTube
      </a>
      <a href="https://news.google.com" target="_blank" class="panic-item">
        📰 新聞
      </a>
      <button class="panic-item panic-close" onclick="hidePanicMenu()">
        ✕ 關閉
      </button>
    </div>
  `;
  
  const style = document.createElement('style');
  style.textContent = `
    #panic-button {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999998;
    }
    .panic-btn {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #ef4444, #dc2626);
      border: none;
      color: #fff;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
      transition: all 0.3s ease;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    .panic-btn:hover {
      transform: scale(1.1);
    }
    .panic-menu {
      position: absolute;
      bottom: 70px;
      right: 0;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      overflow: hidden;
      display: none;
      min-width: 180px;
    }
    .panic-menu.show {
      display: block;
      animation: slideIn 0.2s ease;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .panic-item {
      display: block;
      padding: 12px 16px;
      color: #374151;
      text-decoration: none;
      font-size: 14px;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
      cursor: pointer;
      transition: background 0.2s;
    }
    .panic-item:hover {
      background: #f3f4f6;
    }
    .panic-close {
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(panicBtn);
}

function showPanicMenu() {
  document.getElementById('panic-menu').classList.add('show');
}

function hidePanicMenu() {
  document.getElementById('panic-menu').classList.remove('show');
}

// ============================================
// DISCREET PACKAGING NOTICE
// ============================================

function showDiscreetNotice() {
  return `
    <div class="discreet-notice">
      <div class="discreet-icon">🔒</div>
      <div class="discreet-text">
        <strong>隱私保護</strong>
        <span>我們的包裝完全保密，包裹外觀不會顯示任何產品資訊</span>
      </div>
    </div>
  `;
}

function injectDiscreetNotice() {
  // Add to checkout page
  const checkoutForm = document.querySelector('.checkout-form');
  if (checkoutForm) {
    const notice = document.createElement('div');
    notice.className = 'discreet-notice-container';
    notice.innerHTML = showDiscreetNotice();
    checkoutForm.insertBefore(notice, checkoutForm.firstChild);
  }
}

// ============================================
// ORDER PRIVACY - Product Name Sanitization
// ============================================

function sanitizeProductName(productName, category) {
  // Categories that need sanitization
  const adultCategories = ['オナホール', 'ダッチワイフ', 'おっぱいグッズ', '性感クッション', '成人用品'];
  
  // Check if product category needs sanitization
  if (adultCategories.some(cat => category && category.includes(cat))) {
    // Return sanitized name
    const options = ['禮品', '日用品', '精品', '飾物', '禮物'];
    return options[Math.floor(Math.random() * options.length)];
  }
  
  return productName;
}

// ============================================
// INITIALIZE ALL FEATURES
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Age verification (only on main pages, not admin)
  if (!window.location.pathname.includes('/admin/')) {
    if (!checkAgeVerification()) {
      showAgeVerification();
    }
  }
  
  // Panic button (only on main site, not admin)
  if (!window.location.pathname.includes('/admin/')) {
    initPanicButton();
  }
  
  // Discreet notice on checkout
  if (window.location.pathname.includes('/checkout.html')) {
    injectDiscreetNotice();
  }
});

// Export for use in other files
window.ohyaPrivacy = {
  showAgeVerification,
  confirmAge,
  checkAgeVerification,
  initPanicButton,
  showDiscreetNotice,
  sanitizeProductName
};
