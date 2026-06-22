let cart = [];
let productsCache = [];
const API_BASE_URL = 'https://azshopfuncdemo1782073070.azurewebsites.net/api';

function formatPrice(value) {
  return `¥${Number(value || 0).toLocaleString('ja-JP')}`;
}

function updateCartQuantity(productId, delta) {
  const target = cart.find((item) => String(item.product.id) === String(productId));
  if (!target) return;

  target.quantity += delta;
  if (target.quantity <= 0) {
    cart = cart.filter((item) => String(item.product.id) !== String(productId));
  }
  renderCart();
}

function renderCart() {
  const cartItems = document.getElementById('cart-items');
  const cartCount = document.getElementById('cart-count');
  const cartTotal = document.getElementById('cart-total');
  const checkoutSection = document.getElementById('checkout-section');

  if (cart.length === 0) {
    cartItems.innerHTML = `
      <div class="empty-state">
        <strong>まだ商品が入っていません</strong>
        <p>気になるアイテムを選んでください。</p>
      </div>
    `;
    cartCount.textContent = '0点';
    cartTotal.textContent = formatPrice(0);
    checkoutSection.classList.add('hidden');
    return;
  }

  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce((sum, item) => sum + Number(item.product.price || 0) * item.quantity, 0);

  cartItems.innerHTML = cart.map((item) => `
    <div class="cart-item">
      <div>
        <strong>${item.product.name}</strong>
        <p>${item.product.description}</p>
      </div>
      <div class="cart-item-meta">
        <div class="quantity-controls">
          <button class="qty-btn" data-product-id="${item.product.id}" data-delta="-1" type="button">−</button>
          <span>${item.quantity}</span>
          <button class="qty-btn" data-product-id="${item.product.id}" data-delta="1" type="button">＋</button>
        </div>
        <strong>${formatPrice(Number(item.product.price || 0) * item.quantity)}</strong>
        <button class="remove-item" data-product-id="${item.product.id}" type="button">削除</button>
      </div>
    </div>
  `).join('');

  cartCount.textContent = `${totalQuantity}点`;
  cartTotal.textContent = formatPrice(totalAmount);
  checkoutSection.classList.remove('hidden');

  document.querySelectorAll('.qty-btn').forEach((button) => {
    button.addEventListener('click', () => {
      updateCartQuantity(button.dataset.productId, Number(button.dataset.delta));
    });
  });

  document.querySelectorAll('.remove-item').forEach((button) => {
    button.addEventListener('click', () => {
      updateCartQuantity(button.dataset.productId, -999);
    });
  });
}

function addToCart(product) {
  const existing = cart.find((item) => String(item.product.id) === String(product.id));
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ product, quantity: 1 });
  }
  document.getElementById('cart-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  renderCart();
}

async function loadProducts() {
  const response = await fetch(`${API_BASE_URL}/products`);
  const products = await response.json();
  const container = document.getElementById('products');
  productsCache = products;

  container.innerHTML = products.map((product) => {
    const badge = product.id === 1 ? '人気' : product.id === 2 ? '定番' : '新作';
    return `
      <article class="card">
        <div class="product-top">
          <span class="product-badge">${badge}</span>
          <span class="product-stock">在庫あり</span>
        </div>
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <div class="product-price-row">
          <strong>${formatPrice(product.price)}</strong>
          <button class="add-to-cart" type="button" data-product-id="${product.id}">カートに入れる</button>
        </div>
      </article>
    `;
  }).join('');

  document.querySelectorAll('.add-to-cart').forEach((button) => {
    button.addEventListener('click', () => {
      const product = productsCache.find((item) => String(item.id) === String(button.dataset.productId));
      if (product) {
        addToCart(product);
      }
    });
  });
}

