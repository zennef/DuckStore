# Duck Store Platform

An online shop for rubber ducks, built from the spec in `docs/spec.pdf`. It has two modules. **Warehouse** is a React page plus a REST API for managing duck inventory (add, edit price and quantity, soft delete). **Store** is backend only: it exposes the same duck CRUD under its own path, plus an order endpoint that picks a duck, works out the package and protection for the shipping mode, prices the order through a sequence of discount, tax and shipping rules, and takes the stock. The stack is NestJS, Prisma and MySQL 8 on the backend, and React, TanStack Query and Tailwind on the frontend.

## Quick start

You need Node 24 (see `.nvmrc`) and Docker.

```sh
cp apps/api/.env.example apps/api/.env
npm install
npm run db:setup
npm run dev
```

`db:setup` runs three steps you can also run on their own:

- `npm run db:up`: starts MySQL 8.4 with Docker Compose and waits until it is healthy.
- `npm run db:migrate`: applies the Prisma migrations (`prisma migrate dev`).
- `npm run db:seed`: inserts the 7 ducks from the spec mockup, with their mockup ids. It upserts by id, so it is safe to re-run.

`npm run dev` starts both apps. You can also start them one at a time with `npm run dev:api` and `npm run dev:web`.

| What      | URL                              |
| --------- | -------------------------------- |
| Warehouse | http://localhost:5173/warehouse  |
| API       | http://localhost:3000/api        |
| Health    | http://localhost:3000/api/health |

The Vite dev server proxies `/api` to port 3000, so the browser never needs CORS in development.

### Resetting the dev database

Deletes are soft, so deleted and merged-away ducks stay in the `ducks` table as history. To clear them out and start from the seed again:

```sh
npm run db:reset
```

This runs `prisma migrate reset --force`: it drops the dev database, reapplies every migration and reruns the seed. All dev data is lost. The e2e tests use a separate database (see below), so this never affects them, and they never affect your dev data.

`npm run db:down` stops and removes the MySQL container. The data lives in the `mysql-data` volume, so it survives that.

## Running tests

```sh
npm test                 # API unit tests (Jest) and web tests (Vitest)
npm run test:e2e         # API e2e tests (Jest + supertest), needs MySQL running
npm run format:check     # Prettier
npm run build            # both apps
```

The e2e tests run against their own database: `TEST_DATABASE_URL` if set, otherwise `DATABASE_URL` with `_test` appended (`duck_store_test`). Jest's global setup creates it and applies migrations with `prisma migrate deploy`, and each test truncates `ducks` first, so ids are predictable.

The web tests stub `fetch` per test (`apps/web/src/test/fetch.ts`, routes keyed by `"METHOD /path"`) rather than using MSW.

CI (`.github/workflows/ci.yml`) runs on pushes to `main` and on every pull request: `npm ci`, `format:check`, API unit tests, API e2e tests against a `mysql:8.4` service container (the same image as `docker-compose.yml`), web tests, and both builds.

What the tests cover, roughly in the order I cared about them:

1. Every pricing rule on its own, plus the six worked examples below and an invariant check across 2,000+ generated orders that the line items always sum exactly to the total.
2. Packaging for every size and shipping mode combination.
3. Merge on add, merge on edit, soft delete, edit restrictions, the stock decrement on order and the oversell 409, all end to end against MySQL.
4. The shared add/edit form in both modes, plus the table, delete dialog and toast feedback.

## Project structure

```
apps/
  api/                      NestJS
    prisma/                 schema, migrations, seed
    src/
      ducks/                Duck CRUD: service, DTOs, shared controller base
      store/
        orders/             Order endpoint
        packaging/          Package factory, shipping strategies and registry
        pricing/            Pricing pipeline, rules, money helpers
        store-ducks.controller.ts
      prisma/               PrismaService, conflict filter (P2034 to 409)
    test/                   e2e specs and test database setup
  web/                      React (Vite)
    src/
      api/                  Typed fetch client and TanStack Query hooks
      components/           Layout, Modal, Toast, icons
      features/warehouse/   Page, table, DuckForm, delete dialog, toast copy
      features/store/       Placeholder page listing the Store endpoints
      test/                 Render and fetch helpers, jsdom setup
docs/spec.pdf
docker-compose.yml
CLAUDE.md                   Running record of decisions and interpretation calls
```

npm workspaces at the root.

## API reference

All routes are under `/api`. Errors use Nest's default shape, `{ statusCode, message, error }`, where `message` is a string or an array of validation messages. Request bodies are validated with `class-validator`, and unknown fields are rejected with a 400.

A duck looks like this:

```json
{ "id": 6, "color": "Yellow", "size": "XLarge", "price": 25, "quantity": 5000, "deleted": false }
```

`color` is one of `Red`, `Green`, `Yellow`, `Black`. `size` is one of `XLarge`, `Large`, `Medium`, `Small`, `XSmall`.

### Ducks

