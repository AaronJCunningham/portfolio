const fs = require('node:fs')
const path = require('node:path')
const {randomBytes} = require('node:crypto')

// Use the same TypeScript catalog and configuration as the storefront.
function loadShop() {
  const ts = require('typescript')
  require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true},
  }).outputText, filename)
  return {
    ...require('../src/server/shop/config.ts'),
    ...require('../src/server/shop/printful.ts'),
    ...require('../src/components/shop/products.ts'),
  }
}

// Append missing settings only; retain unrelated settings, comments and keys.
// Generate local signing secrets only when absent/blank. Never rotate a secret.
function prepareEnv(existing, example, generate = () => randomBytes(32).toString('hex')) {
  let result = existing
  const added = [], generated = []
  for (const line of example.split(/\r?\n/)) {
    const entry = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/)
    if (!entry) continue
    const [, key, fallback] = entry
    const pattern = new RegExp(`^(?:export\\s+)?${key}\\s*=([^\\r\\n]*)`, 'm')
    const current = result.match(pattern)
    const blank = current && /^(?:\s*|\s*(?:""|'')\s*)(?:#.*)?$/.test(current[1])
    const secret = ['SHOP_QUOTE_SECRET', 'PRINTFUL_WEBHOOK_SECRET'].includes(key)
    if (current && !(secret && blank)) continue
    const value = secret ? generate() : fallback
    if (current) result = result.replace(pattern, () => `${key}=${value}`)
    else {
      if (result && !result.endsWith('\n')) result += '\n'
      result += `${key}=${value}\n`
      added.push(key)
    }
    if (secret) generated.push(key)
  }
  return {text: result, added, generated}
}

function inspectConfig(env, products, variantKey) {
  const issues = []
  if (!/^(sk|rk)_(test|live)_.+/.test(env.STRIPE_SECRET_KEY || '')) issues.push('STRIPE_SECRET_KEY: add a Stripe test secret key.')
  if (!/^whsec_.+/.test(env.STRIPE_WEBHOOK_SECRET || '')) issues.push('STRIPE_WEBHOOK_SECRET: add the endpoint or CLI signing secret.')
  if (!env.PRINTFUL_TOKEN) issues.push('PRINTFUL_TOKEN: add a private token for your Manual order / API store.')
  if (env.PRINTFUL_STORE_ID && !/^[1-9]\d*$/.test(env.PRINTFUL_STORE_ID)) issues.push('PRINTFUL_STORE_ID: use a numeric store ID.')
  if ((env.SHOP_QUOTE_SECRET || '').length < 32) issues.push('SHOP_QUOTE_SECRET: run npm run shop:prepare to generate a local secret, or set at least 32 random characters.')
  if (env.SHOP_TAX_MODE !== 'automatic') issues.push('SHOP_TAX_MODE: set automatic and configure Stripe Tax.')
  let origin
  try {
    const url = new URL(env.SHOP_ORIGIN)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error()
    origin = url.origin
  } catch { issues.push('SHOP_ORIGIN: set an exact http(s) origin, with no path, credentials or query.') }
  if (/^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY || '')) {
    if (!origin?.startsWith('https://')) issues.push('Live checkout requires an HTTPS SHOP_ORIGIN.')
    if (env.SHOP_LIVE_READY !== 'true') issues.push('Live checkout remains locked by SHOP_LIVE_READY (leave locked until connected tests pass).')
  }
  const mappings = products.flatMap(product => product.sizes.map(size => {
    const key = variantKey(product.id, size), id = Number(env[key])
    const valid = Number.isSafeInteger(id) && id > 0
    if (!valid) issues.push(`${key}: choose the decorated Printful sync variant for ${product.name}, ${size}.`)
    return {product: product.name, size, key, id: valid ? id : null}
  }))
  const used = new Set()
  for (const row of mappings) {
    if (row.id && used.has(row.id)) issues.push(`${row.key}: sync variant is used by another size/product; check the mapping.`)
    if (row.id) used.add(row.id)
  }
  return {issues, mappings, origin}
}

async function listVariants(request) {
  const rows = []
  for (let offset = 0; ; offset += 100) {
    const products = await request(`/store/products?limit=100&offset=${offset}`)
    if (!Array.isArray(products)) throw Error('Unexpected Printful product response.')
    for (const product of products) {
      const detail = await request(`/store/products/${product.id}`)
      for (const variant of detail.sync_variants || []) rows.push({
        product: product.name, variant: variant.name, size: variant.size || '', color: variant.color || '',
        syncVariantId: variant.id, catalogVariantId: variant.variant_id,
        ready: !!variant.synced && !variant.is_ignored && (!variant.availability_status || variant.availability_status === 'active'),
      })
    }
    if (products.length < 100) return rows
  }
}

