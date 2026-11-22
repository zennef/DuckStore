# Duck Store Platform

Online shop for rubber ducks. Two modules:
- **Warehouse** (frontend + backend): CRUD for duck inventory.
- **Store** (backend only): CRUD endpoints plus an order endpoint that computes packaging and total cost.

The original spec lives in `docs/spec.pdf`. This file records how we're interpreting and building it. If something here conflicts with the spec, flag it before changing either.

---

## Stack

| Layer    | Choice                                  |
|----------|-----------------------------------------|
| Frontend | React + TypeScript (Vite), React Router, TanStack Query |
| Styling  | Tailwind CSS                            |
| Backend  | NestJS + TypeScript                     |
| Database | MySQL 8 via Prisma                      |
| Testing  | Jest (unit + e2e on API), Vitest + Testing Library (web) |
| Local DB | Docker Compose                          |

**Why MySQL over MongoDB:** the spec models Duck with an integer `Id`, which maps to auto-increment for free. Mongo would need a counter collection to fake it.

## Repo layout

```
duck-store/
  apps/
    api/                 NestJS
      src/
        ducks/           Duck CRUD (controller, service, DTOs)
        store/
          orders/        Order endpoint
          packaging/     Package + protection logic
          pricing/       Pricing pipeline + rules
        prisma/
    web/                 React
      src/
        features/warehouse/
        components/
        api/
  docs/
    spec.pdf
  docker-compose.yml
  CLAUDE.md
```

npm workspaces at the root.

---

## Domain

```ts
enum Color { Red, Green, Yellow, Black }
enum Size  { XLarge, Large, Medium, Small, XSmall }

Duck {
  id: number        // auto-increment
  color: Color
  size: Size
  price: number     // DOUBLE, per spec, max 2 decimal places
  quantity: number
  deleted: boolean  // soft delete, default false
}
```

Price is stored as DOUBLE per the spec. DECIMAL is the usual choice for money, but we're following the requirement as written. To keep merge-on-add matching exact, prices must have at most 2 decimal places (validated with `@IsNumber({ maxDecimalPlaces: 2 })`), and all pricing math runs in integer cents.

---

## Warehouse module

### API (`/api/ducks`)
- `GET /api/ducks` returns non-deleted ducks as a plain array, sorted by quantity **descending** (matches the mockup), then id ascending as a tiebreak.
- `POST /api/ducks` adds a duck (see merge rule). Returns `{ duck, merged }`: **201** when it created a record, **200** when it merged into an existing one.
- `PATCH /api/ducks/:id` updates **price and quantity only**. Both optional, at least one required. Color and size in the body are rejected (400, via the global `ValidationPipe` with `whitelist` and `forbidNonWhitelisted`).
  - Quantity may be **0** on update (on create it must be 1+). An order can drain stock to 0 and the edit form must still save.
- `DELETE /api/ducks/:id` sets `deleted = true`. Never a physical delete. Returns **204**, or 404 if the duck is missing or already deleted.
- `PATCH` returns 200 with `{ duck, merged }` (see edit collision). A non-integer `:id` is a 400.

### Merge-on-add rule
If a non-deleted duck exists with the same color, size and price, add the new quantity to it and return it. Otherwise create a new record.
- Deleted ducks are **ignored** when matching (they stay as history).
- Response indicates whether it merged or created, so the UI can say so: `{ duck, merged }`.
- Runs in one transaction. If several non-deleted ducks match (see the race below), the lowest id wins.
- **Accepted race:** two concurrent adds of a combination that doesn't exist yet can both miss the lookup and create twins. A unique index could prevent duplicates: DOUBLE equality is reliable here because prices are capped at 2 decimal places, and a generated column that is NULL when deleted = true would let soft-deleted rows share values (MySQL allows multiple NULLs in a unique index). We chose not to because Prisma doesn't model generated columns, so it would need hand-written migration SQL for a rare edge case. Instead the race is accepted, and if two simultaneous adds create twins, the next edit of either one merges them.

### Edit collision
If editing a duck (A) would make it identical (color, size, price) to another non-deleted duck (B), **auto-merge**, mirroring the add rule:
- Add A's (edited) quantity to B.
- Soft-delete A so it stays in history. A keeps its pre-edit price and quantity, so history shows what it was before the merge.
- Return B, with a flag indicating a merge happened so the UI can say so: `{ duck: B, merged: true }`. A plain edit returns `{ duck: A, merged: false }`.
- Do all of this in one transaction. If several ducks qualify as B, the lowest id wins.
- Editing a missing or deleted duck is a 404.

