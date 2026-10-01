'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function createTemuImporter(db) {
  let browserContext = null;
  let page = null;
  let state = { status: 'idle', message: '' };

  function setState(status, message) {
    state = { status, message };
  }

  async function start(username) {
    if (!username || !username.trim()) {
      throw new Error('username is required');
    }
    if (page) {
      return { ...state, message: 'חלון Temu כבר פתוח. התחברו ופתחו את רשימת ההזמנות.' };
    }

    const profilePath = path.join(__dirname, '..', 'data', 'temu-browser-profile');
    fs.mkdirSync(profilePath, { recursive: true });

    try {
      browserContext = await chromium.launchPersistentContext(profilePath, {
        headless: false,
        viewport: { width: 1440, height: 1000 },
      });
      page = browserContext.pages()[0] || await browserContext.newPage();
      await page.goto('https://www.temu.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      setState('waiting', 'התחברו ב-Temu ופתחו את עמוד ההזמנות. לאחר מכן לחצו על ייבוא מוצרים.');
      return state;
    } catch (error) {
      page = null;
      if (browserContext) await browserContext.close().catch(() => {});
      browserContext = null;
      setState('error', 'לא ניתן לפתוח חלון דפדפן בסביבה הזו.');
      throw new Error(
        'לא ניתן לפתוח חלון דפדפן חזותי. הפעילו את השרת במחשב עם דפדפן גרפי, או השתמשו בייבוא קובץ.'
      );
    }
  }

  async function importProducts(username) {
    if (!page) {
      throw new Error('start Temu import first');
    }

    setState('reading', 'קורא את המוצרים שמופיעים בעמוד הנוכחי...');
    const products = await page.evaluate(() => {
      const clean = (value) => (value || '').replace(/\\s+/g, ' ').trim();
      const pricePattern = /(?:[$€£₪]|USD|ILS)\\s?\\d+(?:[.,]\\d{1,2})?/i;
      const links = Array.from(document.querySelectorAll('a[href]'));
      const candidates = links
        .map((link) => {
          const image = link.querySelector('img');
          const text = clean(link.innerText || link.getAttribute('aria-label'));
          const href = link.href;
          const price = (text.match(pricePattern) || [])[0] || null;
          const name = clean(image?.alt || text.replace(pricePattern, ''));
          return {
            name,
            price,
            productUrl: href,
            productImage: image?.src || image?.getAttribute('data-src') || null,
          };
        })
        .filter((item) => item.name && item.productUrl && item.productUrl.includes('temu.com'))
        .filter((item) => item.productUrl.includes('goods') || item.productUrl.includes('product'));

      return candidates.filter((item, index, all) =>
        all.findIndex((other) => other.productUrl === item.productUrl) === index
      );
    });

    const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
    if (!user) throw new Error('user not found');

    const insert = db.prepare(
      `INSERT INTO products (user_id, site, product_name, order_date, order_url, product_url, product_image, price)
       VALUES (?, 'Temu', ?, ?, ?, ?, ?, ?)`
    );
    const orderDate = new Date().toISOString().slice(0, 10);
    const saveProducts = db.transaction((items) => {
      let saved = 0;
      for (const item of items) {
        const price = item.price ? Number(item.price.replace(/[^0-9.,]/g, '').replace(',', '.')) : null;
        insert.run(user.id, item.name, orderDate, page.url(), item.productUrl, item.productImage, Number.isFinite(price) ? price : null);
        saved += 1;
      }
      return saved;
    });
    const saved = saveProducts(products);
    setState('done', `נשמרו ${saved} מוצרים. אפשר לסגור את חלון Temu.`);
    return { ...state, saved };
  }

  async function close() {
    if (browserContext) await browserContext.close().catch(() => {});
    browserContext = null;
    page = null;
    setState('idle', '');
  }

  return { start, importProducts, close, getState: () => state };
}

module.exports = { createTemuImporter };
