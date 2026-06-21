async function loadProducts() {
  const response = await fetch('/api/products');
  const products = await response.json();
  const container = document.getElementById('products');

  container.innerHTML = products.map((product) => `
    <article class="card">
      <h3>${product.name}</h3>
      <p>${product.description}</p>
      <strong>¥${product.price.toLocaleString()}</strong>
    </article>
  `).join('');
}

async function handleSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = Object.fromEntries(formData.entries());

  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  document.getElementById('result').textContent = `${result.message} - ${result.customer}`;
}

window.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  document.getElementById('checkout-form').addEventListener('submit', handleSubmit);
});
