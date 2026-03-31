export const E2E_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
export const E2E_TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "admin@landlord.com";
export const E2E_TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "admin123";
export const E2E_UPLOAD_TENANT_ID = process.env.E2E_UPLOAD_TENANT_ID ?? "";
export const E2E_OCCUPIED_ROOM_ID = process.env.E2E_OCCUPIED_ROOM_ID ?? "";
export const E2E_VACANT_ROOM_ID = process.env.E2E_VACANT_ROOM_ID ?? "";
export const E2E_EDITABLE_PROPERTY_ID = process.env.E2E_EDITABLE_PROPERTY_ID ?? "";
export const E2E_ENABLE_PROPERTY_CREATE = process.env.E2E_ENABLE_PROPERTY_CREATE === "true";
