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
  price: Decimal    // DECIMAL(10,2), not float
  quantity: number
  deleted: boolean  // soft delete, default false
}
```

Spec says `Price: Double`. We store DECIMAL to avoid float equality bugs in the merge-on-add check.

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
If editing a duck's price would make it identical (color, size, price) to another non-deleted duck: **reject with 409** and a clear message. **[CONFIRM]** Alternative is to merge them automatically.

### Frontend
- Layout per mockup: top bar "Duck Store Platform", sidebar (Warehouse, Store), page header "Duck Warehouse" with subtitle, "+ Add Duck" button top right, "Duck Inventory" card with table.
- Table columns: ID, Color, Size, Price (USD), Quantity, Actions (Edit, Delete).
- Add and Edit share one `DuckForm` component shown in a modal, with `mode: 'create' | 'edit'`. In edit mode, color and size are disabled.
- Delete shows a confirmation dialog (custom modal, not `window.confirm`).
- Store sidebar link goes to a simple placeholder page, since Store is backend only.

---

## Store module

### CRUD
`StoreModule` imports `DucksService`. No duplicated CRUD logic. **[CONFIRM]** Whether to also expose `/api/store/ducks` routes that delegate to the same service, in case reviewers expect Store to have its own CRUD endpoints.

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

### Which duck an order uses **[CONFIRM]**
Orders only give color and size, but several ducks can share those at different prices. Default: use the **lowest-priced** non-deleted match with enough quantity. Return 404 if no match, 409 if not enough stock.

### Stock **[CONFIRM]**
Default: the endpoint validates stock but **does not decrement it**. It behaves as a quote. Spec doesn't mention inventory changes.

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
  getShippingCost(quantity: number): Money;
}
```

| Mode | Protection |
|------|------------|
| AIR  | Wood/Cardboard: polystyrene balls. Plastic: bubble wrap |
| LAND | Polystyrene balls |
| SEA  | Moisture-absorbing beads + bubble wrap |

Strategies are registered in a map keyed by mode. Adding a mode means adding one class, not editing a switch.

## Pricing (Pipeline of rules)

Each rule is a small class:

```ts
interface PricingRule {
  apply(ctx: PricingContext): LineItem | null; // null = rule doesn't apply
}
```

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
- Percentages compound on the running total in the order above. **[CONFIRM]**
- Shipping is not subject to the percentage rules.
- Thresholds are strict: "greater than" and "exceeds" both exclude the boundary value.
- Country matching is case-insensitive on a normalized code (`USA`, `BOLIVIA`, `INDIA`).

### Money
- Compute in **integer cents** internally.
- Round each line item to the cent (half-up) so line items always sum exactly to the total.

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
3. Merge-on-add, soft delete, edit restrictions (API e2e).
4. DuckForm create vs edit behavior (web).

---

## Working agreement
- Small, focused commits. One concern per commit.
- When introducing a design pattern, add a short comment on **why** it fits here.
- Don't change anything marked **[CONFIRM]** or the interpretation calls without asking Mike.
- Don't add libraries beyond the stack above without asking.
- No em dashes in docs, comments or UI copy.
