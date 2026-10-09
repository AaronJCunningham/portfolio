const {test} = require('node:test')
const assert = require('node:assert/strict')
const {prepareEnv, inspectConfig, listVariants} = require('../scripts/shop.cjs')

test('preparation preserves existing settings and generates secrets once', () => {
  const example = 'SHOP_CHECKOUT_ENABLED=false\nSTRIPE_SECRET_KEY=\nSHOP_QUOTE_SECRET=\nPRINTFUL_WEBHOOK_SECRET=\n'
  const existing = '# Keep me\nUNRELATED=existing\nSTRIPE_SECRET_KEY=existing-secret\nSHOP_CHECKOUT_ENABLED=false\nSHOP_QUOTE_SECRET="" # empty\n'
  let generated = 0
  const first = prepareEnv(existing, example, () => `random-secret-${++generated}`)
  assert.ok(first.text.startsWith('# Keep me\nUNRELATED=existing\nSTRIPE_SECRET_KEY=existing-secret\n'))
  assert.match(first.text, /SHOP_CHECKOUT_ENABLED=false/)
  assert.equal(first.generated.length, 2)
  const second = prepareEnv(first.text, example, () => { throw Error('Do not rotate secrets') })
  assert.equal(second.text, first.text)
  assert.deepEqual(second.added, [])
})

test('configuration report catches incomplete, duplicated and invalid mappings without printing secrets', () => {
  const products = [{name: 'Polo', id: 'polo', sizes: ['S', 'M']}]
  const key = (id, size) => `PRINTFUL_${size}`
  const env = {STRIPE_SECRET_KEY:'sk_test_private', STRIPE_WEBHOOK_SECRET:'whsec_private', PRINTFUL_TOKEN:'private-token', SHOP_QUOTE_SECRET:'a'.repeat(40), SHOP_TAX_MODE:'automatic', SHOP_ORIGIN:'http://localhost:3000', PRINTFUL_S:'101', PRINTFUL_M:'102'}
  assert.deepEqual(inspectConfig(env, products, key).issues, [])
  const bad = inspectConfig({...env, PRINTFUL_M:'101', SHOP_ORIGIN:'https://user:secret@example.com'}, products, key)
  assert.equal(bad.issues.length, 2)
  assert.ok(!JSON.stringify(bad.issues).includes('private'))
  assert.equal(inspectConfig({...env, PRINTFUL_M:''}, products, key).mappings[1].id, null)
  assert.equal(inspectConfig({...env, STRIPE_SECRET_KEY:'sk_live_private'}, products, key).issues.length, 2)
})

test('variant discovery reads every page and distinguishes decorated IDs from catalog IDs', async () => {
  const requests = []
  const rows = await listVariants(async path => {
    requests.push(path)
    if (path === '/store/products?limit=100&offset=0') return Array.from({length:100}, (_, i) => ({id:i+1,name:`Product ${i+1}`}))
    if (path === '/store/products?limit=100&offset=100') return [{id:101,name:'Last product'}]
    const id = Number(path.split('/').pop())
    return {sync_variants:[{id:id+1000,variant_id:id,synced:true,is_ignored:id===101,name:'Black / M',size:'M',color:'Black'}]}
  })
  assert.equal(rows.length, 101)
  assert.equal(rows[0].syncVariantId, 1001)
  assert.equal(rows[0].catalogVariantId, 1)
  assert.equal(rows[100].ready, false)
  assert.equal(requests.length, 103)
})
