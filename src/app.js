'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');

const SLUG_PATTERN = /^[a-z0-9-]{3,50}$/;

// Guard every API route against abuse/brute-force with a shared limiter.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

function getOrCreateUser(db, username) {
  if (typeof username !== 'string' || !username.trim()) {
    return null;
  }
  const name = username.trim();
  const existing = db.prepare('SELECT * FROM users WHERE username = ?').get(name);
  if (existing) return existing;
  const result = db.prepare('INSERT INTO users (username) VALUES (?)').run(name);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
}

/**
 * Builds the Express application. Each app instance is bound to a db
 * connection so tests can use isolated in-memory databases.
 * @param {import('better-sqlite3').Database} db
 */
function createApp(db) {
  const app = express();
  app.use(express.json());
  app.use(express.static(require('path').join(__dirname, '..', 'public')));
  app.use('/api', apiLimiter);

  // Create a user (or fetch the existing one) so every shopper can
  // participate without a heavyweight auth system.
  app.post('/api/users', (req, res) => {
    const user = getOrCreateUser(db, req.body && req.body.username);
    if (!user) {
      return res.status(400).json({ error: 'username is required' });
    }
    res.status(201).json(user);
  });

  // Add an order imported (manually, for now) from any shopping site,
  // e.g. Temu, Shein, etc.
  app.post('/api/orders', (req, res) => {
    const { username, site, productName, orderDate, orderUrl } = req.body || {};
    const user = getOrCreateUser(db, username);
    if (!user) {
      return res.status(400).json({ error: 'username is required' });
    }
    if (typeof site !== 'string' || !site.trim()) {
      return res.status(400).json({ error: 'site is required' });
    }
    if (typeof productName !== 'string' || !productName.trim()) {
      return res.status(400).json({ error: 'productName is required' });
    }

    const result = db
      .prepare(
        `INSERT INTO orders (user_id, site, product_name, order_date, order_url)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(user.id, site.trim(), productName.trim(), orderDate || null, orderUrl || null);

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(order);
  });

  // List every order a given user has logged, across all sites.
  app.get('/api/orders/:username', (req, res) => {
    const user = db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(req.params.username);
    if (!user) {
      return res.status(404).json({ error: 'user not found' });
    }
    const orders = db
      .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC')
      .all(user.id);
    res.json(orders);
  });

  // Write a genuine review for one of the user's own orders.
  app.post('/api/reviews', (req, res) => {
    const { username, orderId, rating, body } = req.body || {};
    const user = getOrCreateUser(db, username);
    if (!user) {
      return res.status(400).json({ error: 'username is required' });
    }
    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'rating must be an integer between 1 and 5' });
    }
    if (typeof body !== 'string' || !body.trim()) {
      return res.status(400).json({ error: 'body is required' });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({ error: 'order not found' });
    }
    if (order.user_id !== user.id) {
      return res.status(403).json({ error: 'you can only review your own orders' });
    }

    const result = db
      .prepare(
        `INSERT INTO reviews (order_id, user_id, rating, body) VALUES (?, ?, ?, ?)`
      )
      .run(order.id, user.id, ratingNum, body.trim());

    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(review);
  });

  // Shared, collaborative feed of every review from every user.
  app.get('/api/reviews', (req, res) => {
    const reviews = db
      .prepare(
        `SELECT reviews.id, reviews.rating, reviews.body, reviews.created_at,
                orders.site, orders.product_name, orders.order_url,
                users.username
         FROM reviews
         JOIN orders ON orders.id = reviews.order_id
         JOIN users ON users.id = reviews.user_id
         ORDER BY reviews.created_at DESC`
      )
      .all();
    res.json(reviews);
  });

  // Create (or update) an affiliate page for a user. Free users can create
  // a basic page; `isPaid` marks a premium affiliate page.
  app.post('/api/affiliate', (req, res) => {
    const { username, slug, headline, isPaid } = req.body || {};
    const user = getOrCreateUser(db, username);
    if (!user) {
      return res.status(400).json({ error: 'username is required' });
    }
    if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) {
      return res.status(400).json({
        error: 'slug is required and must be 3-50 lowercase letters, numbers or hyphens',
      });
    }

    const slugOwner = db.prepare('SELECT * FROM affiliate_pages WHERE slug = ?').get(slug);
    if (slugOwner && slugOwner.user_id !== user.id) {
      return res.status(409).json({ error: 'slug already taken' });
    }

    const paidFlag = isPaid ? 1 : 0;
    db.prepare(
      `INSERT INTO affiliate_pages (user_id, slug, headline, is_paid)
       VALUES (@user_id, @slug, @headline, @is_paid)
       ON CONFLICT(user_id) DO UPDATE SET
         slug = excluded.slug,
         headline = excluded.headline,
         is_paid = excluded.is_paid`
    ).run({ user_id: user.id, slug, headline: headline || null, is_paid: paidFlag });

    const page = db.prepare('SELECT * FROM affiliate_pages WHERE user_id = ?').get(user.id);
    res.status(201).json(page);
  });

  // Publicly view an affiliate page, including the owner's reviews.
  app.get('/api/affiliate/:slug', (req, res) => {
    const page = db
      .prepare('SELECT * FROM affiliate_pages WHERE slug = ?')
      .get(req.params.slug);
    if (!page) {
      return res.status(404).json({ error: 'affiliate page not found' });
    }
    const owner = db.prepare('SELECT * FROM users WHERE id = ?').get(page.user_id);
    const reviews = db
      .prepare(
        `SELECT reviews.id, reviews.rating, reviews.body, reviews.created_at,
                orders.site, orders.product_name, orders.order_url
         FROM reviews
         JOIN orders ON orders.id = reviews.order_id
         WHERE reviews.user_id = ?
         ORDER BY reviews.created_at DESC`
      )
      .all(page.user_id);
    res.json({ ...page, username: owner.username, reviews });
  });

  return app;
}

module.exports = { createApp, getOrCreateUser };
