`rentalapp` is a Next.js landlord portal for properties, rooms, tenants, payments, and document management.

## Getting Started

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Tests

Unit tests:

```bash
npm test
```

Playwright E2E:

```bash
npx playwright install chromium
npm run test:e2e
```

Production smoke against Vercel:

```bash
npm run test:e2e:prod
```

Available scripts:

- `npm run test:e2e`
- `npm run test:e2e:headed`
- `npm run test:e2e:prod`
- `npm run test:e2e:crud`
- `npm run test:e2e:properties`
- `npm run test:e2e:rooms`
- `npm run test:e2e:tenants`
- `npm run test:e2e:payments`
- `npm run test:e2e:files`
- `npm run test:e2e:utilities`
- `npm run test:e2e:smoke`
- `npm run test:e2e:room-navigation`
- `npm run test:e2e:auth-redirect`
- `npm run test:e2e:payment-flow`
- `npm run test:e2e:room-edit`
- `npm run test:e2e:assign-tenant`
- `npm run test:e2e:property-form`

Environment variables for E2E:

- `PLAYWRIGHT_BASE_URL`
- `E2E_TEST_EMAIL`
- `E2E_TEST_PASSWORD`
- `E2E_ALLOW_DESTRUCTIVE`
- `E2E_ENTITY_PREFIX`
- `E2E_UPLOAD_TENANT_ID`
- `E2E_OCCUPIED_ROOM_ID`
- `E2E_VACANT_ROOM_ID`
- `E2E_EDITABLE_PROPERTY_ID`
- `E2E_ENABLE_PROPERTY_CREATE`

If `PLAYWRIGHT_BASE_URL` is not set, Playwright starts a local dev server at `http://127.0.0.1:3000`. When `PLAYWRIGHT_BASE_URL` is set, tests run against that deployment directly.

The mutation-heavy flows use fixture-aware env vars when available. Set `E2E_ALLOW_DESTRUCTIVE=true` to enable create/archive style CRUD coverage, and set `E2E_ENABLE_PROPERTY_CREATE=true` only against a safe preview or staging dataset because it creates archived test properties.
