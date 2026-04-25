# AI Handoff

## App Stack

- Next.js 16.2 App Router with React 19 and Server Components/Server Actions.
- Prisma 7 generated client in `src/generated/prisma`, using the libSQL adapter.
- Database defaults come from environment variables. Local Playwright is forced to `file:<repo>/dev.db` in `playwright.config.ts` to avoid polluting configured remote databases.
- Auth is NextAuth v5 beta with Prisma-backed users in `src/lib/auth.ts`.
- File storage is abstracted by `src/lib/documentStorage.ts`: Vercel Blob when configured, local `.storage/` fallback in non-production or when `LOCAL_FILE_STORAGE_ENABLED=true`.
- Styling uses Tailwind CSS 4 utility classes and small local UI primitives under `src/components/ui`.
- Unit tests use Vitest. Browser tests use Playwright.

## Main Folders

- `src/app`: App Router pages and API route handlers.
- `src/actions`: Server actions for domain mutations.
- `src/components`: Feature components for layout, properties, rooms, tenants, payments, documents, and inventory.
- `src/lib`: Shared domain logic, validation, storage, reporting, Prisma client, and unit tests.
- `prisma`: Schema, migrations, and seed script.
- `e2e`: Playwright specs and shared helpers.
- `.storage`: Local fallback file storage. Do not commit uploaded runtime files.

## Domain Concepts

- Properties contain rooms and owner-side costs/expenses.
- Rooms belong to properties and may have current or past occupancies.
- Tenants are independent people records. Occupancies connect tenants to rooms for a lease period.
- Rent payments belong to an occupancy, not directly to a tenant or room.
- Deposits belong to an occupancy and are updated through deposit transactions.
- Room inventory items are the reusable inventory list for a room.
- Inventory inspections are check-in/check-out snapshots for an occupancy.
- Inspection photos are stored as `InventoryInspectionPhoto`; `inspectionItemId = null` means a general inspection photo, otherwise the photo is attached to a specific inspection item.
- Inspection PDFs are generated in `src/lib/inspectionReport.ts` and served by `src/app/api/inspections/[id]/report/route.ts`.
- Tenant documents, contracts, expense receipts, and inspection photos should be fetched through authenticated API routes, not directly from storage URLs.

## Local Commands

- `npm run dev`: start the app.
- `npm run build`: generate Prisma client and build Next.js.
- `npm run lint`: ESLint.
- `npm test`: Vitest unit tests.
- `npm run test:e2e`: Playwright suite.
- `E2E_ALLOW_DESTRUCTIVE=true npm run test:e2e -- e2e/<file>.spec.ts`: run mutation-heavy E2E locally.
- `npm run db:seed`: seed local data.
- `npm run db:studio`: Prisma Studio.

## Playwright Data Strategy

- Destructive/create tests must call `requireDestructive()`.
- Test entities should use `E2E_ENTITY_PREFIX`, defaulting to `E2E_TEST`.
- Local Playwright web server forces:
  - `DATABASE_URL=file:<repo>/dev.db`
  - `BLOB_READ_WRITE_TOKEN=`
  - `LOCAL_FILE_STORAGE_ENABLED=true`
- This keeps local E2E runs off any configured remote Turso/Vercel Blob resources.
- Cleanup should be best-effort in `finally` blocks and should use created URLs/IDs only.
- Cleanup must avoid broad deletes by name/prefix unless it is explicitly scoped to a local throwaway database.
- End active tenancies before deleting tenants.
- Archive properties after child-flow cleanup; archived properties are hidden from active lists.

## Deployment Notes

- `.vercel/` is present, and `README.md` includes a production smoke command against Vercel.
- Do not deploy automatically unless credentials/config are available and the repo workflow clearly expects it.
- Production storage should use Vercel Blob via `BLOB_READ_WRITE_TOKEN`.
- Keep secrets out of docs and commits.

## Known Limitations

- Inspection PDF generation embeds JPEG/PNG bytes through `pdf-lib`; unsupported formats show placeholders. Uploads are capped at 4 MB, but there is no server-side image resizing pipeline. A future improvement could add explicit image resizing/compression with tests around PDF size.
- Local UI cleanup helpers are mostly UI-driven. A direct database cleanup helper would be faster, but should only be introduced with a hard guard that refuses remote/non-file databases.
- Some older E2E data with an `E2E` prefix may exist in non-local environments from earlier runs. Do not bulk-delete it without explicit owner approval.
- The app uses string enums in SQLite/libSQL; validation lives in Zod and application code.

## Areas To Avoid Rewriting Casually

- Occupancy, rent payment, and deposit logic. These are cross-linked and covered by focused tests.
- Document storage routes. They intentionally hide internal storage URLs behind auth checks.
- Inventory inspection snapshots. They preserve historical item names even if the room inventory later changes.
- Next.js route handler signatures. This repo uses the local Next 16 convention where `params` is awaited.

## Recent Changes From This Pass

- Playwright local web server now forces local SQLite/libSQL file storage and local upload storage to avoid remote test pollution.
- Default E2E entity prefix changed to `E2E_TEST`.
- Inspection photo/PDF E2E cleanup now runs even if the test fails before upload/PDF assertions.
- Payment, utility, contextual navigation, inventory lifecycle, and room-page destructive specs now perform broader best-effort fixture cleanup.
- Inventory lifecycle mobile deposit assertion now waits for the deposit API response and refreshed value.
- Added this handoff document.
