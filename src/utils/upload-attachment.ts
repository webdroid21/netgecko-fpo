import { compressImage } from 'src/utils/compress-image';

import axios from 'src/lib/axios';

// Airtable's uploadAttachment endpoint accepts files up to 5MB.
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
// Generous ceiling for slow field networks — an upload must never spin
// forever; the save button depends on this promise settling.
const UPLOAD_TIMEOUT_MS = 120_000;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses (for images) and uploads a file straight into an Airtable
 * attachment field via the server — no intermediate storage bucket.
 * `endpoint` is the record's API path, e.g. `/api/v1/farmers/rec123`.
 */
export async function uploadAttachment(
  endpoint: string,
  fieldName: string,
  file: File
): Promise<void> {
  const upload = await compressImage(file);
  if (upload.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`${upload.name} is too large — Airtable attachments are limited to 5 MB.`);
  }
  const base64 = await fileToBase64(upload);
  await axios.post(
    `${endpoint}/attachments`,
    {
      field: fieldName,
      filename: upload.name,
      contentType: upload.type || 'application/octet-stream',
      file: base64,
    },
    { timeout: UPLOAD_TIMEOUT_MS }
  );
}