async function main() {
  const root = path.resolve(__dirname, '..')
  const [command, ...flags] = process.argv.slice(2)
  if (!['prepare', 'check', 'variants'].includes(command) || flags.some(flag => flag !== '--remote') || (flags.length && command !== 'check')) {
    throw Error('Use npm run shop:prepare, npm run shop:check [-- --remote], or npm run shop:variants.')
  }
  if (command === 'prepare') {
    const filename = path.join(root, '.env.local')
    const existing = fs.existsSync(filename) ? fs.readFileSync(filename, 'utf8') : ''
    const prepared = prepareEnv(existing, fs.readFileSync(path.join(root, '.env.example'), 'utf8'))
    if (prepared.text !== existing) fs.writeFileSync(filename, prepared.text, {mode: 0o600})
    console.log(`Local settings prepared: ${prepared.added.length} added, ${prepared.generated.length} secrets generated. Existing settings preserved; secret values are not displayed.`)
    console.log('No accounts connected. Restart the dev server after editing settings. Run npm run shop:check to see remaining setup.')
    return
  }
  // Match next dev's environment precedence; never print environment contents.
  require('@next/env').loadEnvConfig(root, process.env.NODE_ENV !== 'production', {info() {}, error() {}})
  const shop = loadShop()
  if (command === 'variants') {
    if (!process.env.PRINTFUL_TOKEN) throw Error('Add PRINTFUL_TOKEN first. No request was sent.')
    console.table(await listVariants(shop.printfulRequest))
    console.log('Copy syncVariantId into the matching PRINTFUL_* setting. Check product, artwork, color and size; IDs are never assigned automatically.')
    return
  }
  const report = inspectConfig(process.env, shop.products, shop.variantKey)
  console.log(`Checkout: ${process.env.SHOP_CHECKOUT_ENABLED === 'true' ? 'connected mode requested' : 'offline preview; payments disabled'}`)
  console.log(`Product mappings: ${report.mappings.filter(row => row.id).length}/${report.mappings.length}`)
  if (report.issues.length) {
    console.log('\nRemaining configuration:')
    for (const issue of report.issues) console.log(`- ${issue}`)
  } else console.log('Local configuration is complete. Provider credentials and fulfillment still require connected verification.')
  if (report.origin) console.log(`\nStripe webhook: ${report.origin}/api/shop/webhook`)
  console.log('Events: checkout.session.completed, checkout.session.async_payment_succeeded')
  console.log(`Endpoint API version: ${require('stripe').API_VERSION}`)
  console.log('Printful orders stay uncharged drafts until you approve production in Printful.')
  if (process.env.SHOP_EMAIL_ENABLED !== 'true') console.log('Custom shipping emails: disabled (optional Resend setup in docs/checkout.md).')
  if (flags.includes('--remote')) {
    if (report.issues.length) throw Error('Complete the listed settings before remote checks. No provider requests were sent.')
    console.log('\nChecking providers with read-only requests…')
    const stripe = require('../src/server/shop/stripe.ts').stripeClient()
    const account = await stripe.accounts.retrieve()
    const tax = await stripe.tax.settings.retrieve()
    console.log(`Stripe account accessible; charges enabled: ${account.charges_enabled}; Tax settings: ${tax.status}.`)
    if (tax.status !== 'active') report.issues.push('Finish Stripe Tax settings in the dashboard.')
    if (/^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY) && !account.charges_enabled) report.issues.push('Stripe has not enabled live charges for this account.')
    for (const row of report.mappings) {
      try { await shop.checkVariant(row.id); console.log(`OK ${row.key}`) }
      catch { report.issues.push(`${row.key}: Printful could not verify this variant; check its ID, artwork, availability and token permissions.`) }
    }
    if (report.issues.length) for (const issue of report.issues) console.log(`- ${issue}`)
    console.log('Read-only checks do not verify webhook delivery, tax registrations, shipping quotes or payments. Complete the test purchase in docs/checkout.md.')
  } else console.log('\nOffline check only; no provider requests sent. Later: npm run shop:check -- --remote')
  process.exitCode = report.issues.length ? 1 : 0
}

if (require.main === module) main().catch(error => {
  // Provider errors may contain request data; only display our own plain Errors.
  console.error(error.constructor === Error ? error.message : 'Provider check failed. Check credentials, permissions and service availability; secrets were not printed.')
  process.exitCode = 1
})
module.exports = {prepareEnv, inspectConfig, listVariants}
