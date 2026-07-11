/**
 * Build a Content-Disposition header for a download.
 *
 * HTTP header values are ByteStrings (Latin-1), so a non-ASCII filename —
 * Hebrew, in this app's case — throws when passed to the Headers constructor.
 * RFC 6266/5987 handles this: `filename` carries an ASCII-safe fallback and
 * `filename*` carries the real UTF-8 name percent-encoded. Clients prefer
 * `filename*` when both are present.
 */
export function contentDisposition(filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
