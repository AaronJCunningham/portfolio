const fs = require('node:fs')
const ts = require('typescript')
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true}}).outputText, filename)
const {test, beforeEach, afterEach} = require('node:test')
const assert = require('node:assert/strict')
const {Readable} = require('node:stream')
const Stripe = require('stripe')
const {parseCart} = require('../src/components/shop/cart.ts')
const {parseInput} = require('../src/server/shop/validation.ts')
const {shopConfig} = require('../src/server/shop/config.ts')
const {calculateQuote, publicQuote, openQuote, sealQuote, discountedLines} = require('../src/server/shop/quote.ts')
const {createCheckout, revalidateQuote} = require('../src/server/shop/checkout.ts')
const {fulfilCheckout} = require('../src/server/shop/fulfilment.ts')
const stripeModule = require('../src/server/shop/stripe.ts')
const checkoutHandler = require('../pages/api/shop/checkout.ts').default
const quoteHandler = require('../pages/api/shop/quote.ts').default
const webhookHandler = require('../pages/api/shop/webhook.ts').default
const shopAvailability = require('../src/config/shop.ts')
const originalComingSoon = shopAvailability.SHOP_COMING_SOON
const originalFetch = global.fetch, originalEnv = {...process.env}, originalClient = stripeModule.stripeClient
const attempt = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
const ok = result => new Response(JSON.stringify({code: 200, result}), {status: 200})
const input = () => ({items: [{id:'beanie',size:'One size',quantity:1}],email:'alex@example.com',phone:'',address:{name:'Alex',line1:'Example 12',line2:'',city:'Berlin',postalCode:'10115',country:'DE',state:''},billing:null,coupon:''})
const response = () => ({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(v){this.body=v;return this},end(){return this}})
const request = body => ({method:'POST',headers:{origin:'http://localhost:3100',host:'localhost:3100'},body})
function fixture(overrides={}) {
  const session={id:'cs_test_mock123456789',livemode:false,status:'complete',payment_status:'paid',metadata:{shop:'lvx-v1',shipping_service:'EXPRESS'},collected_information:{shipping_details:{name:'Alex',address:{line1:'Example 12',city:'Berlin',country:'DE',postal_code:'10115'}}},customer_details:{email:'alex@example.com'},...overrides}
  const updates=[]
  const stripe={checkout:{sessions:{retrieve:async()=>session,update:async(id,value)=>{updates.push(value);Object.assign(session.metadata,value.metadata)},listLineItems:async()=>({has_more:false,data:[{quantity:1,price:{product:{metadata:{printful_variant_id:'101'}}}}]})}}}
  return {session,stripe,updates}
}
beforeEach(()=>{
  shopAvailability.SHOP_COMING_SOON=false
  Object.assign(process.env,{SHOP_CHECKOUT_ENABLED:'false',SHOP_ORIGIN:'http://localhost:3100',STRIPE_SECRET_KEY:'sk_test_fake',STRIPE_WEBHOOK_SECRET:'whsec_fake',PRINTFUL_TOKEN:'fake',PRINTFUL_TEST_DRAFTS:'true',SHOP_TAX_MODE:'automatic',SHOP_SHIPPING_COUNTRIES:'',SHOP_QUOTE_SECRET:'a-local-test-secret-longer-than-thirty-two-characters',PRINTFUL_BEANIE_ONE_SIZE:'101',SHOP_LIVE_READY:'false'})
  global.fetch=async()=>{throw Error('Unexpected external request')}
})
afterEach(()=>{global.fetch=originalFetch;stripeModule.stripeClient=originalClient;process.env={...originalEnv};shopAvailability.SHOP_COMING_SOON=originalComingSoon})
test('coming-soon store blocks quotes, orders and webhooks even with providers enabled',async()=>{
  shopAvailability.SHOP_COMING_SOON=true
  stripeModule.stripeClient=()=>{throw Error('Coming-soon store must not contact Stripe')}
  const printfulWebhookHandler=require('../pages/api/shop/printful-webhook.ts').default
  for(const enabled of ['false','true']) {
    process.env.SHOP_CHECKOUT_ENABLED=enabled
    for(const handler of [quoteHandler,checkoutHandler]) {
      const res=response();await handler(request(input()),res)
      assert.equal(res.statusCode,503);assert.match(res.body.error,/COMING SOON/)
      assert.equal(res.body.receipt,undefined);assert.equal(res.body.url,undefined)
      assert.equal(res.headers['Cache-Control'],'private, no-store')
    }
    for(const handler of [webhookHandler,printfulWebhookHandler]) {
      const res=response();await handler(request({}),res);assert.equal(res.statusCode,503)
    }
  }
})
test('cart rejects unknown products, wrong sizes, fractions and duplicate limit bypass',()=>{
  for(const value of [[],[{id:'bad',size:'M',quantity:1}],[{id:'beanie',size:'M',quantity:1}],[{id:'beanie',size:'One size',quantity:1.5}],[{id:'beanie',size:'One size',quantity:10},{id:'beanie',size:'One size',quantity:1}]])assert.throws(()=>parseCart(value))
})
test('validates global addresses, required regions, postal formats and separate billing',()=>{
  const us=input();us.address={...us.address,country:'US',postalCode:'90210'};assert.throws(()=>parseInput(us),e=>!!e.fields['address.state'])
  us.address.state='CA';assert.equal(parseInput(us).address.state,'CA')
  us.billing={...us.address,postalCode:'bad'};assert.throws(()=>parseInput(us),e=>!!e.fields['billing.postalCode'])
  const hk=input();hk.address={...hk.address,country:'HK',postalCode:''};assert.equal(parseInput(hk).address.country,'HK')
})
test('shipping varies with destination, quantities, product mix, service and remote region',async()=>{
  const de=await calculateQuote(input());const au=input();au.address={...au.address,country:'AU',state:'NSW',postalCode:'2000'};const australia=await calculateQuote(au);assert.ok(australia.shipping.amount>de.shipping.amount)
  const multi=input();multi.items[0].quantity=3;assert.ok((await calculateQuote(multi)).shipping.amount>de.shipping.amount)
  multi.items.push({id:'polo',size:'M',quantity:1});assert.ok((await calculateQuote(multi)).shipping.amount>(await calculateQuote({...multi,items:multi.items.slice(0,1)})).shipping.amount)
  assert.ok((await calculateQuote({...input(),shippingId:'EXPRESS'})).shipping.amount>de.shipping.amount)
  const us=input();us.address={...us.address,country:'US',state:'AK',postalCode:'99501'};assert.equal((await calculateQuote(us)).shippingOptions.length,1)
})
test('unsupported destinations and unavailable service IDs fail before payment',async()=>{
  const value=input();value.address.country='AQ';await assert.rejects(calculateQuote(value),/No delivery/)
  await assert.rejects(calculateQuote({...input(),shippingId:'FREE'}),/no longer available/)
})
test('discount applies to items only and tax is recalculated on discounted goods and shipping',async()=>{
  const plain=await calculateQuote(input());const reduced=await calculateQuote({...input(),coupon:'lvxcomm'})
  assert.equal(reduced.discount.amount,375);assert.equal(reduced.shipping.amount,plain.shipping.amount)
  assert.equal(reduced.total,2500-375+reduced.shipping.amount)
  assert.equal(reduced.tax.amount,Math.round(reduced.total*1900/11900));assert.ok(reduced.tax.amount<plain.tax.amount)
  const us=input();us.address={...us.address,country:'US',state:'OR',postalCode:'97035'};assert.equal((await calculateQuote(us)).tax.amount,0)
  await assert.rejects(calculateQuote({...input(),coupon:'BAD'}),/invalid or has expired/)
})
test('server ignores tampered prices, totals and client tax/shipping amounts',async()=>{
  const value=input();value.items[0].price=0;value.total=0;value.shipping=0;value.tax=0
  const result=await calculateQuote(value);assert.equal(result.subtotal,2500);assert.ok(result.total>2500)
})
test('quotes are encrypted, expire, reject tampering and cannot cross local/live mode',async()=>{
  const snapshot=await calculateQuote(input());const token=sealQuote(snapshot)
  assert.equal(openQuote(token).input.email,'alex@example.com');assert.ok(!Buffer.from(token,'base64url').toString('utf8').includes('alex@example.com'))
  assert.throws(()=>openQuote(token,Date.now()+16*60*1000),/expired/)
  const bytes=Buffer.from(token,'base64url');bytes[30]^=1;assert.throws(()=>openQuote(bytes.toString('base64url')))
  process.env.SHOP_CHECKOUT_ENABLED='true';assert.throws(()=>openQuote(token),/expired/)
})
test('stale totals cannot be accepted at final submission',async()=>{
  const snapshot=await calculateQuote(input());snapshot.shipping.amount-=1;snapshot.total-=1
  await assert.rejects(revalidateQuote(sealQuote(snapshot)),/changed/)
})
test('discount cent allocation always reconciles',()=>{
  const rows=[{id:'a',size:'M',amount:3900},{id:'b',size:'M',amount:2500},{id:'c',size:'M',amount:4500}]
  assert.equal(discountedLines(rows,1635).reduce((n,r)=>n+r.amount,0),10900-1635)
})
test('offline quote and submit use no external service; retries return the same reference',async()=>{
  const res=response();await quoteHandler(request(input()),res);assert.equal(res.statusCode,200)
  const one=response();await checkoutHandler(request({token:res.body.token,attempt}),one);assert.equal(one.statusCode,200);assert.equal(one.body.receipt.total,res.body.total)
  const two=response();await checkoutHandler(request({token:res.body.token,attempt}),two);assert.equal(one.body.receipt.reference,two.body.receipt.reference)
  assert.equal(one.body.receipt.items[0].name,'LVX Beanie')
})
test('cross-origin quote and submission fail',async()=>{
  for(const handler of [quoteHandler,checkoutHandler]){const req=request(input());req.headers.origin='https://evil.example';const res=response();await handler(req,res);assert.equal(res.statusCode,403)}
})
test('connected shipping uses catalog variants and customer address; Stripe Tax sees discounted amounts',async()=>{
  process.env.SHOP_CHECKOUT_ENABLED='true';const calls=[]
  global.fetch=async(url,options)=>{calls.push({url,body:options.body&&JSON.parse(options.body)});if(options.method==='GET')return ok({sync_variant:{id:101,variant_id:2001,synced:true,is_ignored:false,availability_status:'active'}});return ok([{id:'STANDARD',name:'Standard',rate:'6.49',currency:'EUR',minDeliveryDays:5,maxDeliveryDays:10}])}
  const taxes=[];const stripe={promotionCodes:{list:async()=>({data:[{id:'promo_1',code:'LVXCOMM',active:true,customer:null,restrictions:{first_time_transaction:false},promotion:{coupon:{valid:true,percent_off:15}}}]})},tax:{calculations:{create:async params=>{taxes.push(params);return {id:'taxcalc_1',amount_total:2774,tax_amount_inclusive:443,tax_amount_exclusive:0}}}}}
  const quote=await calculateQuote({...input(),coupon:'LVXCOMM'},stripe)
  assert.equal(calls[1].body.items[0].variant_id,2001);assert.equal(calls[1].body.recipient.zip,'10115');assert.equal(taxes[0].line_items[0].amount,2125);assert.equal(taxes[0].shipping_cost.amount,649);assert.equal(quote.tax.amount,443)
})
test('connected payment preserves reviewed shipping, coupon, and address with stable idempotency',async()=>{
  const quote=await calculateQuote(input());quote.mode='connected';quote.items[0].syncVariantId=101;quote.discount={code:'LVXCOMM',amount:375,promotionId:'promo_1'}
  process.env.SHOP_CHECKOUT_ENABLED='true';const calls=[];const customers=[]
  const stripe={customers:{create:async(...args)=>{customers.push(args);return{id:'cus_1'}}},checkout:{sessions:{create:async(...args)=>{calls.push(args);return{id:'cs_1'}}}}}
  await createCheckout(quote,attempt,stripe);await createCheckout(quote,attempt,stripe)
  assert.equal(customers[0][0].shipping.address.country,'DE');assert.equal(calls[0][0].shipping_options[0].shipping_rate_data.fixed_amount.amount,quote.shipping.amount)
  assert.equal(calls[0][0].shipping_address_collection,undefined);assert.equal(calls[0][0].discounts[0].promotion_code,'promo_1');assert.equal(calls[0][0].metadata.shipping_service,'STANDARD');assert.equal(calls[0][1].idempotencyKey,calls[1][1].idempotencyKey)
})
test('live mode needs explicit readiness, HTTPS, secret and tax setup',()=>{
  process.env.SHOP_CHECKOUT_ENABLED='true';assert.equal(shopConfig().ready,true)
  process.env.STRIPE_SECRET_KEY='sk_live_fake';assert.equal(shopConfig().ready,false)
  process.env.SHOP_LIVE_READY='true';process.env.SHOP_ORIGIN='https://shop.example.com';assert.equal(shopConfig().ready,true)
  process.env.SHOP_QUOTE_SECRET='';assert.equal(shopConfig().ready,false)
})
test('verified unpaid events never fulfil; invalid signatures fail',async()=>{
  process.env.SHOP_CHECKOUT_ENABLED='true'
  const {stripe}=fixture({payment_status:'unpaid'});const sdk=new Stripe('sk_test_fake');stripe.webhooks=sdk.webhooks;stripeModule.stripeClient=()=>stripe
  const payload=JSON.stringify({id:'evt_test',type:'checkout.session.completed',data:{object:{id:'cs_test_mock123456789'}}})
  for(const valid of [true,false]){const req=Readable.from([Buffer.from(payload)]);req.method='POST';req.headers={'stripe-signature':valid?sdk.webhooks.generateTestHeaderString({payload,secret:'whsec_fake'}):'bad'};const res=response();await webhookHandler(req,res);assert.equal(res.statusCode,valid?200:400)}
})
test('disabled checkout rejects webhooks without contacting either provider',async()=>{
  stripeModule.stripeClient=()=>{throw Error('Must not contact Stripe while disabled')}
  const req=Readable.from([]);req.method='POST';req.headers={}
  const res=response();await webhookHandler(req,res);assert.equal(res.statusCode,503)
})
test('malformed or non-origin shop URLs keep checkout unavailable without crashing',()=>{
  process.env.SHOP_CHECKOUT_ENABLED='true'
  for(const origin of ['invalid','ftp://example.com','https://user:password@example.com','https://example.com/shop','https://example.com?token=secret']){
    process.env.SHOP_ORIGIN=origin;assert.equal(shopConfig().ready,false)
  }
})
test('test payment skips Printful unless explicitly enabled',async()=>{
  process.env.PRINTFUL_TEST_DRAFTS='false';const {stripe,updates}=fixture();await fulfilCheckout('cs_test_mock123456789',stripe);assert.equal(updates[0].metadata.fulfilment,'test_skipped')
})
test('fulfilment uses chosen service, handles duplicate delivery and lost metadata',async()=>{
  const {stripe,session}=fixture();let saved=null,posts=0
  global.fetch=async(url,options)=>{if(options.method==='GET')return saved?ok(saved):new Response('{}',{status:404});posts++;const body=JSON.parse(options.body);assert.equal(body.shipping,'EXPRESS');assert.match(url,/confirm=0&update_existing=0$/);saved={id:1001,status:'draft'};return ok(saved)}
  await fulfilCheckout(session.id,stripe);await fulfilCheckout(session.id,stripe);delete session.metadata.printful_order_id;await fulfilCheckout(session.id,stripe);assert.equal(posts,1)
})
test('fulfilment uses the quoted customer delivery address when Checkout only collected billing',async()=>{
  const {stripe,session}=fixture({collected_information:null,customer:'cus_1'});stripe.customers={retrieve:async()=>({shipping:{name:'Alex',address:{line1:'Example',city:'Hong Kong',country:'HK',postal_code:null}}})}
  global.fetch=async(url,options)=>{if(options.method==='GET')return new Response('{}',{status:404});assert.equal(JSON.parse(options.body).recipient.country_code,'HK');return ok({id:1,status:'draft'})}
  await fulfilCheckout(session.id,stripe);assert.equal(session.metadata.printful_order_id,'1')
})
test('lost creation response recovers the existing Printful order',async()=>{
  const {stripe,session}=fixture();let saved=false;global.fetch=async(url,options)=>{if(options.method==='POST'){saved=true;throw Error('Timeout')}return saved?ok({id:9,status:'draft'}):new Response('{}',{status:404})}
  await fulfilCheckout(session.id,stripe);assert.equal(session.metadata.printful_order_id,'9')
})
test('simultaneous webhook deliveries converge on one draft',async()=>{
  const a=fixture(),b=fixture();let saved=null,creates=0;global.fetch=async(url,options)=>{if(options.method==='GET')return saved?ok(saved):new Response('{}',{status:404});if(saved)return new Response('{}',{status:400});creates++;saved={id:10,status:'draft'};return ok(saved)}
  await Promise.all([fulfilCheckout(a.session.id,a.stripe),fulfilCheckout(b.session.id,b.stripe)]);assert.equal(creates,1)
})
test('fulfilment outages are retryable and recorded for attention',async()=>{
  const {stripe,session}=fixture();global.fetch=async()=>new Response('{}',{status:503});await assert.rejects(fulfilCheckout(session.id,stripe));assert.equal(session.metadata.fulfilment,'needs_attention')
})

