// Upstream's gzip-magic check also handles hosts that inflate Content-Encoding: gzip.
// Keep JSON values lossless: Berlin's narrow passages need their existing precision.
export async function loadCompressedJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`City data request failed: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length) throw new Error('Empty city data.');
  const body = bytes[0] === 0x1f && bytes[1] === 0x8b
    ? new Response(bytes).body.pipeThrough(new DecompressionStream('gzip'))
    : bytes;
  const data = await new Response(body).json();
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid city data.');
  return data;
}
