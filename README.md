# sellMyPorducts

A small web app that lets shoppers collect their orders from any site (Temu, Shein, etc.), write genuine reviews, share them with everyone in a collaborative feed, and optionally create their own affiliate page.

## Features

- **Orders** — log orders from any shopping site under your username.
- **Reviews** — write a real review for an order you made; only the order's owner can review it.
- **Shared feed** — every user's reviews show up in one collaborative feed (`GET /api/reviews`).
- **Affiliate pages** — create a public page (`/api/affiliate/:slug`) to share your reviews; pages can be marked as a paid/premium affiliate page.

## Getting started

```bash
npm install
npm start      # starts the server on http://localhost:3000
```

Open `http://localhost:3000` in a browser to use the UI, or call the JSON API directly:

| Method | Path                         | Description                              |
| ------ | ---------------------------- | ----------------------------------------- |
| POST   | `/api/users`                 | Create/fetch a user                       |
| POST   | `/api/orders`                | Add an order for a user                   |
| GET    | `/api/orders/:username`      | List a user's orders                      |
| POST   | `/api/reviews`                | Write a review for one of your orders     |
| GET    | `/api/reviews`                | Shared feed of all reviews                |
| POST   | `/api/affiliate`              | Create/update your affiliate page         |
| GET    | `/api/affiliate/:slug`        | View a public affiliate page              |

## Tests

```bash
npm test
```