The same handlers are served at `/api/ducks` (Warehouse) and `/api/store/ducks` (Store).

| Method | Path         | Body                                  | Result                                                                        |
| ------ | ------------ | ------------------------------------- | ----------------------------------------------------------------------------- |
| GET    | `/ducks`     |                                       | Non-deleted ducks, quantity descending, then id ascending                     |
| POST   | `/ducks`     | `{ color, size, price, quantity }`    | `{ duck, merged }`. 201 if created, 200 if merged into an existing duck       |
| PATCH  | `/ducks/:id` | `{ price?, quantity? }`, at least one | 200 `{ duck, merged }`. 404 if missing or deleted, 409 on a conflicting write |
| DELETE | `/ducks/:id` |                                       | 204. Soft delete. 404 if missing or already deleted                           |

Price must be greater than 0 with at most 2 decimal places. Quantity is a whole number, at least 1 on create and at least 0 on edit (an order can drain a duck to 0 and you still need to be able to edit it). Color and size can't be changed after creation; sending them in a PATCH is a 400.

### Orders

`POST /api/store/orders`

```json
{ "color": "Black", "size": "Medium", "quantity": 150, "country": "USA", "shippingMode": "AIR" }
```

`shippingMode` is `AIR`, `LAND` or `SEA`. `quantity` is a positive integer and `country` is any string that is non-empty after trimming.

Response (201):

<!-- prettier-ignore -->
```json
{
  "duckId": 4,
  "packageType": "CARDBOARD",
  "protection": ["POLYSTYRENE_BALLS"],
  "lineItems": [
    { "label": "Base cost (150 x $15.00)", "amount": 2250.00, "type": "charge" },
    { "label": "Volume discount (20%)",    "amount": -450.00, "type": "discount" },
    { "label": "Cardboard discount (1%)",  "amount": -18.00,  "type": "discount" },
    { "label": "USA tax (18%)",            "amount": 320.76,  "type": "charge" },
    { "label": "Air shipping (150 x $30)", "amount": 4500.00, "type": "charge" }
  ],
  "total": 6602.76
}
```

`duckId` is the duck the order drew stock from. Amounts are in dollars, like `total`. 404 if no non-deleted duck has that color and size, 409 if none has enough stock or another write got there first.

### Health

`GET /api/health` returns `{ "status": "ok", "database": "up" }` after a `SELECT 1`.

## Design patterns

I used a pattern where the spec's shape already matched one, and left the rest as plain code. Each of these has a short comment in the code on why it fits.

**Pipeline of pricing rules** (`store/pricing`). The spec's total is a fixed sequence of steps where each percentage applies to the total so far. Each step is a small `PricingRule` class (`BaseCostRule`, `VolumeDiscountRule`, `PackageAdjustmentRule`, `CountryTaxRule`, `ShippingCostRule`), and `PricingPipeline` runs them in order against a running total. A rule returns one line item, several, or null when it doesn't apply. This makes the compounding explicit, gives every step its own line item in the response, and lets me test each rule alone. Shipping runs last, so no percentage ever applies to it.

**Strategy for shipping modes** (`store/packaging/strategies`). `AirShipping`, `LandShipping` and `SeaShipping` each implement `ShippingStrategy`: which protection a package needs and what the shipping line items are. Mode-specific rules stay with their mode. The Air bulk discount, for example, lives only in `AirShipping`, which returns it as its own line right after the air charge.

**Registry instead of a switch** (`ShippingStrategyRegistry`). Strategies are looked up in a map keyed by mode, and an unregistered mode throws. Adding a mode means adding one class and registering it.

**Factory for package material** (`PackageFactory`). The order flow asks what package a size needs without knowing the size-to-material table, which lives in one place.

**Shared abstract controller** (`ducks/duck-crud.controller.ts`). The spec wants CRUD in both modules. Rather than duplicating handlers, `DucksController` and `StoreDucksController` both extend `DuckCrudController` and only declare their path, and both call the same `DucksService`. So the two paths can't drift apart in validation, status codes or response shape.

**Global exception filter for write conflicts** (`PrismaConflictFilter`). Prisma's P2034 (write conflict or deadlock) becomes a 409 "Conflicting update, please retry" everywhere, without wrapping each transaction.

On the frontend, `DuckForm` is one component with `mode: 'create' | 'edit'` for both dialogs, and `Modal` wraps the native `<dialog>` with `showModal()`, so focus trapping, Esc and the backdrop come from the browser.

## Interpretation calls

The spec leaves some things open. These are the calls I made, and they're also recorded in `CLAUDE.md`.

**DOUBLE, not DECIMAL, for price.** DECIMAL is the usual choice for money, but the spec says double, so I followed it. To keep that safe, prices are validated to at most 2 decimal places, which keeps the exact-equality match in merge on add reliable, and all pricing math runs in integer cents. Each line item is rounded to the cent half-up on the magnitude (so discounts round away from zero too), which means the line items always sum exactly to the total.

