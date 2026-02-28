// OHYA2.0 E-Commerce - Main JavaScript

const API_BASE = '';

// Global state
let currentUser = null;
let products = [];
let cart = JSON.parse(localStorage.getItem('ohya2_cart')) || [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  updateCartUI();
  
  // Load products if on products page
  if (document.getElementById('products-grid')) {
    loadProducts();
  }
  
  // Load categories
  loadCategories();
});

// Auth Functions
async function checkAuth() {
  try {
    const response = await fetch(`${API_BASE}/api/auth/me`);
    const data = await response.json();
    currentUser = data.user;
    updateAuthUI();
  } catch (error) {
    console.error('Auth check failed:', error);
  }
}

function updateAuthUI() {
  const userMenu = document.getElementById('user-menu');
  if (!userMenu) return;

  if (currentUser) {
    let menuHTML = `
      <span>Welcome, ${currentUser.name}</span>
    `;
    if (currentUser.isAdmin) {
      menuHTML += `<a href="/admin/" class="btn-primary">Admin Panel</a>`;
    }
    menuHTML += `<button onclick="logout()" class="btn btn-logout">Logout</button>`;
    userMenu.innerHTML = menuHTML;
  } else {
    userMenu.innerHTML = `
      <a href="/login.html" class="btn btn-login">Login</a>
      <a href="/register.html" class="btn btn-register">Register</a>
    `;
  }
}

async function login(email, password) {
  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (data.success) {
      currentUser = data.user;
      updateAuthUI();
      showToast('Login successful!', 'success');
      return true;
    } else {
      showToast(data.error || 'Login failed', 'error');
      return false;
    }
  } catch (error) {
    showToast('Login failed', 'error');
    return false;
  }
}

async function logout() {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST' });
    currentUser = null;
    updateAuthUI();
    showToast('Logged out successfully', 'success');
    window.location.href = '/';
  } catch (error) {
    showToast('Logout failed', 'error');
  }
}

async function register(email, password, name, phone) {
  try {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, phone })
    });
    const data = await response.json();
    if (data.success) {
      showToast('Registration successful! Please login.', 'success');
      return true;
    } else {
      showToast(data.error || 'Registration failed', 'error');
      return false;
    }
  } catch (error) {
    showToast('Registration failed', 'error');
    return false;
  }
}

// Products Functions
async function loadProducts(category = '') {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading">Loading products...</div>';

  try {
    const url = category 
      ? `${API_BASE}/api/products?category=${encodeURIComponent(category)}`
      : `${API_BASE}/api/products`;
    const response = await fetch(url);
    products = await response.json();
    renderProducts(products);
  } catch (error) {
    grid.innerHTML = '<div class="loading">Failed to load products</div>';
  }
}

function renderProducts(productsToRender) {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  if (productsToRender.length === 0) {
    grid.innerHTML = '<div class="loading">No products found</div>';
    return;
  }

  grid.innerHTML = productsToRender.map(product => `
    <div class="product-card">
      <a href="/product.html?id=${product.id}">
        ${product.image 
          ? `<img src="${product.image}" alt="${product.name}" class="product-image">`
          : `<div class="product-image placeholder">No Image</div>`
        }
      </a>
      <div class="product-info">
        <div class="product-category">${product.category || 'General'}</div>
        <a href="/product.html?id=${product.id}">
          <h3 class="product-name">${product.name}</h3>
        </a>
        <div class="product-price">$${product.price.toFixed(2)}</div>
        <div class="product-stock">Stock: ${product.stock > 0 ? product.stock : 'Out of stock'}</div>
      </div>
      <div class="product-actions">
        <a href="/product.html?id=${product.id}" class="btn btn-outline">View</a>
        <button class="btn btn-primary" onclick="addToCart(${product.id})" ${product.stock <= 0 ? 'disabled' : ''}>
          Add to Cart
        </button>
      </div>
    </div>
  `).join('');
}

async function loadCategories() {
  try {
    const response = await fetch(`${API_BASE}/api/categories`);
    const categories = await response.json();
    renderCategoryFilters(categories);
  } catch (error) {
    console.error('Failed to load categories:', error);
  }
}

function renderCategoryFilters(categories) {
  const container = document.getElementById('category-filters');
  if (!container) return;

  const filtersHTML = `
    <button class="category-btn active" onclick="filterProducts('')">All</button>
    ${categories.map(cat => `
      <button class="category-btn" onclick="filterProducts('${cat}')">${cat}</button>
    `).join('')}
  `;
  container.innerHTML = filtersHTML;
}

function filterProducts(category) {
  // Update active button
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim() === (category || 'All'));
  });
  
  if (category) {
    loadProducts(category);
  } else {
    loadProducts();
  }
}

// Cart Functions
function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const existingItem = cart.find(item => item.id === productId);
  if (existingItem) {
    if (existingItem.quantity < product.stock) {
      existingItem.quantity++;
    } else {
      showToast('Maximum stock reached', 'error');
      return;
    }
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: 1,
      stock: product.stock
    });
  }

  saveCart();
  updateCartUI();
  showToast('Added to cart!', 'success');
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  saveCart();
  updateCartUI();
}

function updateCartQuantity(productId, quantity) {
  const item = cart.find(item => item.id === productId);
  if (item) {
    const product = products.find(p => p.id === productId);
    if (quantity <= 0) {
      removeFromCart(productId);
    } else if (quantity <= product?.stock) {
      item.quantity = quantity;
      saveCart();
      updateCartUI();
    }
  }
}

function saveCart() {
  localStorage.setItem('ohya2_cart', JSON.stringify(cart));
}

function updateCartUI() {
  const badge = document.querySelector('.cart-badge');
  if (badge) {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    badge.textContent = totalItems;
    badge.style.display = totalItems > 0 ? 'flex' : 'none';
  }
}

function getCartTotal() {
  return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function getCartItems() {
  return cart;
}

// Single Product Page
async function loadProductDetail() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('id');
  
  if (!productId) {
    window.location.href = '/';
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/products/${productId}`);
    const product = await response.json();
    
    if (!product.id) {
      window.location.href = '/';
      return;
    }

    renderProductDetail(product);
  } catch (error) {
    showToast('Failed to load product', 'error');
  }
}

function renderProductDetail(product) {
  document.getElementById('product-image').src = product.image || '';
  document.getElementById('product-name').textContent = product.name;
  document.getElementById('product-category').textContent = product.category || 'General';
  document.getElementById('product-description').textContent = product.description || 'No description available';
  document.getElementById('product-price').textContent = `$${product.price.toFixed(2)}`;
  document.getElementById('product-stock').textContent = product.stock > 0 ? `In Stock (${product.stock} available)` : 'Out of Stock';
  document.getElementById('add-to-cart-btn').disabled = product.stock <= 0;
  
  // Set product data for quantity
  document.getElementById('add-to-cart-btn').dataset.productId = product.id;
}

// Utility Functions
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

// Export functions for use in other scripts
window.ohya2 = {
  login,
  logout,
  register,
  addToCart,
  removeFromCart,
  updateCartQuantity,
  getCartTotal,
  getCartItems,
  currentUser: () => currentUser,
  showToast
};
