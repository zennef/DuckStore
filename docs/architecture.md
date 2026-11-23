# Architecture

How the Duck Store is put together, as diagrams. The [README](../README.md) explains the decisions behind it (interpretation calls, concurrency, why each pattern), and `CLAUDE.md` is the running record of those decisions. This file shows the structure: which pieces exist, how they depend on each other, and what happens on the main requests.

The diagrams are Mermaid, so GitHub renders them in place. Class diagrams show the members that matter for the design, not every field, and async methods are shown with the type they resolve to.

- [System overview](#system-overview)
- [Backend](#backend)
  - [Modules](#modules)
  - [Request path and errors](#request-path-and-errors)
  - [Data model](#data-model)
  - [Duck CRUD](#duck-crud)
  - [Orders, packaging and pricing](#orders-packaging-and-pricing)
  - [Pricing pipeline](#pricing-pipeline)
  - [Adding a duck](#adding-a-duck)
  - [Editing a duck](#editing-a-duck)
  - [Placing an order](#placing-an-order)
- [Frontend](#frontend)
  - [Component tree](#component-tree)
  - [Data layer](#data-layer)
  - [Dialogs](#dialogs)
  - [Editing from the UI](#editing-from-the-ui)
- [Tests and CI](#tests-and-ci)
- [Where things live](#where-things-live)

## System overview

```mermaid
flowchart LR
  Browser["Browser"]
  Vite["Vite dev server<br/>localhost:5173<br/>serves the React app"]
  API["NestJS API<br/>localhost:3000/api"]
  DB[("MySQL 8.4<br/>Docker Compose<br/>duck_store")]
  TestDB[("duck_store_test<br/>e2e tests only")]
  Client["Any HTTP client<br/>e.g. curl"]

  Browser -->|"page and assets"| Vite
  Browser -->|"/api/* (same origin)"| Vite
  Vite -->|"proxies /api"| API
  Client -->|"/api/store/orders, /api/store/ducks"| API
  API -->|"Prisma"| DB
  API -.->|"Prisma, during e2e runs"| TestDB
```

The web app only talks to `/api/ducks`. The Store module has no frontend, so its routes (`/api/store/ducks` and `/api/store/orders`) are called directly. In development the Vite proxy keeps every browser call same-origin, so CORS never comes into play. `main.ts` also enables CORS for `WEB_ORIGIN` (default `http://localhost:5173`).

## Backend

### Modules

```mermaid
flowchart TD
  App["AppModule"]
  Config["ConfigModule<br/>global, reads apps/api/.env"]
  PrismaM["PrismaModule<br/>global"]
  Ducks["DucksModule"]
  Store["StoreModule"]

  App --> Config
  App --> PrismaM
  App --> Ducks
  App --> Store
  App --- Health["HealthController<br/>GET /api/health"]

  PrismaM --- PrismaS["PrismaService<br/>extends PrismaClient"]

  Ducks --- DC["DucksController<br/>/api/ducks"]
  Ducks --- DS["DucksService<br/>exported"]

  Store -->|"imports"| Ducks
  Store --- SDC["StoreDucksController<br/>/api/store/ducks"]
  Store --- OC["OrdersController<br/>/api/store/orders"]
  Store --- OS["OrdersService"]
  Store --- Reg["ShippingStrategyRegistry<br/>useFactory"]
  Store --- Pipe["PricingPipeline<br/>useFactory"]
```

`DucksModule` exports `DucksService`, and `StoreModule` imports it, so the Store's CRUD routes and the order flow use exactly the same duck logic as the Warehouse. `ShippingStrategyRegistry` and `PricingPipeline` are plain classes with default constructor arguments, so `StoreModule` builds them with `useFactory` instead of Nest's injector. Tests can still swap them with `overrideProvider`.

### Request path and errors

`configureApp` (in `app.setup.ts`) applies the same setup to the running API and to the e2e tests: the `/api` prefix, the global `ValidationPipe` and the global `PrismaConflictFilter`.

```mermaid
flowchart LR
  Req["HTTP request"] --> Prefix["/api prefix"]
  Prefix --> VP{"ValidationPipe<br/>DTO valid?<br/>no unknown fields?"}
  VP -->|"no"| E400["400<br/>message: string[]"]
  VP -->|"yes"| Ctrl["Controller"]
  Ctrl --> Svc["Service"]
  Svc --> Prisma["PrismaService"]
  Prisma --> MySQL[("MySQL")]

  Svc -.->|"NotFoundException"| E404["404"]
  Svc -.->|"ConflictException"| E409["409"]
  Prisma -.->|"P2034 write conflict or deadlock"| Filter["PrismaConflictFilter"]
  Filter --> E409b["409<br/>Conflicting update, please retry"]
  Prisma -.->|"any other Prisma error"| E500["500"]
```

Every error uses Nest's default shape, `{ statusCode, message, error }`. `ParseIntPipe` on `:id` turns a non-integer id into a 400 as well.

### Data model

```mermaid
erDiagram
  DUCK {
    int id PK "auto-increment"
    enum color "Red, Green, Yellow, Black"
    enum size "XLarge, Large, Medium, Small, XSmall"
    double price "greater than 0, at most 2 decimals"
    int quantity "1+ on create, 0+ on edit"
    boolean deleted "soft delete, default false"
  }
```

There is one table, `ducks`, with an index on `(color, size, price, deleted)` for the merge lookup. Rows are never physically deleted: `deleted = true` keeps them as history, and every read and match filters on `deleted = false`. Orders are not stored. Placing one only decrements a duck's `quantity`.

### Duck CRUD

```mermaid
classDiagram
  direction LR

  class DuckCrudController {
    <<abstract>>
    -ducks DucksService
    +findAll() Duck[]
    +create(dto CreateDuckDto) DuckWriteResult
    +update(id number, dto UpdateDuckDto) DuckWriteResult
    +remove(id number) void
  }
  class DucksController {
    @Controller ducks
  }
  class StoreDucksController {
    @Controller store/ducks
  }
  class DucksService {
    +findAll() Duck[]
    +create(dto) DuckWriteResult
    +update(id, dto) DuckWriteResult
    +remove(id) void
    +findCheapestMatch(color, size, quantity) Duck
    +decrementStock(duck, quantity) void
  }
  class PrismaService {
    <<PrismaClient>>
  }
  class CreateDuckDto {
    color Color
    size Size
    price number
    quantity number
  }
  class UpdateDuckDto {
    price? number
    quantity? number
  }
  class DuckWriteResult {
    duck Duck
    merged boolean
  }

  DuckCrudController <|-- DucksController
  DuckCrudController <|-- StoreDucksController
  DuckCrudController --> DucksService
  DuckCrudController ..> CreateDuckDto
  DuckCrudController ..> UpdateDuckDto
  DucksService ..> DuckWriteResult
  DucksService --> PrismaService
```

The handlers live once in `DuckCrudController`. Each subclass only adds `@Controller` with its path, so `/api/ducks` and `/api/store/ducks` can't drift apart in validation, status codes or response shape. `create` sets 201 or 200 from `merged`, and `remove` returns 204. `UpdateDuckDto` doesn't declare color or size, so the `ValidationPipe` rejects them, and a custom `HasAnyEditableField` validator requires at least one of price or quantity.

### Orders, packaging and pricing

```mermaid
classDiagram
  class OrdersController {
    +place(dto CreateOrderDto) OrderResult
  }
  class OrdersService {
    +place(dto CreateOrderDto) OrderResult
  }
  class DucksService {
    +findCheapestMatch(color, size, quantity) Duck
    +decrementStock(duck, quantity) void
  }
  class PackageFactory {
    +forSize(size Size)$ PackageMaterial
  }
  class ShippingStrategyRegistry {
    -strategies map keyed by mode
    +get(mode ShippingMode) ShippingStrategy
  }
  class ShippingStrategy {
    <<interface>>
    +mode ShippingMode
    +getProtection(material PackageMaterial) Protection[]
    +getShippingLineItems(quantity number) LineItem[]
  }
  class AirShipping {
    $30 per unit
    15% off air when quantity over 1000
  }
  class LandShipping {
    $10 per unit
  }
  class SeaShipping {
    flat $400
  }
  class PricingPipeline {
    -rules PricingRule[]
    +defaultRules()$ PricingRule[]
    +run(input PricingInput) PricingResult
  }

  OrdersController --> OrdersService
  OrdersService --> DucksService
  OrdersService ..> PackageFactory
  OrdersService --> ShippingStrategyRegistry
  OrdersService --> PricingPipeline
  ShippingStrategyRegistry o-- ShippingStrategy
  ShippingStrategy <|.. AirShipping
  ShippingStrategy <|.. LandShipping
  ShippingStrategy <|.. SeaShipping
```

- **Factory.** `PackageFactory.forSize` maps size to material: XLarge and Large get WOOD, Medium gets CARDBOARD, Small and XSmall get PLASTIC.
- **Strategy and registry.** Each `ShippingStrategy` owns its mode's protection and shipping lines, and the registry looks strategies up by mode in a map. Protection for AIR is polystyrene balls for wood and cardboard, and bubble wrap for plastic. LAND is always polystyrene balls. SEA is always moisture-absorbing beads plus bubble wrap.

### Pricing pipeline

```mermaid
classDiagram
  class PricingRule {
    <<interface>>
    +apply(ctx PricingContext) LineItem, LineItem[] or null
  }
  class PricingContext {
    quantity number
    unitPriceCents number
    material PackageMaterial
    country string
    shipping ShippingStrategy
    runningTotalCents number
  }
  class LineItem {
    label string
    amountCents number
    type discount or charge
  }
  class PricingPipeline {
    +run(input PricingInput) PricingResult
  }
  class PricingResult {
    lineItems LineItem[]
    totalCents number
  }

  PricingPipeline o-- PricingRule
  PricingPipeline ..> PricingResult
  PricingRule ..> PricingContext
  PricingRule ..> LineItem
  PricingRule <|.. BaseCostRule
  PricingRule <|.. VolumeDiscountRule
  PricingRule <|.. PackageAdjustmentRule
  PricingRule <|.. CountryTaxRule
  PricingRule <|.. ShippingCostRule
  ShippingCostRule ..> ShippingStrategy : getShippingLineItems
```

`run` starts the running total at 0, gives each rule the context plus the total so far, appends whatever line items the rule returns (skipping null), and adds them to the total. So `totalCents` is always exactly the sum of the line items. All amounts are integer cents, and `percentOf` rounds each percentage half-up on the magnitude.

```mermaid
flowchart LR
  Start(["running total = 0"]) --> Base
  Base["BaseCostRule<br/>+ quantity x unit price"] --> Vol
  Vol{"VolumeDiscountRule<br/>quantity over 100?"}
  Vol -->|"yes: -20% of total"| Pack
  Vol -->|"no: skipped"| Pack
  Pack["PackageAdjustmentRule<br/>wood +5%, plastic +10%,<br/>cardboard -1%"] --> Tax
  Tax["CountryTaxRule<br/>USA 18%, Bolivia 13%,<br/>India 19%, other 15%"] --> Ship
  Ship["ShippingCostRule<br/>strategy's lines, as is"] --> Done(["total = sum of line items"])
```

The percentages compound in this order. Shipping runs last, so no percentage ever applies to it. `CountryTaxRule` trims and upper-cases the country and maps aliases such as `US` and `United States` to `USA` before looking up the rate.

### Adding a duck

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant Ctl as DuckCrudController
  participant S as DucksService
  participant DB as MySQL

  C->>Ctl: POST /api/ducks { color, size, price, quantity }
  Ctl->>S: create(dto)
  S->>DB: BEGIN
  S->>DB: find first non-deleted duck with same color, size, price (lowest id)
  alt a match exists
    S->>DB: UPDATE quantity = quantity + dto.quantity
    S->>DB: COMMIT
    S-->>Ctl: { duck: match, merged: true }
    Ctl-->>C: 200 { duck, merged: true }
  else no match
    S->>DB: INSERT new duck
    S->>DB: COMMIT
    S-->>Ctl: { duck: new, merged: false }
    Ctl-->>C: 201 { duck, merged: false }
  end
```

Two concurrent adds of a combination that doesn't exist yet can both miss the lookup and insert twins. That race is accepted (see the README), and the next edit of either twin merges them.

### Editing a duck

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant S as DucksService
  participant DB as MySQL
  participant O as Concurrent order

  C->>S: PATCH /api/ducks/A { price?, quantity? }
  S->>DB: BEGIN
  S->>DB: SELECT id FROM ducks WHERE id = A AND deleted = false FOR UPDATE
  alt no row
    S-->>C: 404 Duck A not found
  end
  Note over S,DB: Row A is locked until COMMIT
  O->>DB: decrementStock(A) waits on the lock
  S->>DB: read A (current quantity)
  S->>DB: find twin B: other non-deleted duck, same color and size, new price (lowest id)
  alt twin B exists
    S->>DB: UPDATE A SET deleted = true (keeps pre-edit values)
    S->>DB: UPDATE B SET quantity = quantity + edited quantity
    S->>DB: COMMIT
    S-->>C: 200 { duck: B, merged: true }
  else no twin
    S->>DB: UPDATE A with only the fields sent
    S->>DB: COMMIT
    S-->>C: 200 { duck: A, merged: false }
  end
  DB-->>O: lock released, WHERE re-evaluated on fresh data
  Note over O: A merged away or price changed: 0 rows, 409
```

If two edits move ducks onto each other's prices at the same time, each holds its own row lock and waits on the other's. MySQL rolls one back, Prisma reports P2034, and `PrismaConflictFilter` turns it into a 409.

### Placing an order

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant OS as OrdersService
  participant DS as DucksService
  participant PF as PackageFactory
  participant R as ShippingStrategyRegistry
  participant P as PricingPipeline
  participant DB as MySQL

  C->>OS: POST /api/store/orders { color, size, quantity, country, shippingMode }
  OS->>DS: findCheapestMatch(color, size, quantity)
  DS->>DB: non-deleted ducks with this color and size
  alt none
    DS-->>C: 404 No Black Medium ducks found
  else none with enough stock
    DS-->>C: 409 Not enough Black Medium ducks in stock for Q
  end
  DS-->>OS: cheapest duck with enough stock (lowest id on a tie)

  Note over OS,P: Pure steps, nothing written yet
  OS->>PF: forSize(duck.size)
  PF-->>OS: material
  OS->>R: get(shippingMode)
  R-->>OS: strategy
  OS->>OS: protection = strategy.getProtection(material)
  OS->>P: run({ quantity, unitPriceCents, material, country, shipping })
  P-->>OS: { lineItems, totalCents }

  OS->>DS: decrementStock(duck, quantity)
  DS->>DB: UPDATE ... WHERE id = ? AND price = ? AND deleted = false AND quantity at least ?
  alt 0 rows updated
    DS-->>C: 409 Duck N changed or no longer has Q in stock, please retry
  else 1 row updated
    OS-->>C: 201 { duckId, packageType, protection, lineItems (dollars), total }
  end
```

Packaging and pricing are pure, so they run before the only write. If the conditional decrement loses a race to another order, an edit or a delete, the 409 is returned and nothing else has changed. The price in the `WHERE` means an order is never charged a price the duck no longer has.

## Frontend

### Component tree

```mermaid
flowchart TD
  Main["main.tsx<br/>StrictMode"] --> App
  App["App<br/>QueryClientProvider<br/>ToastProvider<br/>BrowserRouter"] --> Routes["AppRoutes"]
  Routes --> Layout["Layout<br/>top bar, sidebar, Outlet"]
  Layout -->|"/ redirects to /warehouse"| WP["WarehousePage"]
  Layout -->|"/store"| SP["StorePage<br/>lists the Store endpoints"]
  Layout -->|"anything else"| NF["NotFound"]

  WP --> Table["DuckTable<br/>rows, Edit and Delete buttons"]
  WP --> Form["DuckForm<br/>mode create or edit"]
  WP --> Del["DeleteDuckDialog"]
  Form --> Modal["Modal<br/>native dialog, showModal()"]
  Del --> Modal

  App -.- Toasts["Toast region<br/>aria-live, at most 3"]
  WP -.->|"useToast"| Toasts
```

Add and Edit share `DuckForm`. In edit mode color and size are disabled, and only the changed fields are sent. Validation (`duckFormValidation.ts`) mirrors the API's DTOs, and toast copy lives in `messages.ts`. `Modal` is mounted to open and unmounted to close, and on close it returns focus to its trigger, or to `focusFallback` (the "Duck Inventory" heading) if the trigger is gone.

### Data layer

```mermaid
flowchart LR
  subgraph Components
    WP["WarehousePage"]
    Form["DuckForm"]
    Del["DeleteDuckDialog"]
  end
  subgraph Hooks["api/ducks.ts (TanStack Query)"]
    Q["useDucks<br/>query key ducks"]
    MC["useCreateDuck"]
    MU["useUpdateDuck"]
    MD["useDeleteDuck"]
  end
  subgraph Client["api/client.ts"]
    API["ducksApi<br/>list, create, update, remove"]
    Err["ApiError<br/>status, messages[], error<br/>isNotFound, isConflict"]
  end

  WP --> Q
  Form --> MC
  Form --> MU
  Del --> MD
  Q --> API
  MC --> API
  MU --> API
  MD --> API
  API -->|"fetch /api/ducks"| Server["API"]
  API -.->|"non-2xx or unreachable"| Err
  MC -.->|"onSettled: invalidate ducks"| Q
  MU -.->|"onSettled: invalidate ducks"| Q
  MD -.->|"onSettled: invalidate ducks"| Q
```

Every mutation invalidates the ducks list when it settles, on success or failure, and returns the refetch promise. That keeps the mutation pending until the list has refreshed, so a deleted or merged row is already gone when its dialog closes. A failed call always throws `ApiError`: `messages` is always an array, a non-JSON body falls back to the status, and an unreachable server is `status: 0`.

### Dialogs

`WarehousePage` keeps at most one dialog open, as a single piece of state.

```mermaid
stateDiagram-v2
  [*] --> None
  None --> Add: Add Duck
  None --> Edit: Edit duck N
  None --> Delete: Delete duck N
  Add --> None: Cancel, Esc or saved (toast)
  Edit --> None: Cancel, Esc, saved or 404 (toast)
  Delete --> None: Cancel, Esc, deleted or 404 (toast)
  Edit --> Edit: invalid input, 400 or 409, inline
  Delete --> Delete: 409 or other error, inline
```

Esc and the backdrop are blocked while a request is pending, so a result is never dropped. Toasts are shown after the dialog closes, because a modal dialog's top layer would cover them.

### Editing from the UI

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant F as DuckForm
  participant M as useUpdateDuck
  participant Api as ducksApi
  participant S as API
  participant Q as useDucks
  participant WP as WarehousePage

  U->>F: change price or quantity, Save
  F->>F: validate, keep only changed fields
  alt nothing changed
    F-->>U: Nothing to save (no request)
  end
  F->>M: mutate({ id, input })
  M->>Api: update(id, input)
  Api->>S: PATCH /api/ducks/id
  S-->>Api: 200 { duck, merged }, or an error
  M->>Q: onSettled: invalidate, wait for GET /api/ducks
  Q->>S: GET /api/ducks
  S-->>Q: fresh list
  alt 200
    M-->>F: onSuccess
    F->>WP: onSaved(result)
    WP->>WP: close dialog, focus trigger or heading
    WP-->>U: toast "Duck 4 updated." or merge message
  else 404
    M-->>F: onError (isNotFound)
    F->>WP: onNotFound
    WP-->>U: close, toast "deleted or merged by someone else"
  else 409 or 400
    M-->>F: onError
    F-->>U: inline alert with server message, values kept
  end
```

## Tests and CI

```mermaid
flowchart LR
  subgraph Local["Local (npm scripts)"]
    Unit["npm test -w api<br/>Jest, src/**/*.spec.ts<br/>rules, pipeline, packaging,<br/>services with mocks"]
    E2E["npm run test:e2e<br/>Jest + supertest<br/>test/*.e2e-spec.ts"]
    Web["npm test -w web<br/>Vitest + Testing Library<br/>jsdom, stubbed fetch"]
  end
  E2E -->|"migrate deploy, truncate per test"| TestDB[("duck_store_test")]

  subgraph CI["GitHub Actions: push to main, every PR"]
    direction LR
    I["npm ci"] --> F["format:check"] --> CU["API unit"] --> CE["API e2e<br/>mysql:8.4 service"] --> CW["Web tests"] --> B["Build API and web"]
  end
```

The e2e tests boot the full Nest app through `createTestApp`, which uses the same `configureApp` as `main.ts`, so they exercise the real prefix, validation and error mapping. The web tests render with a no-retry query client, toasts and a memory router (`test/render.tsx`), and stub `fetch` per test (`test/fetch.ts`).

## Where things live

| Concern                           | File                                                                     |
| --------------------------------- | ------------------------------------------------------------------------ |
| Shared app setup                  | `apps/api/src/app.setup.ts`                                              |
| Duck CRUD routes                  | `apps/api/src/ducks/duck-crud.controller.ts`                             |
| Merge, edit lock, stock decrement | `apps/api/src/ducks/ducks.service.ts`                                    |
| Conflict and deadlock mapping     | `apps/api/src/prisma/prisma-conflict.filter.ts`                          |
| Order flow                        | `apps/api/src/store/orders/orders.service.ts`                            |
| Package material                  | `apps/api/src/store/packaging/package.factory.ts`                        |
| Shipping modes                    | `apps/api/src/store/packaging/strategies/`                               |
| Pricing rules and pipeline        | `apps/api/src/store/pricing/`                                            |
| Money helpers                     | `apps/api/src/store/pricing/money.ts`                                    |
| Schema and seed                   | `apps/api/prisma/schema.prisma`, `apps/api/prisma/seed.ts`               |
| Routes and providers              | `apps/web/src/App.tsx`                                                   |
| Fetch client and query hooks      | `apps/web/src/api/client.ts`, `apps/web/src/api/ducks.ts`                |
| Warehouse page and dialogs        | `apps/web/src/features/warehouse/`                                       |
| Modal and toasts                  | `apps/web/src/components/Modal.tsx`, `apps/web/src/components/Toast.tsx` |