**Orders decrement stock.** The spec calls it an order, and a real order consumes stock. An order draws from one duck only: if no single matching duck has enough stock, it's a 409 rather than a split or partial fill.

**Which duck an order uses.** An order only gives color and size, but several ducks can share those at different prices. I use the cheapest non-deleted match that has enough stock, with the lowest id as a tiebreak.

**Merge on edit.** The spec merges an add into an existing duck with the same color, size and price. I apply the same rule to edits: if editing duck A's price makes it identical to duck B, A's quantity is added to B and A is soft-deleted. Otherwise you could end up with two rows that the add rule says should be one. The response says a merge happened, and the UI tells you.

**Soft-deleted rows are history.** Delete only sets `deleted = true`. Deleted rows never match a merge and never take orders. A duck merged away by an edit keeps its pre-edit price and quantity, so the history shows what it was before the merge.

**Country aliases.** Country matching is case-insensitive after trimming. `US`, `U.S.`, `U.S.A.`, `USA.`, `United States` and `United States of America` all count as `USA`. Bolivia and India match their names only. Anything else, including `America`, gets the "other" rate of 15%.

**Thresholds are strict, which creates a price cliff at 100 vs 101 units.** "More than 100" and "exceeds 1000" both exclude the boundary. Read literally, the 20% volume discount applies to the whole order once it reaches 101 units, so 101 ducks can cost less than 100: 100 Large at $20 to Bolivia by land is $3,373.00, and 101 is $2,927.38. I kept the spec's rule rather than inventing a tiered discount, and the worked examples pin both sides of the boundary.

The other pricing calls: percentages compound on the running total in the spec's order, and shipping is added after the percentages and isn't taxed.

| Case                                                | Total      |
| --------------------------------------------------- | ---------- |
| 150 Medium @ $15, USA, AIR                          | $6,602.76  |
| 100 Large @ $20, Bolivia, LAND (no volume discount) | $3,373.00  |
| 101 Large @ $20, Bolivia, LAND (volume discount)    | $2,927.38  |
| 1000 Small @ $10, India, AIR (no air discount)      | $40,472.00 |
| 1001 Small @ $10, Mexico, AIR (15% off air)         | $35,655.62 |
| 50 XSmall @ $8, "usa", SEA (lower-case country)     | $919.20    |

## Concurrency

Every write is either a single conditional statement or one transaction, and the cases where two requests can collide are handled explicitly.

**Row lock on edit.** An edit runs in one transaction that starts with `SELECT ... FOR UPDATE` on the duck being edited, then reads it, then either updates it or merges it into its twin. A concurrent order on the same duck waits for the lock and then applies to fresh data. Without the lock, an order landing between the edit's read and write could be overwritten, and the ordered units would reappear.

**Conditional decrement with a price check.** Placing an order finds the cheapest match, computes packaging and price (both pure, so nothing is written yet), then decrements with one conditional update: `WHERE id = ? AND price = ? AND deleted = false AND quantity >= ?`. If zero rows change, another order, an edit or a delete got there first, and the order is a 409 with nothing else changed. Two orders can't oversell, and because the price is in the `WHERE`, an order is never charged a price the duck no longer has. I don't retry with another duck, since that could silently change the price. Exact DOUBLE equality is safe here because the price is the stored value read back unchanged.

**Deadlocks become a 409.** Two simultaneous edits that move ducks onto each other's prices (A to B's price while B goes to A's) can deadlock, since each holds its own row lock and waits on the other's. MySQL rolls one back, and `PrismaConflictFilter` maps that to a 409. The web app keeps the dialog open with the message and your values, so you can resubmit.

**The accepted merge-on-add race.** Two concurrent adds of a color, size and price that doesn't exist yet can both miss the lookup and create twins. A unique index would prevent it, using a generated column that is NULL when `deleted = true` so soft-deleted rows can share values. I didn't do it because Prisma doesn't model generated columns, so it would mean hand-written migration SQL for a rare edge case. If twins do appear, the next edit of either one merges them, and orders handle twins fine because they pick the cheapest match with the lowest id.

## What I'd do next

- **Persist orders.** Right now an order decrements stock and returns its pricing, but nothing records it. An `orders` table with the line items would give an audit trail and make it possible to cancel or refund.
- **Close the merge-on-add race** with the generated column and unique index above, with the migration SQL written by hand.
- **An idempotency key on orders**, so a client retrying after a timeout can't place the same order twice.
- **A Store frontend.** The Store module is backend only per the spec, and the page is a placeholder listing the endpoints.
- **A history view** of soft-deleted and merged ducks, since the data is already kept.
- **Browser e2e tests** that run the web app against the real API. The web tests stub `fetch`, and the API e2e tests stop at HTTP.
- **Revisit the 100 vs 101 cliff** with whoever owns the pricing, if the spec can change. A discount that only applies to units past 100 would remove it.
- **OpenAPI docs** generated from the DTOs, instead of the hand-written reference above.
