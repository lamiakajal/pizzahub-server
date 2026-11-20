# PizzaHub Server

REST API for PizzaHub, a pizza ordering and delivery platform. It serves the public menu, role protected APIs for customers, vendors and admins, and the Premium subscription flow.

- Live API: `https://your-pizzahub-api.vercel.app` (placeholder, replace after deployment)
- Server repo: https://github.com/lamiakajal/pizzahub-server
- Client repo: https://github.com/lamiakajal/pizzahub-client

## Features

- Public menu API with search, filters, sorting and pagination.
- JWT authentication with Better Auth keys, role checks on every protected route.
- Vendors: menu item management with a free plan limit of 3 active items, order handling.
- Customers: place, list and cancel orders.
- Admins: review menu items, manage and block users, read-only transactions, overview statistics.
- Premium subscription through Stripe, activated only by a verified webhook.
- Consistent JSON responses and error handling.

## Tech stack

- Node.js, Express 5, TypeScript
- MongoDB with Mongoose 9
- `jose` for JWT verification
- `stripe` for payments
- `cors`, `dotenv`
- `tsx` for development

## Getting started

Requirements: Node.js 20 or newer and a MongoDB Atlas database (the same one the client uses).

```bash
git clone https://github.com/lamiakajal/pizzahub-server.git
cd pizzahub-server
npm install
cp .env.example .env
```

Fill in `.env`, then run:

```bash
npm run dev
```

The API listens on `PORT` (default 5000). Check `GET /api/health`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start with automatic reload |
| `npm run build` | Compile TypeScript to `dist` |
| `npm run start` | Run the compiled server |

## Environment variables

Names only, never commit real values:

| Name | Purpose |
| --- | --- |
| `PORT` | Port to listen on |
| `NODE_ENV` | `development` or `production` |
| `MONGODB_URI` | MongoDB connection string |
| `CLIENT_URL` | Client origin allowed by CORS |
| `BETTER_AUTH_URL` | Client URL that serves the Better Auth JWKS |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the Stripe webhook endpoint |
| `STRIPE_PREMIUM_PRICE_ID` | Stripe price id of the Premium subscription |

## API overview

Every success response is `{ success: true, message?, data, meta? }`. Errors are `{ success: false, message }`. Lists include `meta: { page, limit, total, totalPages }`.

| Area | Routes | Access |
| --- | --- | --- |
| Health | `GET /api/health` | Public |
| Current user | `GET /api/me` | Signed in |
| Menu | `GET /api/menu-items`, `/filters`, `/:id` | Public |
| Vendor menu | `/api/vendor/menu-items` | Vendor |
| Vendor orders | `/api/vendor/orders` | Vendor |
| Customer orders | `/api/customer/orders` | Customer |
| Overviews | `/api/customer/overview`, `/api/vendor/overview` | Customer, vendor |
| Admin menu | `/api/admin/menu-items` | Admin |
| Admin users | `GET /api/admin/users`, `GET /api/admin/users/:id`, `PATCH /api/admin/users/:id/block` | Admin |
| Admin transactions | `GET /api/admin/transactions` (read only) | Admin |
| Admin overview | `GET /api/admin/overview` | Admin |

Admins cannot block other admins or themselves, and they cannot change payment records.

## Implementation notes for challenges

### 1. Advanced search and price sorting

`GET /api/menu-items` accepts these query parameters:

| Parameter | Effect |
| --- | --- |
| `search` | Case-insensitive match on item name or description (input is regex-escaped) |
| `category` | Exact category, validated against the allowed list |
| `location` | Case-insensitive exact match |
| `minPrice`, `maxPrice` | Inclusive price range |
| `sort` | `newest` (default), `price_asc`, `price_desc`, `featured` |
| `page`, `limit` | Pagination, default 9 and at most 24 per page |

The route builds a `$match` object (always `status: "approved"`) and passes it to the aggregation in `services/menuItemService.ts`:

1. `$match` applies the filters. Price becomes `{ $gte, $lte }`, search becomes a `$or` of two regexes.
2. `$lookup` joins the vendor from the `user` collection and `$unwind` flattens it. Items from blocked vendors are dropped on public lists.
3. `$addFields` computes `isPremium` from the vendor's plan and expiry date.
4. `$sort` uses one of the fixed sort specs: `price_asc` is `{ price: 1 }`, `price_desc` is `{ price: -1 }`, and `featured` is `{ isPremium: -1, createdAt: -1 }`. An `_id` tie breaker keeps pages stable.
5. `$facet` returns the page (`$skip`, `$limit`, `$project` of safe fields) and the total count in one round trip, which feeds `meta`.

### 2. JWT verification

1. The client app uses the Better Auth `jwt()` plugin. After sign in, `authClient.token()` returns a short-lived signed JWT.
2. The browser sends it as `Authorization: Bearer <token>`.
3. `middleware/authenticate.ts` verifies the signature and issuer with `jose` against the remote key set at `BETTER_AUTH_URL/api/auth/jwks`. Keys are cached and refetched when a new key id appears.
4. The user id from the token is used to load the user from MongoDB. Role, block status and plan always come from the database, never from the token.
5. Responses: `401` for a missing, invalid or expired token or a deleted user, `403` for a blocked account.
6. `middleware/authorize.ts` (`requireRole("admin")`, or several roles) returns `403` when the role does not match. Routes mount `authenticate` first and `requireRole` second.

## Project structure

```
src/app.ts          Express app and route mounting
src/config          Environment and database connection
src/middleware      authenticate, authorize, error handling
src/models          Mongoose models (User, MenuItem, Order, Transaction)
src/routes          One router per area
src/services        Reusable queries such as the menu aggregation
src/utils           Helpers: ApiError, respond, query, validators
```
