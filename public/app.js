'use strict';

const usernameInput = document.getElementById('username');
const showProductsBtn = document.getElementById('show-products-btn');
const productList = document.getElementById('product-list');
const selectedProductName = document.getElementById('selected-product-name');
const reviewForm = document.getElementById('review-form');
const startTemuBtn = document.getElementById('start-temu-btn');
const completeTemuBtn = document.getElementById('complete-temu-btn');
const importStatus = document.getElementById('import-status');

let selectedProductId = null;

function setImportStatus(message) {
  importStatus.textContent = message;
}

function currentUsername() {
  return usernameInput.value.trim();
}

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'הבקשה נכשלה');
  }
  return data;
}

function renderProducts(products) {
  productList.innerHTML = '';

  if (!products.length) {
    productList.innerHTML = '<div class="empty-state">עדיין אין מוצרים להזמנה עבור המשתמש הזה.</div>';
    selectedProductId = null;
    selectedProductName.textContent = 'לא נבחר';
    return;
  }

  products.forEach((product) => {
    const card = document.createElement('article');
    card.className = 'product-card';

    const image = product.product_image || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80';
    const ratingValue = Number(product.rating || 0);
    const priceValue = Number(product.price || 0);

    card.innerHTML = `
      <img src="${image}" alt="${product.product_name}" class="product-image" />
      <div class="product-body">
        <span class="site-badge">${product.site}</span>
        <h3>${product.product_name}</h3>
        <div class="product-meta">
          <span>₪${priceValue.toFixed(2)}</span>
          <span>⭐ ${ratingValue.toFixed(1)}/5</span>
        </div>
        <button type="button" class="review-btn" data-product-id="${product.id}" data-product-name="${product.product_name}">כתוב ביקורת</button>
      </div>
    `;

    productList.appendChild(card);
  });
}

async function loadProducts() {
  const username = currentUsername();
  if (!username) {
    productList.innerHTML = '<div class="empty-state">הזינו שם משתמש כדי לראות את כל המוצרים שהזמנתם.</div>';
    selectedProductId = null;
    selectedProductName.textContent = 'לא נבחר';
    return [];
  }

  try {
    const products = await api(`/api/products/${encodeURIComponent(username)}`);
    renderProducts(products);
    return products;
  } catch (err) {
    productList.innerHTML = '<div class="empty-state">לא נמצאו מוצרים עבור המשתמש הזה.</div>';
    selectedProductId = null;
    selectedProductName.textContent = 'לא נבחר';
    return [];
  }
}

productList.addEventListener('click', (event) => {
  const button = event.target.closest('.review-btn');
  if (!button) return;

  selectedProductId = Number(button.dataset.productId);
  selectedProductName.textContent = button.dataset.productName;
  reviewForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('review-body').focus();
});

reviewForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const username = currentUsername();
  if (!username) {
    alert('הזינו שם משתמש');
    return;
  }

  if (!selectedProductId) {
    alert('בחרו מוצר אחד לפני כתיבת ביקורת');
    return;
  }

  const rating = Number(document.getElementById('review-rating').value);
  const body = document.getElementById('review-body').value.trim();

  if (!rating || !body) {
    alert('יש למלא דירוג וביקורת');
    return;
  }

  await api('/api/reviews', {
    method: 'POST',
    body: JSON.stringify({
      username,
      productId: selectedProductId,
      rating,
      body,
    }),
  });

  reviewForm.reset();
  selectedProductId = null;
  selectedProductName.textContent = 'לא נבחר';
  await loadProducts();
});

startTemuBtn.addEventListener('click', async () => {
  const username = currentUsername();
  if (!username) {
    alert('הזינו שם משתמש');
    return;
  }

  startTemuBtn.disabled = true;
  setImportStatus('פותח חלון Temu...');
  try {
    const result = await api('/api/import/temu/start', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
    completeTemuBtn.disabled = false;
    setImportStatus(result.message);
  } catch (error) {
    startTemuBtn.disabled = false;
    setImportStatus(`שגיאה: ${error.message}`);
  }
});

completeTemuBtn.addEventListener('click', async () => {
  const username = currentUsername();
  completeTemuBtn.disabled = true;
  setImportStatus('מייבא מוצרים...');
  try {
    const result = await api('/api/import/temu/complete', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
    setImportStatus(result.message);
    await loadProducts();
  } catch (error) {
    completeTemuBtn.disabled = false;
    setImportStatus(`שגיאה: ${error.message}`);
  }
});

showProductsBtn.addEventListener('click', loadProducts);
usernameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    loadProducts();
  }
});

loadProducts();
