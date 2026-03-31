export interface DocumentRecord {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: Date | string;
}

export interface UploadResponse {
  id?: string;
  documentId?: string;
  fileName: string;
  fileSize: number;
  uploadedAt: Date | string;
}

export function normalizeUploadedDocument(doc: UploadResponse): DocumentRecord {
  const id = doc.id ?? doc.documentId;

  if (!id) {
    throw new Error("Upload response did not include a document id.");
  }

  return {
    id,
    fileName: doc.fileName,
    fileSize: doc.fileSize,
    uploadedAt: doc.uploadedAt,
  };
}
