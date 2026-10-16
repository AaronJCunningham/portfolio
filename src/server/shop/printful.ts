export class PrintfulError extends Error {
  constructor(public status: number) { super(`Printful request failed (${status})`) }
}

export async function printfulRequest<T>(path: string, body?: unknown): Promise<T> {
  if (!process.env.PRINTFUL_TOKEN) throw new Error('Printful is not configured')
  const response = await fetch(`https://api.printful.com${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PRINTFUL_TOKEN}`,
      'Content-Type': 'application/json',
      ...(process.env.PRINTFUL_STORE_ID ? {'X-PF-Store-Id': process.env.PRINTFUL_STORE_ID} : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  })
  if (!response.ok) throw new PrintfulError(response.status)
  const data = await response.json()
  if (data.code !== 200) throw new PrintfulError(data.code || 502)
  return data.result as T
}

export async function checkVariant(id: number) {
  // This endpoint returns the variant directly in result (not sync_variant).
  const variant = await printfulRequest<{id: number; variant_id: number; synced: boolean; is_ignored: boolean; availability_status?: string}>(`/store/variants/${id}`)
  if (!variant || variant.id !== id || !variant.synced || variant.is_ignored ||
    (variant.availability_status && variant.availability_status !== 'active')) {
    throw new Error('This product is not ready for fulfilment')
  }
  return variant
}
