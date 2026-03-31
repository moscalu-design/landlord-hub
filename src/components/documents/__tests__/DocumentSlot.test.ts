import { describe, expect, it } from "vitest";
import { normalizeUploadedDocument } from "../documentRecord";

describe("normalizeUploadedDocument", () => {
  it("uses id when the upload response already matches the client shape", () => {
    expect(
      normalizeUploadedDocument({
        id: "doc-1",
        fileName: "passport.pdf",
        fileSize: 123,
        uploadedAt: "2026-03-31T00:00:00.000Z",
      })
    ).toEqual({
      id: "doc-1",
      fileName: "passport.pdf",
      fileSize: 123,
      uploadedAt: "2026-03-31T00:00:00.000Z",
    });
  });

  it("maps legacy documentId responses so delete/view still work immediately after upload", () => {
    expect(
      normalizeUploadedDocument({
        documentId: "doc-2",
        fileName: "contract.pdf",
        fileSize: 456,
        uploadedAt: "2026-03-31T00:00:00.000Z",
      })
    ).toEqual({
      id: "doc-2",
      fileName: "contract.pdf",
      fileSize: 456,
      uploadedAt: "2026-03-31T00:00:00.000Z",
    });
  });

  it("throws when the upload response does not contain any document identifier", () => {
    expect(() =>
      normalizeUploadedDocument({
        fileName: "salary.pdf",
        fileSize: 789,
        uploadedAt: "2026-03-31T00:00:00.000Z",
      })
    ).toThrow("Upload response did not include a document id.");
  });
});
