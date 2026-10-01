'use strict';

const { createDatabase } = require('./db');
const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;

const db = createDatabase();
const app = createApp(db);

app.listen(PORT, () => {
  console.log(`sellMyProducts server listening on port ${PORT}`);
});
