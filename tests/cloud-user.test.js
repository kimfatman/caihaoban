/**
 * 身份域：建档、登录、并发与字段安全
 * 运行：node tests/cloud-user.test.js
 *
 * 云函数依赖 wx-server-sdk，本地用桩替换；数据库用内存假集合替代，
 * 假集合自带 openid 唯一索引（add 时重复即抛 -502005），用于还原真实的并发建档场景。
 */
const assert = require('assert')
const Module = require('module')

const APPID = 'wxa8316f83189d05b9'
let currentOpenid = 'test-openid-card2'

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** 内存假数据库：只实现 user 域用到的 where / add / doc().update() */
function createFakeDb() {
  const store = []
  let autoId = 0

  function collection(name) {
    return {
      name,
      async add({ data }) {
        await tick()
        if (store.some((item) => item.openid === data.openid)) {
          const err = new Error('E11000 duplicate key error collection: users index: openid_1')
          err.errCode = -502005
          throw err
        }
        autoId += 1
        const record = Object.assign({ _id: `u_auto_${autoId}` }, data)
        store.push(record)
        return { _id: record._id }
      },
      where(condition) {
        // 快照在 where() 时刻取定，用于还原「两人同时查到空、然后同时建档」的并发场景
        const matched = store.filter((item) =>
          Object.keys(condition).every((key) => item[key] === condition[key])
        )
        const chain = {
          limit(size) {
            matched.splice(size)
            return chain
          },
          async get() {
            await tick()
            return { data: matched.slice() }
          },
        }
        return chain
      },
      doc(id) {
        return {
          async update({ data }) {
            await tick()
            const hit = store.find((item) => item._id === id)
            if (!hit) {
              const err = new Error('document does not exist')
              err.errCode = -1
              throw err
            }
            Object.assign(hit, data)
            return { stats: { updated: 1 } }
          },
        }
      },
    }
  }

  return { collection, store, serverDate: () => ({ $$date: Date.now() }) }
}

const fakeDb = createFakeDb()

