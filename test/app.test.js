'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { createDatabase } = require('../src/db');
const { createApp } = require('../src/app');

function startServer() {
  const db = createDatabase(':memory:');
  const app = createApp(db);
  const server = http.createServer(app);
  return new Promise((resolve) => {
    server.listen(0, () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function request(baseUrl, path, options) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => undefined);
  return { status: res.status, body };
}

test('product flow: list saved products and review one at a time', async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());

  const productRes = await request(baseUrl, '/api/products', {
    method: 'POST',
    body: JSON.stringify({
      username: 'dana',
      site: 'Temu',
      productName: 'Wireless earbuds',
      price: 39.99,
      productImage: 'https://example.com/earbuds.jpg',
      productUrl: 'https://example.com/earbuds',
    }),
  });
  assert.equal(productRes.status, 201);
  assert.equal(productRes.body.product_name, 'Wireless earbuds');

  const productsList = await request(baseUrl, '/api/products/dana');
  assert.equal(productsList.status, 200);
  assert.equal(productsList.body.length, 1);
  assert.equal(productsList.body[0].site, 'Temu');
  assert.equal(productsList.body[0].price, 39.99);

  const reviewRes = await request(baseUrl, '/api/reviews', {
    method: 'POST',
    body: JSON.stringify({
      username: 'dana',
      productId: productRes.body.id,
      rating: 5,
      body: 'Great sound quality!',
    }),
  });
  assert.equal(reviewRes.status, 201);

  const feed = await request(baseUrl, '/api/reviews');
  assert.equal(feed.status, 200);
  assert.equal(feed.body[0].product_name, 'Wireless earbuds');

  const productWithRating = await request(baseUrl, '/api/products/dana');
  assert.equal(productWithRating.body[0].rating, 5);
});

test('full flow: orders, reviews, shared feed, and affiliate pages', async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());

  const orderRes = await request(baseUrl, '/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      username: 'dana',
      site: 'Temu',
      productName: 'Wireless earbuds',
    }),
  });
  assert.equal(orderRes.status, 201);
  assert.equal(orderRes.body.site, 'Temu');

  const ordersList = await request(baseUrl, '/api/orders/dana');
  assert.equal(ordersList.status, 200);
  assert.equal(ordersList.body.length, 1);

  const reviewRes = await request(baseUrl, '/api/reviews', {
    method: 'POST',
    body: JSON.stringify({
      username: 'dana',
      orderId: orderRes.body.id,
      rating: 5,
      body: 'Great sound quality, arrived fast!',
    }),
  });
  assert.equal(reviewRes.status, 201);

  const otherUserOrder = await request(baseUrl, '/api/orders', {
    method: 'POST',
    body: JSON.stringify({ username: 'yossi', site: 'Shein', productName: 'T-shirt' }),
  });
  const forbiddenReview = await request(baseUrl, '/api/reviews', {
    method: 'POST',
    body: JSON.stringify({
      username: 'dana',
      orderId: otherUserOrder.body.id,
      rating: 3,
      body: 'Not mine',
    }),
  });
  assert.equal(forbiddenReview.status, 403);

  await request(baseUrl, '/api/reviews', {
    method: 'POST',
    body: JSON.stringify({
      username: 'yossi',
      orderId: otherUserOrder.body.id,
      rating: 4,
      body: 'Comfortable shirt',
    }),
  });
  const feed = await request(baseUrl, '/api/reviews');
  assert.equal(feed.status, 200);
  assert.equal(feed.body.length, 2);
  const usernames = feed.body.map((r) => r.username).sort();
  assert.deepEqual(usernames, ['dana', 'yossi']);

  const affiliateRes = await request(baseUrl, '/api/affiliate', {
    method: 'POST',
    body: JSON.stringify({
      username: 'dana',
      slug: 'dana-reviews',
      headline: 'Honest Temu & Shein reviews',
      isPaid: true,
    }),
  });
  assert.equal(affiliateRes.status, 201);
  assert.equal(affiliateRes.body.is_paid, 1);

  const publicPage = await request(baseUrl, '/api/affiliate/dana-reviews');
  assert.equal(publicPage.status, 200);
  assert.equal(publicPage.body.username, 'dana');
  assert.equal(publicPage.body.reviews.length, 1);

  const slugConflict = await request(baseUrl, '/api/affiliate', {
    method: 'POST',
    body: JSON.stringify({ username: 'yossi', slug: 'dana-reviews' }),
  });
  assert.equal(slugConflict.status, 409);
});

test('validation errors are returned for malformed input', async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());

  const missingUsername = await request(baseUrl, '/api/orders', {
    method: 'POST',
    body: JSON.stringify({ site: 'Temu', productName: 'x' }),
  });
  assert.equal(missingUsername.status, 400);

  const badRating = await request(baseUrl, '/api/reviews', {
    method: 'POST',
    body: JSON.stringify({ username: 'a', orderId: 1, rating: 9, body: 'x' }),
  });
  assert.equal(badRating.status, 400);

  const badSlug = await request(baseUrl, '/api/affiliate', {
    method: 'POST',
    body: JSON.stringify({ username: 'a', slug: 'AB' }),
  });
  assert.equal(badSlug.status, 400);
});
