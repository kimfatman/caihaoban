/**
 * 接单人推荐核心用例
 * 运行：node tests/recommend.test.js
 *
 * 说明：项目为纯前端 Mock（无数据库），因此用例直接驱动 utils/recommend.js
 * 的纯函数与 utils/api.js 的接口层，验证硬条件筛选、评分、排序、权限与幂等。
 */
global.wx = {
  showToast() {},
  setTabBarBadge() {},
  removeTabBarBadge() {},
  setNavigationBarTitle() {},
}

const assert = require('assert')
const api = require('../utils/api')
const store = require('../utils/store')
const recommend = require('../utils/recommend')

let passed = 0
let failed = 0
const failures = []

async function it(name, fn) {
  try {
    await fn()
    passed += 1
    console.log('  \u2713 ' + name)
  } catch (err) {
    failed += 1
    failures.push(name + ' -> ' + err.message)
    console.log('  \u2717 ' + name)
    console.log('      ' + err.message)
  }
}

const DAY = 24 * 3600 * 1000

function makeProfile(patch) {
  return Object.assign(
    {
      userId: 'u9',
      businessTypes: ['accounting'],
      areas: [{ province: '北京市', city: '' }],
      serviceMode: 'both',
      orderStatus: 'accepting',
      monthlyCapacity: '5-10',
      quoteMode: 'project',
      qualifications: ['agency'],
      yearsOfExperience: 5,
      intro: '示例介绍',
    },
    patch || {}
  )
}

function makeTask(patch) {
  return Object.assign(
    {
      id: 't9',
      serviceType: 'accounting',
      region: '北京市/北京市/朝阳区',
      address: '',
      description: '',
      requirements: [],
      referencePrice: 6000,
      requiredQualifications: [],
    },
    patch || {}
  )
}

function score(profilePatch, taskPatch, options) {
  const opts = options || {}
  return recommend.scoreProvider({
    profile: makeProfile(profilePatch),
    task: makeTask(taskPatch),
    stats: opts.stats || {},
    load: opts.load || {},
    relaxed: !!opts.relaxed,
  })
}

