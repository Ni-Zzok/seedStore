(function () {
  const form = document.getElementById('catalogForm');
  const grid = document.getElementById('catalogGrid');
  const errorBox = document.getElementById('catalogError');

  function showError(message) {
    errorBox.textContent = message;
    errorBox.style.display = 'block';
  }

  function clearError() {
    errorBox.textContent = '';
    errorBox.style.display = 'none';
  }

  function formParams() {
    const params = new URLSearchParams(new FormData(form));
    [...params.entries()].forEach(([key, value]) => {
      if (!value) params.delete(key);
    });
    return params;
  }

  function productCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <a href="/product/${encodeURIComponent(product.article)}" class="product-card-link">
        <img src="${product.image_url || '/logo.png'}" alt="${escapeHtml(product.name)}">
        <h3>${escapeHtml(product.name)}</h3>
        <p class="category">Категория: ${escapeHtml(product.category_name || 'Без категории')}</p>
        <p class="price">${Number(product.price).toFixed(2)} руб.</p>
        <p class="stock">В наличии: ${product.stock} шт.</p>
      </a>
      <button type="button" class="add-to-cart-btn" ${product.stock <= 0 ? 'disabled' : ''}>Добавить в корзину</button>
    `;
    card.querySelector('.add-to-cart-btn').addEventListener('click', () => addToCart(product.article));
    return card;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
  }

  async function loadProducts(pushState = true) {
    clearError();
    const params = formParams();
    if (pushState) history.replaceState(null, '', `/catalog?${params.toString()}`);
    grid.innerHTML = '<p>Загрузка товаров...</p>';
    try {
      const response = await fetch(`/api/products?${params.toString()}`, { headers: { Accept: 'application/json' } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось загрузить каталог');
      grid.innerHTML = '';
      if (!data.items.length) {
        grid.innerHTML = '<p>Товары не найдены.</p>';
        return;
      }
      data.items.forEach((product) => grid.appendChild(productCard(product)));
    } catch (err) {
      grid.innerHTML = '';
      showError(err.message);
    }
  }

  async function addToCart(article) {
    clearError();
    try {
      const response = await fetch('/api/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ article, quantity: 1 })
      });
      const data = response.status === 204 ? null : await response.json();
      if (!response.ok) throw new Error(data?.error || 'Не удалось добавить товар в корзину');
      alert('Товар добавлен в корзину');
    } catch (err) {
      showError(err.message);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    loadProducts();
  });
  form.querySelectorAll('select').forEach((select) => select.addEventListener('change', () => loadProducts()));
  loadProducts(false);
})();
