/**
 * 云函数纯函数副本一致性校验
 * 运行：node tests/cloud-pure.test.js
 *
 * 架构要求：utils/recommend.js 与 utils/notice.js 是纯函数，原样复制进云函数使用。
 * 本用例直接驱动「utils/ 原文件」与「cloudfunctions/api/_shared/ 副本」两侧，
 * 断言两者的导出符号与计算结果完全一致，防止副本被改动后与前端行为分叉。
 */
global.wx = {
  showToast() {},
  setTabBarBadge() {},
  removeTabBarBadge() {},
  setNavigationBarTitle() {},
}

const assert = require('assert')
const store = require('../utils/store')

const local = {
  dict: require('../utils/dict'),
  recommend: require('../utils/recommend'),
  notice: require('../utils/notice'),
  auth: require('../utils/auth'),
}
const cloud = {
  dict: require('../cloudfunctions/api/_shared/dict'),
  recommend: require('../cloudfunctions/api/_shared/recommend'),
  notice: require('../cloudfunctions/api/_shared/notice'),
  auth: require('../cloudfunctions/api/_shared/auth'),
}

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

/** 用同一份输入跑两侧，比较输出（先转 JSON 去掉引用差异，再逐项断言） */
function sameResult(label, fn) {
  const a = JSON.parse(JSON.stringify(fn(local)))
  const b = JSON.parse(JSON.stringify(fn(cloud)))
  assert.deepStrictEqual(b, a, `${label}：云函数副本与前端原文件结果不一致`)
}

const TS = Date.now()

async function main() {
  console.log('云函数纯函数副本一致性')

  await it('导出符号一致：recommend / notice', () => {
    assert.deepStrictEqual(Object.keys(cloud.recommend).sort(), Object.keys(local.recommend).sort())
    assert.deepStrictEqual(Object.keys(cloud.notice).sort(), Object.keys(local.notice).sort())
  })

  await it('字典完全相同', () => {
    sameResult('dict', (m) => m.dict)
  })

  await it('权限矩阵一致（PERMISSIONS / ROLE_PERMISSIONS）', () => {
    assert.deepStrictEqual(cloud.auth.PERMISSIONS, local.auth.PERMISSIONS)
    assert.deepStrictEqual(cloud.auth.ROLE_PERMISSIONS, local.auth.ROLE_PERMISSIONS)
    assert.strictEqual(cloud.auth.roleAllows('owner', 'member:manage'), true)
    assert.strictEqual(cloud.auth.roleAllows('member', 'member:manage'), false)
    assert.strictEqual(cloud.auth.roleAllows('admin', 'quote:accept'), true)
    assert.strictEqual(cloud.auth.roleAllows('member', 'order:manage'), true)
  })

  await it('recommend.deriveOnsiteRequired 结果一致', () => {
    sameResult('deriveOnsiteRequired', (m) => store.tasks.map((task) => m.recommend.deriveOnsiteRequired(task)))
  })

  await it('recommend.profileCompleteness 结果一致', () => {
    sameResult('profileCompleteness', (m) =>
      store.serviceProfiles.map((profile) => m.recommend.profileCompleteness(profile))
    )
  })

  await it('recommend.rankTasks 结果一致', () => {
    const profile = store.serviceProfiles[0]
    const items = store.tasks.map((task) => ({ task, profile, stats: {}, load: {} }))
    sameResult('rankTasks', (m) => m.recommend.rankTasks(items))
  })

  await it('recommend.rankProviders 结果一致', () => {
    const task = store.tasks[0]
    const items = store.serviceProfiles.map((profile) => ({
      userId: profile.userId,
      profile,
      task,
      stats: {},
      load: {},
    }))
    sameResult('rankProviders', (m) => m.recommend.rankProviders(items))
  })

  await it('notice 判定结果一致：deriveStatus / isWithinPeriod / remainDays', () => {
    sameResult('notice 判定', (m) =>
      store.notices.map((notice) => ({
        id: notice.id,
        status: m.notice.deriveStatus(notice, TS),
        inPeriod: m.notice.isWithinPeriod(notice, TS),
        days: m.notice.remainDays(notice, TS),
      }))
    )
  })

  await it('notice 排序与公开过滤一致：sortNotices / filterPublic', () => {
    sameResult('sortNotices', (m) => m.notice.sortNotices(store.notices, store.noticeOrders, TS))
    sameResult('filterPublic', (m) => m.notice.filterPublic(store.notices, TS))
  })

  await it('notice 套餐、徽标、脱敏与校验一致', () => {
    sameResult('packageOf', (m) => ['free', 'top', 'featured', 'unknown'].map((plan) => m.notice.packageOf(plan)))
    sameResult('badgeOf', (m) => store.notices.map((notice) => m.notice.badgeOf(notice, store.noticeOrders, TS)))
    sameResult('maskContact', (m) => m.notice.maskContact('13800138000'))
    assert.deepStrictEqual(
      cloud.notice.validateNotice({ title: '短', content: '短', category: 'cooperation' }),
      local.notice.validateNotice({ title: '短', content: '短', category: 'cooperation' })
    )
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