async function main() {
  console.log('\n[1] 地区匹配')
  await it('市级命中得 1.0，省级得 0.9，未命中得 0', () => {
    assert.strictEqual(recommend.matchArea([{ province: '北京市', city: '北京市' }], '北京市/北京市/朝阳区').score, 1)
    assert.strictEqual(recommend.matchArea([{ province: '北京市', city: '' }], '北京市/北京市/朝阳区').score, 0.9)
    assert.strictEqual(recommend.matchArea([{ province: '广东省', city: '广州市' }], '北京市/北京市/朝阳区').score, 0)
  })

  await it('多地区取最高优先级命中', () => {
    const areas = [
      { province: '广东省', city: '广州市' },
      { province: '北京市', city: '北京市' },
    ]
    const hit = recommend.matchArea(areas, '北京市/北京市/朝阳区')
    assert.strictEqual(hit.level, 'city')
  })

  console.log('\n[2] 现场办理识别')
  await it('关键词命中判定为需现场', () => {
    assert.strictEqual(recommend.deriveOnsiteRequired({ description: '需现场盘点并银行函证' }), true)
    assert.strictEqual(recommend.deriveOnsiteRequired({ description: '纯线上记账，远程交付' }), false)
  })

  await it('显式声明优先于关键词推断', () => {
    assert.strictEqual(recommend.deriveOnsiteRequired({ description: '需现场盘点', onsiteRequired: false }), false)
    assert.strictEqual(recommend.deriveOnsiteRequired({ description: '远程交付', onsiteRequired: true }), true)
  })

  await it('线上服务不能无条件替代现场办理', () => {
    const r = score({ serviceMode: 'online' }, { onsiteRequired: true })
    assert.strictEqual(r.ok, false)
    assert.ok(/现场/.test(r.reject), '淘汰原因应说明现场办理')
  })

  await it('需现场时异地线下服务者被淘汰', () => {
    const r = score({ serviceMode: 'onsite', areas: [{ province: '广东省', city: '广州市' }] }, { onsiteRequired: true })
    assert.strictEqual(r.ok, false)
  })

  await it('不需现场时异地线上服务者可通过且分数低于同城', () => {
    const remote = score({ areas: [{ province: '广东省', city: '广州市' }] }, {})
    const local = score({}, {})
    assert.ok(remote.ok && local.ok)
    assert.ok(remote.score < local.score, '异地线上应低于本地')
  })

  console.log('\n[3] 硬条件筛选')
  await it('暂不接单：严格模式淘汰', () => {
    assert.strictEqual(score({ orderStatus: 'paused' }, {}).ok, false)
  })

  await it('暂不接单：放宽模式保留并标记提示', () => {
    const r = score({ orderStatus: 'paused' }, {}, { relaxed: true })
    assert.ok(r.ok)
    assert.ok(r.flags.indexOf('当前暂不接单') >= 0)
  })

  await it('业务类型不符被淘汰', () => {
    const r = score({ businessTypes: ['registration'] }, { serviceType: 'accounting' })
    assert.strictEqual(r.ok, false)
    assert.ok(/业务/.test(r.reject))
  })

  await it('缺少必要资质被淘汰，且放宽模式不放行', () => {
    const t = { requiredQualifications: ['cpa'] }
    const strict = score({}, t)
    assert.strictEqual(strict.ok, false)
    assert.ok(/会计师事务所/.test(strict.reject), '淘汰原因应指出缺失的资质名')
    assert.strictEqual(score({}, t, { relaxed: true }).ok, false)
  })

  await it('资质齐备时通过并标注资质符合', () => {
    const r = score({ qualifications: ['cpa', 'agency'] }, { requiredQualifications: ['cpa'] })
    assert.ok(r.ok)
    assert.ok(r.reasons.indexOf('资质符合') >= 0)
  })

  console.log('\n[4] 历史履约与中性分')
  await it('无历史记录取 0.5 中性分', () => {
    const h = recommend.evaluateHistory({})
    assert.strictEqual(h.score, 0.5)
    assert.strictEqual(h.neutral, true)
    assert.strictEqual(h.text, '暂无历史记录')
  })

  await it('完成 1 单无评价高于无记录，不被判为低质量', () => {
    const h = recommend.evaluateHistory({ completed: 1, reviewCount: 0, ratingAvg: 0 })
    assert.ok(h.score > 0.5, 'actual=' + h.score)
  })

  await it('5 单全 5 分取满分', () => {
    assert.strictEqual(recommend.evaluateHistory({ completed: 5, reviewCount: 5, ratingAvg: 5 }).score, 1)
  })

  await it('评价分越低分数越低', () => {
    const good = recommend.evaluateHistory({ completed: 5, reviewCount: 5, ratingAvg: 5 }).score
    const bad = recommend.evaluateHistory({ completed: 5, reviewCount: 5, ratingAvg: 2 }).score
    assert.ok(good > bad)
  })

  console.log('\n[5] 评分与完整度')
  await it('五维加权分可复算且落在 0—1', () => {
    const r = score({}, {}, { stats: { completed: 2, reviewCount: 2, ratingAvg: 4.5, avgPrice: 5800 } })
    assert.ok(r.ok)
    const p = r.parts
    const expected =
      (0.35 * p.business + 0.25 * p.areaMode + 0.2 * p.history + 0.1 * p.budget + 0.1 * p.capacity) *
      (0.75 + 0.25 * r.completeness)
    assert.ok(Math.abs(r.score - expected) < 0.01, 'recomputed=' + expected + ' actual=' + r.score)
    assert.ok(r.score >= 0 && r.score <= 1)
  })

  await it('资料不完整只降权不排除', () => {
    const full = score({}, {})
    const thin = score({ qualifications: [], yearsOfExperience: 0, intro: '' }, {})
    assert.ok(thin.completeness < full.completeness)
    assert.ok(thin.score < full.score, '不完整档案分数应更低')
    assert.ok(thin.score > 0, '不完整档案不应被判定为 0 分')
  })

  await it('接单能力越低负载分越低', () => {
    const idle = score({ monthlyCapacity: '10+' }, {}, { load: { activeOrders: 0 } })
    const busy = score({ monthlyCapacity: '1-4' }, {}, { load: { activeOrders: 4 } })
    assert.ok(idle.parts.capacity > busy.parts.capacity)
  })

  await it('预算与历史成交价接近时得分更高', () => {
    const near = score({}, {}, { stats: { completed: 1, avgPrice: 6000 } })
    const far = score({}, {}, { stats: { completed: 1, avgPrice: 30000 } })
    assert.ok(near.parts.budget > far.parts.budget)
  })

  console.log('\n[6] 排序稳定性')
  await it('同分同完整度按 userId 升序，顺序可复现', () => {
    const items = ['u3', 'u1', 'u2'].map((id) => ({
      userId: id,
      profile: makeProfile({ userId: id }),
      task: makeTask(),
      stats: {},
      load: {},
    }))
    const first = recommend.rankProviders(items).list.map((i) => i.userId)
    const second = recommend.rankProviders(items).list.map((i) => i.userId)
    assert.deepStrictEqual(first, ['u1', 'u2', 'u3'])
    assert.deepStrictEqual(first, second)
  })

  await it('rank 从 1 连续递增', () => {
    const items = ['u1', 'u2', 'u3'].map((id, index) => ({
      userId: id,
      profile: makeProfile({ userId: id, yearsOfExperience: 3 - index }),
      task: makeTask(),
      stats: {},
      load: {},
    }))
    const list = recommend.rankProviders(items).list
    assert.deepStrictEqual(list.map((i) => i.rank), [1, 2, 3])
  })

  console.log('\n[7] 接口层权限与数据范围')
  await it('非发布方无法查看推荐接单人', async () => {
    const res = await api.getRecommendedProviders('t2')
    assert.strictEqual(res.visible, false)
    assert.deepStrictEqual(res.list, [])
  })

  await it('已结束的任务不再推荐', async () => {
    const res = await api.getRecommendedProviders('t9')
    assert.strictEqual(res.visible, true)
    assert.strictEqual(res.list.length, 0)
    assert.ok(/已结束/.test(res.emptyText))
  })

  // 以 u1 身份发布一个无需资质、可远程的任务，用于验证候选人范围
  const created = await api.saveTask({
    title: '测试用税务申报协作任务',
    serviceType: 'tax',
    description: '用于验证推荐候选人范围的测试任务，涵盖税务申报全流程，交付申报表与回执。',
    region: '北京市/北京市/朝阳区',
    address: '朝阳区建国路 88 号',
    expectedFinishAt: Date.now() + 20 * DAY,
    referencePrice: 6000,
    quoteDeadline: Date.now() + 3 * DAY,
    attachments: [],
    requirements: [],
    onsiteRequired: false,
  })

  await it('候选人排除本人 / 发布者 / 同机构成员', async () => {
    const res = await api.getRecommendedProviders(created.id, { pageSize: 20 })
    assert.strictEqual(res.visible, true)
    assert.ok(res.list.length > 0, '应至少有一位候选人')
    res.list.forEach((p) => {
      assert.notStrictEqual(p.userId, 'u1', '不能推荐自己')
      assert.notStrictEqual(p.userId, 'u2', '不能推荐同机构成员')
      assert.notStrictEqual(p.userId, 'u3', '不能推荐同机构成员')
    })
  })

  await it('分页返回 hasMore 与 total 正确', async () => {
    const res = await api.getRecommendedProviders(created.id, { page: 1, pageSize: 1 })
    assert.strictEqual(res.list.length, 1)
    assert.ok(res.total >= 1)
    assert.strictEqual(res.hasMore, res.total > 1)
  })

  await it('查询推荐不写库（不产生报价 / 订单 / 会话）', async () => {
    const snapshot = [store.quotes.length, store.orders.length, store.conversations.length]
    await api.getRecommendedProviders(created.id, { pageSize: 20 })
    assert.deepStrictEqual([store.quotes.length, store.orders.length, store.conversations.length], snapshot)
  })

  console.log('\n[8] 邀请报价')
  const target = (await api.getRecommendedProviders(created.id, { pageSize: 20 })).list[0]

  await it('首次邀请成功并记录埋点', async () => {
    const res = await api.inviteProvider(created.id, target.userId)
    assert.strictEqual(res.invited, true)
    const hit = store.recommendEvents.find(
      (e) => e.kind === 'invite' && e.taskId === created.id && e.targetUserId === target.userId
    )
    assert.ok(hit, '应写入邀请埋点')
  })

  await it('重复邀请幂等，不产生重复记录', async () => {
    const before = store.recommendEvents.length
    const res = await api.inviteProvider(created.id, target.userId)
    assert.strictEqual(res.invited, false)
    assert.strictEqual(store.recommendEvents.length, before)
  })

  await it('不能邀请自己', async () => {
    await assert.rejects(api.inviteProvider(created.id, 'u1'))
  })

  await it('不能邀请同机构成员', async () => {
    await assert.rejects(api.inviteProvider(created.id, 'u2'))
  })

  await it('非发布方不能邀请', async () => {
    await assert.rejects(api.inviteProvider('t2', 'u4'))
  })

  console.log('\n[9] 场景 B：为我推荐任务')
  await it('三种排序均返回稳定结果集', async () => {
    const best = await api.getRecommendedTasks({ sort: 'best' })
    const latest = await api.getRecommendedTasks({ sort: 'latest' })
    const budget = await api.getRecommendedTasks({ sort: 'budget' })
    assert.strictEqual(best.needProfile, false)
    assert.strictEqual(best.total, latest.total)
    assert.strictEqual(best.total, budget.total)
    const bestDesc = best.list.map((t) => t.matchScore)
    for (let i = 1; i < bestDesc.length; i += 1) {
      assert.ok(bestDesc[i - 1] >= bestDesc[i], '最匹配应按分数降序')
    }
    const times = latest.list.map((t) => t.createdAt)
    for (let i = 1; i < times.length; i += 1) {
      assert.ok(times[i - 1] >= times[i], '最新发布应按时间降序')
    }
  })

  await it('推荐任务排除本机构发布的任务', async () => {
    const res = await api.getRecommendedTasks({})
    res.list.forEach((t) => {
      assert.notStrictEqual(t.publisherUserId, 'u1', '不应推荐自己发布的任务')
    })
  })

  await it('推荐任务均带匹配原因且不含已完成任务', async () => {
    const res = await api.getRecommendedTasks({})
    res.list.forEach((t) => {
      assert.ok(t.matchReasons.length > 0)
      assert.strictEqual(t.state, 'open')
    })
  })

  await it('大厅摘要与列表口径一致', async () => {
    const summary = await api.getRecommendSummary()
    const res = await api.getRecommendedTasks({})
    assert.strictEqual(summary.hasProfile, true)
    assert.strictEqual(summary.count, res.total)
  })

  console.log('\n[10] 服务能力档案')
  await it('保存档案返回完整度与派生文案', async () => {
    const saved = await api.saveServiceProfile({
      id: 'sp1',
      businessTypes: ['accounting', 'tax', 'bookkeeping'],
      areas: [{ province: '北京市', city: '' }, { province: '河北省', city: '廊坊市' }],
      serviceMode: 'both',
      orderStatus: 'accepting',
      monthlyCapacity: '5-10',
      quoteMode: 'project',
      qualifications: ['agency'],
      yearsOfExperience: 8,
      intro: '测试介绍',
    })
    assert.strictEqual(saved.hasProfile, true)
    assert.strictEqual(saved.areaTexts.length, 2)
    assert.ok(saved.completenessPercent > 0 && saved.completenessPercent <= 100)
  })

  await it('非法入参被服务端拦截', async () => {
    const base = {
      businessTypes: ['accounting'],
      areas: [{ province: '北京市', city: '' }],
      serviceMode: 'both',
      orderStatus: 'accepting',
      monthlyCapacity: '5-10',
      quoteMode: 'project',
      qualifications: [],
      yearsOfExperience: 1,
      intro: '',
    }
    const cases = [
      [{ businessTypes: [] }, /擅长业务/],
      [{ businessTypes: ['unknown'] }, /不支持/],
      [{ areas: [{ province: '火星省', city: '' }] }, /未知省份/],
      [{ areas: [{ province: '北京市', city: '杭州市' }] }, /没有/],
      [{ areas: [{ province: '北京市', city: '' }, { province: '北京市', city: '' }] }, null],
      [{ serviceMode: 'unknown' }, /服务方式/],
      [{ yearsOfExperience: 99 }, /服务年限/],
      [{ intro: 'x'.repeat(301) }, /300/],
    ]
    for (const [patch, pattern] of cases) {
      let message = ''
      try {
        await api.saveServiceProfile(Object.assign({}, base, patch))
      } catch (err) {
        message = err.message
      }
      if (pattern === null) {
        continue
      }
      assert.ok(pattern.test(message), 'patch=' + JSON.stringify(patch) + ' msg=' + message)
    }
  })

  await it('重复地区自动去重', async () => {
    const saved = await api.saveServiceProfile({
      businessTypes: ['accounting'],
      areas: [{ province: '北京市', city: '' }, { province: '北京市', city: '' }],
      serviceMode: 'both',
      orderStatus: 'accepting',
      monthlyCapacity: '5-10',
      quoteMode: 'project',
      qualifications: [],
      yearsOfExperience: 1,
      intro: '',
    })
    assert.strictEqual(saved.areas.length, 1)
  })

  await it('暂不接单后不再产生推荐', async () => {
    await api.saveServiceProfile({
      businessTypes: ['accounting', 'tax'],
      areas: [{ province: '北京市', city: '' }],
      serviceMode: 'both',
      orderStatus: 'paused',
      monthlyCapacity: '5-10',
      quoteMode: 'project',
      qualifications: [],
      yearsOfExperience: 1,
      intro: '',
    })
    const res = await api.getRecommendedTasks({})
    assert.strictEqual(res.paused, true)
    assert.ok(/暂不接单/.test(res.emptyText))
  })

  await it('服务者主页不暴露手机号', async () => {
    const p = await api.getProviderProfile('u3')
    assert.strictEqual(p.phone, undefined)
    assert.strictEqual(p.mobile, undefined)
    assert.ok(p.nickname)
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
