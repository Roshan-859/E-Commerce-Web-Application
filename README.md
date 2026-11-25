# E-Commerce Web Application

Atelier is a small full-stack store demo with a responsive storefront, shopping bag, checkout, role-based sign-in, inventory management, and order tracking.

## Run it

Requires Node.js 20 or newer. No package installation is needed.

```sh
npm start
```

Open [http://localhost:3000](http://localhost:3000). The server creates `data/store.json` on first launch and saves products, stock, and orders there. This local JSON store keeps setup simple; it can be swapped for MySQL, PostgreSQL, or MongoDB for a hosted application.

## Demo accounts

- Customer: `hello@example.com` / `shop1234`
- Store admin: `admin@atelier.shop` / `admin123`

Use the customer account to check out and track an order. Use the admin account to add or remove products and update order statuses. New customer registration and payment processing are not enabled in this demo; checkout records a local order without collecting payment details.

## Included

- Product catalog with category filters and sorting
- Cart with quantity controls and stock checks
- Checkout and persisted order tracking
- Customer and admin sessions with role checks
- Admin product and order management
- Responsive layout and seeded sample catalog

This project is intended for local learning and demos. For public deployment, add a production database, HTTPS, CSRF protection, rate limiting, and a payment provider.
