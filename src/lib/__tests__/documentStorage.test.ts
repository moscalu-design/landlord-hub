import { afterEach, describe, expect, it, vi } from "vitest";
import { readStoredDocument, storeDocument, deleteStoredDocument } from "../documentStorage";

describe("documentStorage local fallback", () => {
  const originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(async () => {
    process.env.BLOB_READ_WRITE_TOKEN = originalBlobToken;
    vi.stubEnv("NODE_ENV", originalNodeEnv);

    await deleteStoredDocument("local://tenant-documents/test-tenant/idDocument.pdf").catch(
      () => undefined
    );
  });

  it("stores, reads, replaces, and deletes a local document when blob storage is unavailable", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "";
    vi.stubEnv("NODE_ENV", "development");

    const first = await storeDocument(
      "tenant-documents/test-tenant/idDocument.pdf",
      Buffer.from("passport-v1"),
      "application/pdf"
    );

    expect(first.url).toBe("local://tenant-documents/test-tenant/idDocument.pdf");
    expect(String(await readStoredDocument(first.url))).toBe("passport-v1");

    const replacement = await storeDocument(
      "tenant-documents/test-tenant/idDocument.pdf",
      Buffer.from("passport-v2"),
      "application/pdf"
    );

    expect(replacement.url).toBe(first.url);
    expect(String(await readStoredDocument(replacement.url))).toBe("passport-v2");

    await deleteStoredDocument(replacement.url);

    await expect(readStoredDocument(replacement.url)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
