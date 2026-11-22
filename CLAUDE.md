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
- `GET /api/ducks` returns non-deleted ducks, sorted by quantity **descending** (matches the mockup).
- `POST /api/ducks` adds a duck (see merge rule).
- `PATCH /api/ducks/:id` updates **price and quantity only**. Color and size in the body are rejected.
- `DELETE /api/ducks/:id` sets `deleted = true`. Never a physical delete.

### Merge-on-add rule
If a non-deleted duck exists with the same color, size and price, add the new quantity to it and return it. Otherwise create a new record.
- Deleted ducks are **ignored** when matching (they stay as history).
- Response indicates whether it merged or created, so the UI can say so.

### Edit collision
If editing a duck (A) would make it identical (color, size, price) to another non-deleted duck (B), **auto-merge**, mirroring the add rule:
- Add A's (edited) quantity to B.
- Soft-delete A so it stays in history.
- Return B, with a flag indicating a merge happened so the UI can say so.
- Do all of this in one transaction.

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
Orders only give color and size, but several ducks can share those at different prices. Use the **lowest-priced** non-deleted match with enough quantity. Return 404 if no match exists, 409 if no match has enough stock.

### Stock
Placing an order **decrements** the chosen duck's quantity. (Interpretation call: the spec calls it an order, and a real order consumes stock.)
- Decrement atomically with a conditional update (`WHERE id = ? AND quantity >= ?`). If zero rows update, another order got there first: return 409.
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
  getShippingCost(quantity: number): number; // integer cents
  getShippingLabel(quantity: number): string; // line item label, mentions any mode discount
}
```

Classes: `AirShipping`, `LandShipping`, `SeaShipping` in `packaging/strategies/`. The Air bulk discount (15% off the air cost when quantity > 1000) lives only in `AirShipping`.

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
  apply(ctx: PricingContext): LineItem | null; // null = rule doesn't apply
}
```

Rule classes in `pricing/rules/`: `BaseCostRule`, `VolumeDiscountRule`, `PackageAdjustmentRule`, `CountryTaxRule`, `ShippingCostRule`. `ShippingCostRule` delegates to `ctx.shipping` for both amount and label and does no shipping math itself. Money helpers (`toCents`, `percentOf`, `formatUsd`) live in `pricing/money.ts`.

`PricingPipeline` runs rules **in order**, each against the **running total**, and collects line items.

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
- Country matching is case-insensitive on a normalized code (`USA`, `BOLIVIA`, `INDIA`), after trimming whitespace. Aliases like `US` or `United States` are "other" (15%).
- The Air bulk discount appears as **one net shipping line**, with the discount named in its label, e.g. `Air shipping (1001 x $30, 15% bulk discount)`. (Mike, 2026-11-21.)

### Money
- Compute in **integer cents** internally.
- Round each line item to the cent (half-up) so line items always sum exactly to the total.
- Half-up applies to the **magnitude**, so discounts round away from zero too: a 1% discount on $12,345.50 is -$123.46, not -$123.45. (Mike, 2026-11-21.)

### Worked examples (must have tests)
| Case | Expected total |
|------|----------------|
| 150 Medium @ $15, USA, AIR | $6,602.76 |
| Add more as we go, including boundaries at 100/101 and 1000/1001 | |

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

---

## Working agreement
- Small, focused commits. One concern per commit.
- When introducing a design pattern, add a short comment on **why** it fits here.
- Don't change the interpretation calls without asking Mike.
- If a decision changes while building, update this file in the same commit.
- Don't add libraries beyond the stack above without asking.
- No em dashes in docs, comments or UI copy.
