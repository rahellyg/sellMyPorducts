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

test('full flow: orders, reviews, shared feed, and affiliate pages', async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());

  // A user can register and add an order imported from any site.
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

  // Listing orders for that user returns what was added.
  const ordersList = await request(baseUrl, '/api/orders/dana');
  assert.equal(ordersList.status, 200);
  assert.equal(ordersList.body.length, 1);

  // The user can write a genuine review for their own order.
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

  // Another user cannot review someone else's order.
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

  // The shared/collaborative feed shows reviews from every user.
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

  // A user can create a paid affiliate page and view it publicly.
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

  // Slugs cannot be stolen by other users.
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