### Frontend
- Layout per mockup: top bar "Duck Store Platform", sidebar (Warehouse, Store), page header "Duck Warehouse" with subtitle, "+ Add Duck" button top right, "Duck Inventory" card with table.
- Table columns: ID, Color, Size, Price (USD), Quantity, Actions (Edit, Delete).
- Add and Edit share one `DuckForm` component shown in a modal, with `mode: 'create' | 'edit'`. In edit mode, color and size are disabled.
- Delete shows a confirmation dialog (custom modal, not `window.confirm`).
- Store sidebar link goes to a simple placeholder page, since Store is backend only.

---

## Store module

### CRUD
`StoreModule` imports `DucksService`. No duplicated CRUD logic. Store exposes its own routes under `/api/store/ducks` (GET, POST, PATCH, DELETE) that delegate to the same service, so the Store module visibly has the CRUD endpoints the spec asks for.

### Order endpoint
`POST /api/store/orders`

Request:
```json
{ "color": "Green", "size": "Medium", "quantity": 150, "country": "USA", "shippingMode": "AIR" }
```

Response:
```json
{
  "packageType": "CARDBOARD",
  "protection": ["POLYSTYRENE_BALLS"],
  "lineItems": [
    { "label": "Base cost (150 x $15.00)", "amount": 2250.00 },
    { "label": "Volume discount (20%)",    "amount": -450.00 },
    { "label": "Cardboard discount (1%)",  "amount": -18.00 },
    { "label": "USA tax (18%)",            "amount": 320.76 },
    { "label": "Air shipping (150 x $30)", "amount": 4500.00 }
  ],
  "total": 6602.76
}
```

The response also includes `"duckId"` (the duck the order drew from).

### Which duck an order uses
Orders only give color and size, but several ducks can share those at different prices. Use the **lowest-priced** non-deleted match with enough quantity, lowest id as a tiebreak. Return 404 if no non-deleted duck has that color and size, 409 if none has enough stock. This is `DucksService.findCheapestMatch`.

### Stock
Placing an order **decrements** the chosen duck's quantity. (Interpretation call: the spec calls it an order, and a real order consumes stock.)
- Decrement atomically with a conditional update (`WHERE id = ? AND deleted = false AND quantity >= ?`), in `DucksService.decrementStock`. If zero rows update, another order (or a delete) got there first: return 409. Don't retry with another duck.
- Pricing is computed from the same duck record that was decremented.

---

## Packaging (Strategy + Factory)

**Package material** comes from size, via `PackageFactory`:

| Size             | Material  |
|------------------|-----------|
| XLarge, Large    | WOOD      |
| Medium           | CARDBOARD |
| Small, XSmall    | PLASTIC   |

**Protection** comes from a `ShippingStrategy` per mode. Each strategy implements:

```ts
interface ShippingStrategy {
  mode: ShippingMode;
  getProtection(material: PackageMaterial): Protection[];
  // The charge first, then any mode discount as its own line. Integer cents, never empty.
  getShippingLineItems(quantity: number): LineItem[];
}
```

Classes: `AirShipping`, `LandShipping`, `SeaShipping` in `packaging/strategies/`. The Air bulk discount (15% off the air cost when quantity > 1000) lives only in `AirShipping`, which then returns two lines: `Air shipping (N x $30)` at the full amount and `Air bulk discount (15%)` as a discount, rounded half-up via `percentOf`. `LineItem` lives in `store/line-item.ts` so packaging and pricing share it.

| Mode | Protection |
|------|------------|
| AIR  | Wood/Cardboard: polystyrene balls. Plastic: bubble wrap |
| LAND | Polystyrene balls |
| SEA  | Moisture-absorbing beads + bubble wrap |

`ShippingStrategyRegistry.get(mode)` looks strategies up in a map keyed by mode (it throws for an unregistered mode). Adding a mode means adding one class and registering it, not editing a switch.

## Pricing (Pipeline of rules)

Each rule is a small class:

```ts
interface PricingContext {
  quantity: number;
  unitPriceCents: number;
  material: PackageMaterial;
  country: string;            // raw input; CountryTaxRule normalizes it
  shipping: ShippingStrategy;
  runningTotalCents: number;  // sum of line items from earlier rules
}

interface LineItem {
  label: string;
  amountCents: number;        // signed: negative for discounts
  type: 'discount' | 'charge';
}

interface PricingRule {
  // One item, several items (shipping plus its discount), or null when the rule doesn't apply.
  apply(ctx: PricingContext): LineItem | LineItem[] | null;
}
```