test('email templates escape customer content and reject unsafe tracking links', async()=>{
  const {orderEmail,shippingEmail}=require('../src/server/shop/email.ts')
  const quote=await calculateQuote(input());const message=orderEmail({...quote,reference:'LVX-001',address:{...input().address,name:'<script>alert(1)</script>'}})
  assert.ok(!message.html.includes('<script>'));assert.ok(message.html.includes('&lt;script&gt;'));assert.ok(message.text.includes('Total:'))
  const shipment={id:1,carrier:'Carrier',tracking_number:'123',tracking_url:'javascript:alert(1)',items:[{item_id:1,quantity:1}]}
  const email=shippingEmail({external_id:'LVX-001',items:[{id:1,name:'Beanie'}]},shipment)
  assert.ok(!email.html.includes('javascript:'));assert.ok(email.text.includes('Beanie × 1'))
})
test('shipping emails use trusted Printful data, package idempotency and stay disabled locally',async()=>{
  const {sendShipment}=require('../src/server/shop/email.ts')
  await assert.rejects(sendShipment(1,2),/disabled/)
  Object.assign(process.env,{SHOP_CHECKOUT_ENABLED:'true',SHOP_EMAIL_ENABLED:'true',RESEND_API_KEY:'local-test',SHOP_EMAIL_FROM:'LVX <info@example.com>'})
  const sent=[]
  global.fetch=async(url,options)=>{
    if(url.includes('printful.com'))return ok({id:1,external_id:'lvx_'+'a'.repeat(28),status:'partial',recipient:{email:'alex@example.com'},items:[{id:1,name:'Beanie'}],shipments:[{id:2,carrier:'DHL',tracking_number:'123',tracking_url:'https://example.com/tracking',items:[{item_id:1,quantity:1}]}]})
    sent.push(options);return new Response('{}',{status:200})
  }
  await sendShipment(1,2);await sendShipment(1,2)
  assert.equal(sent[0].headers['Idempotency-Key'],sent[1].headers['Idempotency-Key']);assert.deepEqual(JSON.parse(sent[0].body).to,['alex@example.com'])
  assert.equal(JSON.parse(sent[0].body).reply_to,'info@aaronjcunningham.com')
  await assert.rejects(sendShipment(1,999),/not yet available/)
})
test('Printful webhook rejects invalid tokens and malformed events before any network call',async()=>{
  const handler=require('../pages/api/shop/printful-webhook.ts').default
  Object.assign(process.env,{SHOP_CHECKOUT_ENABLED:'true',SHOP_EMAIL_ENABLED:'true',PRINTFUL_WEBHOOK_SECRET:'s'.repeat(40)})
  let res=response();await handler({method:'POST',query:{token:'wrong'},body:{}},res);assert.equal(res.statusCode,401)
  res=response();await handler({method:'POST',query:{token:'s'.repeat(40)},body:{type:'package_shipped',data:{order:{id:'bad'}}}},res);assert.equal(res.statusCode,400)
})