const sdkStub = {
  DYNAMIC_CURRENT_ENV: 'DYNAMIC_CURRENT_ENV',
  init() {},
  database() {
    return fakeDb
  },
  getWXContext() {
    return { OPENID: currentOpenid, APPID, UNIONID: undefined }
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

const call = (action, params) => apiFn.main({ action, params })
const recordOf = (openid) => fakeDb.store.find((item) => item.openid === openid)

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
  console.log('身份域：建档、登录、并发与字段安全')

  await it('首次登录建档：返回 userId，状态为 normal', async () => {
    currentOpenid = 'test-openid-new'
    const res = await call('user.login', { nickname: '甲机构' })
    assert.strictEqual(res.ok, true)
    assert.ok(res.data.userId, '应返回 userId')
    assert.strictEqual(res.data.isNew, true)
    assert.strictEqual(res.data.status, 'normal')
    assert.strictEqual(res.data.user.nickname, '甲机构')
    assert.strictEqual(res.data.user.idVerified, false)
    assert.strictEqual(res.data.user.status, 'normal')
  })

  await it('建档字段符合约定：无 idCardNo，保留 idCardLast4', async () => {
    const record = recordOf('test-openid-new')
    assert.ok(record, '应写入 users 集合')
    assert.strictEqual('idCardNo' in record, false, '不得存储身份证号')
    assert.strictEqual(record.idCardLast4, '', 'idCardLast4 实名认证前为空')
    assert.strictEqual(record.openid, 'test-openid-new')
    assert.strictEqual(record.idVerified, false)
    assert.strictEqual(record.status, 'normal')
    assert.ok(record.createdAt && record.lastLoginAt, '应写入时间戳')
  })

  await it('重复登录：返回同一 userId，不重复建档', async () => {
    currentOpenid = 'test-openid-repeat'
    const first = await call('user.login', {})
    const second = await call('user.login', {})
    assert.strictEqual(second.ok, true)
    assert.strictEqual(second.data.userId, first.data.userId)
    assert.strictEqual(second.data.isNew, false)
    assert.strictEqual(fakeDb.store.filter((i) => i.openid === 'test-openid-repeat').length, 1)
  })

  await it('并发登录：唯一索引冲突后重查，不报错且同一用户', async () => {
    currentOpenid = 'test-openid-concurrent'
    const [a, b] = await Promise.all([call('user.login', {}), call('user.login', {})])
    assert.strictEqual(a.ok, true, 'A 应成功')
    assert.strictEqual(b.ok, true, 'B 遇到唯一索引冲突后重查，也应成功')
    assert.strictEqual(a.data.userId, b.data.userId, '两次应返回同一用户')
    // 必须是一个建档、一个走「冲突后重查」，否则说明没真正并发到
    assert.notStrictEqual(a.data.isNew, b.data.isNew, '应恰有一次为新建')
    assert.strictEqual(fakeDb.store.filter((i) => i.openid === 'test-openid-concurrent').length, 1)
  })

  await it('客户端传入 idVerified / status / idCardLast4 一律不生效', async () => {
    currentOpenid = 'test-openid-illegal'
    const res = await call('user.login', {
      nickname: '乙机构',
      idVerified: true,
      status: 'disabled',
      idCardLast4: '1234',
    })
    assert.strictEqual(res.ok, true)
    assert.strictEqual(res.data.user.idVerified, false, '客户端不能自我认证实名')
    assert.strictEqual(res.data.user.status, 'normal', '客户端不能改状态')
    assert.strictEqual(res.data.user.idCardLast4, '', '客户端不能写 idCardLast4')
    const record = recordOf('test-openid-illegal')
    assert.strictEqual(record.idVerified, false)
    assert.strictEqual(record.status, 'normal')
    assert.strictEqual(record.idCardLast4, '')
  })

  await it('被禁用账号：whoami 与 login 都返回明确错误', async () => {
    currentOpenid = 'test-openid-disabled'
    await call('user.login', {})
    recordOf('test-openid-disabled').status = 'disabled'

    const who = await call('user.whoami', {})
    assert.strictEqual(who.ok, false)
    assert.ok(who.message.includes('禁用'), 'whoami 应提示被禁用')

    const login = await call('user.login', {})
    assert.strictEqual(login.ok, false)
    assert.ok(login.message.includes('禁用'), 'login 应提示被禁用')
  })

  await it('已注销账号：返回明确错误', async () => {
    currentOpenid = 'test-openid-deleted'
    await call('user.login', {})
    recordOf('test-openid-deleted').status = 'deleted'

    const who = await call('user.whoami', {})
    assert.strictEqual(who.ok, false)
    assert.ok(who.message.includes('注销'))
  })

  await it('whoami：未建档的新用户返回 bound=false 且不报错', async () => {
    currentOpenid = 'test-openid-unknown'
    const who = await call('user.whoami', {})
    assert.strictEqual(who.ok, true)
    assert.strictEqual(who.data.bound, false)
    assert.strictEqual(who.data.userId, null)
    assert.strictEqual(who.data.status, null)
  })

  await it('whoami：已建档用户返回真实 userId 与 status', async () => {
    currentOpenid = 'test-openid-whoami'
    const login = await call('user.login', { nickname: '丙机构' })
    const who = await call('user.whoami', {})
    assert.strictEqual(who.data.bound, true)
    assert.strictEqual(who.data.userId, login.data.userId)
    assert.strictEqual(who.data.status, 'normal')
  })

  await it('每次登录都刷新 lastLoginAt', async () => {
    currentOpenid = 'test-openid-lastlogin'
    await call('user.login', {})
    const before = recordOf('test-openid-lastlogin').lastLoginAt
    await sleep(20)
    await call('user.login', {})
    const after = recordOf('test-openid-lastlogin').lastLoginAt
    assert.ok(after > before, `lastLoginAt 应更新：${before} -> ${after}`)
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