Rule classes in `pricing/rules/`: `BaseCostRule`, `VolumeDiscountRule`, `PackageAdjustmentRule`, `CountryTaxRule`, `ShippingCostRule`. `ShippingCostRule` returns `ctx.shipping.getShippingLineItems(quantity)` as is and does no shipping math itself. Money helpers (`toCents`, `percentOf`, `formatUsd`) live in `pricing/money.ts`.

`PricingPipeline.run(input)` runs rules **in order**, each against the **running total**, skips rules that return null, and returns `{ lineItems, totalCents }`. `input` is a `PricingContext` without `runningTotalCents`; the pipeline starts it at 0.

Order:
1. Base: quantity x price
2. Volume discount: quantity **> 100** (101+), -20%
3. Package adjustment: wood +5%, plastic +10%, cardboard -1%
4. Country tax: USA 18%, Bolivia 13%, India 19%, other 15%
5. Shipping (flat, added after percentages, not taxed):
   - SEA: +$400
   - LAND: +$10 per unit
   - AIR: +$30 per unit, with 15% off the air cost if quantity **> 1000** (1001+)

**Interpretation calls:**
- Percentages compound on the running total in the order above.
- Shipping is not subject to the percentage rules.
- Thresholds are strict: "greater than" and "exceeds" both exclude the boundary value.
- Country matching is case-insensitive on a normalized code (`USA`, `BOLIVIA`, `INDIA`), after trimming whitespace.
- `US`, `U.S.`, `U.S.A.`, `USA.`, `United States` and `United States of America` are aliases for `USA` (same case-insensitive, trimmed matching). Bolivia and India match their exact names only. Anything else, such as `America`, is "other" (15%). (Mike, 2026-11-21.)
- The Air bulk discount is **its own line item**, right after the full air charge: `Air shipping (1001 x $30)` +$30,030.00, then `Air bulk discount (15%)` -$4,504.50. Shipping lines stay last and untaxed. (Mike, 2026-11-21; replaces the earlier single net line.)

### Money
- Compute in **integer cents** internally.
- Round each line item to the cent (half-up) so line items always sum exactly to the total.
- Half-up applies to the **magnitude**, so discounts round away from zero too: a 1% discount on $12,345.50 is -$123.46, not -$123.45. (Mike, 2026-11-21.)

### Worked examples (must have tests)
| Case | Expected total |
|------|----------------|
| 150 Medium @ $15, USA, AIR | $6,602.76 |
| 100 Large @ $20, Bolivia, LAND (no volume discount) | $3,373.00 |
| 101 Large @ $20, Bolivia, LAND (volume discount) | $2,927.38 |
| 1000 Small @ $10, India, AIR (no air discount) | $40,472.00 |
| 1001 Small @ $10, Mexico, AIR (15% off air) | $35,655.62 |
| 50 XSmall @ $8, "usa", SEA (lower-case country) | $919.20 |

All live in `pricing/pricing.pipeline.spec.ts`, along with an invariant check across 2,000+ orders that line items sum exactly to the total.

---

## Validation and errors
- DTOs use `class-validator` with enums for color, size, shipping mode.
- Price > 0, quantity a positive integer.
- Consistent error shape: `{ statusCode, message, error }` (Nest default).

## Testing priorities
1. Every pricing rule in isolation, plus pipeline worked examples.
2. Packaging: every size x mode combination.
3. Merge-on-add, merge-on-edit, soft delete, edit restrictions, order stock decrement and the oversell 409 (API e2e).
4. DuckForm create vs edit behavior (web).

API e2e tests run against a separate database: `TEST_DATABASE_URL` if set, otherwise `DATABASE_URL` with `_test` appended to the database name (`duck_store_test`). Jest's global setup creates it and applies migrations with `prisma migrate deploy`; each test truncates `ducks` first. Docker must be running.

---

## Working agreement
- Small, focused commits. One concern per commit.
- When introducing a design pattern, add a short comment on **why** it fits here.
- Don't change the interpretation calls without asking Mike.
- If a decision changes while building, update this file in the same commit.
- Don't add libraries beyond the stack above without asking.
- No em dashes in docs, comments or UI copy.
