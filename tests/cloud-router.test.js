/**
 * 云函数 api 路由与身份校验
 * 运行：node tests/cloud-router.test.js
 *
 * 云函数依赖 wx-server-sdk，本地无法直接加载，这里用桩替换该依赖后驱动 index.js，
 * 验证三件事：按 action 路由分发、身份来自 OPENID、统一返回 { ok, data } / { ok: false, message }。
 */
const assert = require('assert')
const Module = require('module')

const APPID = 'wxa8316f83189d05b9'
let stubOpenid = 'test-openid-001'

const sdkStub = {
  DYNAMIC_CURRENT_ENV: 'DYNAMIC_CURRENT_ENV',
  init() {},
  database() {
    return { collection: (name) => ({ name }) }
  },
  getWXContext() {
    return { OPENID: stubOpenid, APPID, UNIONID: undefined }
  },
}

const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'wx-server-sdk') return sdkStub
  return originalLoad.apply(this, [request, parent, isMain])
}
// eslint-disable-next-line global-require
const apiFn = require('../cloudfunctions/api/index')
Module._load = originalLoad

let passed = 0
let failed = 0
const failures = []

async function it(name, fn) {
  try {
    await fn()
    passed += 1
    console.log('  ✓ ' + name)
  } catch (err) {
    failed += 1
    failures.push(`${name}：${err.message}`)
    console.log('  ✗ ' + name + ' -> ' + err.message)
  }
}

async function main() {
  console.log('云函数 api 路由与身份')

  await it('身份来自 OPENID：user.whoami 返回 openid', async () => {
    const res = await apiFn.main({ action: 'user.whoami', params: {} })
    assert.strictEqual(res.ok, true)
    assert.strictEqual(res.data.openid, 'test-openid-001')
    assert.strictEqual(res.data.appid, APPID)
    assert.strictEqual(res.data.bound, false)
  })

  await it('OPENID 缺失时拒绝执行', async () => {
    stubOpenid = ''
    const res = await apiFn.main({ action: 'user.whoami', params: {} })
    stubOpenid = 'test-openid-001'
    assert.strictEqual(res.ok, false)
    assert.ok(res.message.includes('身份'), '应返回身份相关错误')
  })

  await it('未知业务域返回明确错误', async () => {
    const res = await apiFn.main({ action: 'unknown.ping', params: {} })
    assert.strictEqual(res.ok, false)
    assert.ok(res.message.includes('暂不支持'), 'message 应说明不支持')
  })

  await it('尚未接入的操作返回明确错误（占位模块）', async () => {
    const res = await apiFn.main({ action: 'task.list', params: {} })
    assert.strictEqual(res.ok, false)
    assert.ok(res.message.includes('task.list'), 'message 应带回 action')
  })

  await it('action 缺省时不会误命中任何模块', async () => {
    const res = await apiFn.main({})
    assert.strictEqual(res.ok, false)
  })

  console.log('\n----------------------------------------')
  console.log(`通过 ${passed} 项，失败 ${failed} 项`)
  if (failed) {
    console.log('\n失败明细：')
    failures.forEach((item) => console.log('  - ' + item))
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('\n用例执行异常:', err)
  process.exit(1)
})
