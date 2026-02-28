// OHYA2.0 - Cart Page JavaScript

document.addEventListener('DOMContentLoaded', () => {
  renderCart();
});

function renderCart() {
  const cartItems = window.ohya2.getCartItems();
  const cartList = document.getElementById('cart-items');
  const cartEmpty = document.getElementById('cart-empty');
  const cartContent = document.getElementById('cart-content');
  const cartTotal = document.getElementById('cart-total-amount');

  if (!cartList) return;

  if (cartItems.length === 0) {
    cartEmpty.classList.remove('hidden');
    cartContent.classList.add('hidden');
    return;
  }

  cartEmpty.classList.add('hidden');
  cartContent.classList.remove('hidden');

  cartList.innerHTML = cartItems.map(item => `
    <div class="cart-item" data-id="${item.id}">
      <div class="cart-product-info">
        ${item.image 
          ? `<img src="${item.image}" alt="${item.name}" class="cart-product-image">`
          : `<div class="cart-product-image" style="display:flex;align-items:center;justify-content:center;">No Image</div>`
        }
        <div>
          <h4>${item.name}</h4>
          <p class="product-price">$${item.price.toFixed(2)}</p>
        </div>
      </div>
      <div class="cart-quantity">
        <button class="quantity-btn" onclick="updateQty(${item.id}, ${item.quantity - 1})">-</button>
        <span style="margin: 0 10px;">${item.quantity}</span>
        <button class="quantity-btn" onclick="updateQty(${item.id}, ${item.quantity + 1})">+</button>
      </div>
      <div class="cart-subtotal">
        $${(item.price * item.quantity).toFixed(2)}
      </div>
      <div class="cart-actions">
        <button class="btn btn-danger" onclick="removeItem(${item.id})">Remove</button>
      </div>
    </div>
  `).join('');

  cartTotal.textContent = `$${window.ohya2.getCartTotal().toFixed(2)}`;
}

function updateQty(productId, quantity) {
  window.ohya2.updateCartQuantity(productId, quantity);
  renderCart();
}

function removeItem(productId) {
  window.ohya2.removeFromCart(productId);
  renderCart();
  window.ohya2.showToast('Item removed from cart', 'success');
}

function proceedToCheckout() {
  if (!window.ohya2.currentUser()) {
    window.ohya2.showToast('Please login to checkout', 'error');
    window.location.href = '/login.html?redirect=/checkout.html';
    return;
  }

  const cartItems = window.ohya2.getCartItems();
  if (cartItems.length === 0) {
    window.ohya2.showToast('Your cart is empty', 'error');
    return;
  }

  window.location.href = '/checkout.html';
}

// Export for use
window.renderCart = renderCart;
window.updateQty = updateQty;
window.removeItem = removeItem;
window.proceedToCheckout = proceedToCheckout;
