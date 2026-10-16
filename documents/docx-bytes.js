/** Encoding/validation utilities: never store whole DOCX content in JSONB. */
export function assertDocxBytes(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new Error('DOCX data must be a Uint8Array.');
  if (bytes.length < 100 || bytes.length > 3 * 1024 * 1024 || bytes[0] !== 0x50 || bytes[1] !== 0x4b)
    throw new Error('Invalid or oversized DOCX (maximum 3 MiB).');
  return bytes;
}
export function bytesToBase64(bytes) {
  assertDocxBytes(bytes);
  const chunks=[];
  for (let i=0;i<bytes.length;i+=12000) chunks.push(String.fromCharCode(...bytes.subarray(i,i+12000)));
  return btoa(chunks.join(''));
}
export function base64ToBytes(b64) {
  if (typeof b64 !== 'string' || b64.length > 4200000) throw new Error('Invalid DOCX encoding.');
  const data=atob(b64);
  const bytes=Uint8Array.from(data, c=>c.charCodeAt(0));
  return assertDocxBytes(bytes);
}
export function docxMetadata(id,bytes) {
  return {version:5,format:'docx',document_id:id,size_bytes:bytes.length};
}