async function loadOrders() {
  const response = await fetch(`${API_BASE_URL}/orders`);
  const orders = await response.json();
  const container = document.getElementById('orders');

  if (!Array.isArray(orders) || orders.length === 0) {
    container.innerHTML = '<p>まだ注文はありません。</p>';
    return;
  }

  container.innerHTML = `
    <div class="table-card">
      <table>
        <thead>
          <tr>
            <th>注文者</th>
            <th>メール</th>
            <th>商品</th>
            <th>合計金額</th>
            <th>ステータス</th>
            <th>日時</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map((order) => `
            <tr data-order-id="${order.id}" class="order-row">
              <td>${order.customerName}</td>
              <td>${order.email}</td>
              <td>${order.productLabel}</td>
              <td>${order.formattedAmount}</td>
              <td><span class="status-badge">${order.status}</span></td>
              <td>${new Date(order.createdAt).toLocaleString('ja-JP')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.querySelectorAll('.order-row').forEach((row) => {
    row.addEventListener('click', () => {
      const order = orders.find((item) => String(item.id) === row.dataset.orderId);
      if (!order) return;

      const modal = document.getElementById('order-modal');
      const body = document.getElementById('modal-body');
      body.innerHTML = `
        <p><strong>注文者:</strong> ${order.customerName}</p>
        <p><strong>メール:</strong> ${order.email}</p>
        <p><strong>住所:</strong> ${order.address || '住所未入力'}</p>
        <p><strong>商品:</strong> ${order.productLabel}</p>
        <p><strong>合計金額:</strong> ${order.formattedAmount}</p>
        <p><strong>ステータス:</strong> ${order.status}</p>
        <p><strong>注文日時:</strong> ${new Date(order.createdAt).toLocaleString('ja-JP')}</p>
      `;
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
    });
  });
}

function openConfirmModal() {
  const form = document.getElementById('checkout-form');
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  const totalAmount = cart.reduce((sum, item) => sum + Number(item.product.price || 0) * item.quantity, 0);
  const body = document.getElementById('confirm-body');
  const modal = document.getElementById('confirm-modal');

  body.innerHTML = `
    <div class="confirm-summary">
      <p><strong>お名前:</strong> ${payload.customerName || '未入力'}</p>
      <p><strong>メール:</strong> ${payload.email || '未入力'}</p>
      <p><strong>お届け先:</strong> ${payload.address || '未入力'}</p>
      <p><strong>商品数:</strong> ${cart.length}点</p>
      <p><strong>合計金額:</strong> ${formatPrice(totalAmount)}</p>
    </div>
  `;

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

async function handleSubmit(event) {
  event.preventDefault();
  if (cart.length === 0) {
    document.getElementById('result').textContent = 'まずは商品をカートに入れてください。';
    return;
  }

  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  const totalAmount = cart.reduce((sum, item) => sum + Number(item.product.price || 0) * item.quantity, 0);

  document.getElementById('confirm-modal').classList.add('hidden');
  document.getElementById('confirm-modal').setAttribute('aria-hidden', 'true');
  document.getElementById('result').innerHTML = '<strong>注文を送信しています…</strong> 少しお待ちください。';

  try {
    const response = await fetch(`${API_BASE_URL}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        productIds: cart.map((item) => item.product.id).join(','),
        totalAmount,
        status: '新規受付'
      })
    });

    const result = await response.json();
    document.getElementById('result').innerHTML = `<strong>ご注文ありがとうございます。</strong> ${result.message} - ${result.customer}`;
    cart = [];
    renderCart();
    form.reset();
    await loadOrders();
  } catch (error) {
    document.getElementById('result').innerHTML = '<strong>注文の送信に失敗しました。</strong> もう一度お試しください。';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  loadOrders();
  document.getElementById('checkout-form').addEventListener('submit', (event) => {
    event.preventDefault();
    openConfirmModal();
  });

  document.getElementById('confirm-button').addEventListener('click', () => {
    openConfirmModal();
  });

  document.getElementById('submit-order').addEventListener('click', async () => {
    const form = document.getElementById('checkout-form');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    await handleSubmit({ currentTarget: form, preventDefault() {} });
  });

  document.getElementById('cancel-confirm').addEventListener('click', () => {
    document.getElementById('confirm-modal').classList.add('hidden');
    document.getElementById('confirm-modal').setAttribute('aria-hidden', 'true');
  });

  document.getElementById('close-confirm-modal').addEventListener('click', () => {
    document.getElementById('confirm-modal').classList.add('hidden');
    document.getElementById('confirm-modal').setAttribute('aria-hidden', 'true');
  });

  document.getElementById('close-modal').addEventListener('click', () => {
    const modal = document.getElementById('order-modal');
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  });

  document.getElementById('order-modal').addEventListener('click', (event) => {
    if (event.target.id === 'order-modal') {
      event.currentTarget.classList.add('hidden');
      event.currentTarget.setAttribute('aria-hidden', 'true');
    }
  });

  document.getElementById('confirm-modal').addEventListener('click', (event) => {
    if (event.target.id === 'confirm-modal') {
      event.currentTarget.classList.add('hidden');
      event.currentTarget.setAttribute('aria-hidden', 'true');
    }
  });
});
