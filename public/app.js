'use strict';

const usernameInput = document.getElementById('username');

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
    throw new Error(data.error || 'request failed');
  }
  return data;
}

async function loadOrders() {
  const username = currentUsername();
  if (!username) return [];
  try {
    const orders = await api(`/api/orders/${encodeURIComponent(username)}`);
    renderOrders(orders);
    return orders;
  } catch (err) {
    return [];
  }
}

function renderOrders(orders) {
  const list = document.getElementById('order-list');
  const select = document.getElementById('review-order');
  list.innerHTML = '';
  select.innerHTML = '';
  orders.forEach((order) => {
    const li = document.createElement('li');
    li.textContent = `${order.site}: ${order.product_name}`;
    list.appendChild(li);

    const option = document.createElement('option');
    option.value = order.id;
    option.textContent = `${order.site}: ${order.product_name}`;
    select.appendChild(option);
  });
}

async function loadFeed() {
  const reviews = await api('/api/reviews');
  const feed = document.getElementById('review-feed');
  feed.innerHTML = '';
  reviews.forEach((review) => {
    const li = document.createElement('li');
    li.textContent = `${review.username} על ${review.site} - ${review.product_name}: ${review.rating}/5 - ${review.body}`;
    feed.appendChild(li);
  });
}

document.getElementById('order-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = currentUsername();
  if (!username) {
    alert('נא להזין שם משתמש');
    return;
  }
  await api('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      username,
      site: document.getElementById('order-site').value,
      productName: document.getElementById('order-product').value,
      orderDate: document.getElementById('order-date').value,
      orderUrl: document.getElementById('order-url').value,
    }),
  });
  e.target.reset();
  await loadOrders();
});

document.getElementById('review-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = currentUsername();
  if (!username) {
    alert('נא להזין שם משתמש');
    return;
  }
  await api('/api/reviews', {
    method: 'POST',
    body: JSON.stringify({
      username,
      orderId: Number(document.getElementById('review-order').value),
      rating: Number(document.getElementById('review-rating').value),
      body: document.getElementById('review-body').value,
    }),
  });
  e.target.reset();
  await loadFeed();
});

document.getElementById('affiliate-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = currentUsername();
  if (!username) {
    alert('נא להזין שם משתמש');
    return;
  }
  try {
    const page = await api('/api/affiliate', {
      method: 'POST',
      body: JSON.stringify({
        username,
        slug: document.getElementById('affiliate-slug').value,
        headline: document.getElementById('affiliate-headline').value,
        isPaid: document.getElementById('affiliate-paid').checked,
      }),
    });
    document.getElementById('affiliate-result').textContent = `הדף שלכם: /affiliate/${page.slug}`;
  } catch (err) {
    document.getElementById('affiliate-result').textContent = `שגיאה: ${err.message}`;
  }
});

document.getElementById('refresh-feed').addEventListener('click', loadFeed);
usernameInput.addEventListener('change', loadOrders);

loadFeed();
