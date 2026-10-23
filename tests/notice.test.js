/**
 * 同行公告核心用例
 * 运行：node tests/notice.test.js
 *
 * 覆盖：公开过滤、审核状态、有效期、付费优先排序、搜索筛选、发布流程、套餐与演示订单。
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
const dict = require('../utils/dict')
const noticeApi = require('../utils/notice')

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

async function main() {
  console.log('\n[1] 纯函数：有效期与状态')
  await it('未审核通过的公告一律不公开', () => {
    const ts = Date.now()
    assert.strictEqual(noticeApi.isWithinPeriod(store.notices.find((n) => n.id === 'nt5'), ts), false)
    assert.strictEqual(noticeApi.isWithinPeriod(store.notices.find((n) => n.id === 'nt6'), ts), false)
  })

  await it('已通过但超出展示期视为过期', () => {
    const nt7 = store.notices.find((n) => n.id === 'nt7')
    assert.strictEqual(noticeApi.isWithinPeriod(nt7, Date.now()), false)
    assert.strictEqual(noticeApi.deriveStatus(nt7, Date.now()), 'expired')
  })

  await it('待审核不会因为付费而变成可展示', () => {
    const nt5 = store.notices.find((n) => n.id === 'nt5')
    assert.strictEqual(noticeApi.deriveStatus(nt5, Date.now()), 'pending')
    assert.strictEqual(noticeApi.priorityOf(nt5, store.noticeOrders, Date.now()), 0)
  })

  console.log('\n[2] 公开列表')
  const list = await api.getNoticeList({})

  await it('只返回审核通过且在展示期内的公告', () => {
    const ids = list.list.map((item) => item.id)
    assert.deepStrictEqual(ids.slice().sort(), ['nt1', 'nt2', 'nt3', 'nt4'])
    assert.strictEqual(list.total, 4)
  })

  await it('置顶优先、其次推广、其余按发布时间倒序', () => {
    assert.deepStrictEqual(list.list.map((item) => item.id), ['nt1', 'nt2', 'nt4', 'nt3'])
    assert.strictEqual(list.list[0].badgeText, '置顶')
    assert.strictEqual(list.list[1].badgeText, '推广')
    assert.strictEqual(list.list[2].badgeText, '')
  })

  await it('列表不返回任何联系方式', () => {
    list.list.forEach((item) => {
      assert.strictEqual(item.contact, '')
      assert.strictEqual(item.contactMasked, '')
    })
  })

  await it('分类筛选只命中对应分类', () => {
    return api.getNoticeList({ category: 'cooperation' }).then((res) => {
      assert.ok(res.total > 0)
      res.list.forEach((item) => assert.strictEqual(item.category, 'cooperation'))
    })
  })

  await it('关键词命中标题或正文', async () => {
    const byTitle = await api.getNoticeList({ keyword: '代理记账外派' })
    assert.strictEqual(byTitle.total, 1)
    assert.strictEqual(byTitle.list[0].id, 'nt1')
    const byContent = await api.getNoticeList({ keyword: '西湖区' })
    assert.strictEqual(byContent.total, 1)
    assert.strictEqual(byContent.list[0].id, 'nt3')
  })

  await it('搜索无结果返回空列表而不是报错', async () => {
    const res = await api.getNoticeList({ keyword: '绝对不存在的关键词xyz' })
    assert.strictEqual(res.total, 0)
    assert.deepStrictEqual(res.list, [])
  })

  await it('分页 hasMore 计算正确', async () => {
    const res = await api.getNoticeList({ page: 1, pageSize: 3 })
    assert.strictEqual(res.list.length, 3)
    assert.strictEqual(res.hasMore, true)
    const last = await api.getNoticeList({ page: 2, pageSize: 3 })
    assert.strictEqual(last.list.length, 1)
    assert.strictEqual(last.hasMore, false)
  })

  console.log('\n[3] 付费优先的生效条件')
  await it('套餐价格与有效期统一来自 dict 配置', () => {
    const top = dict.noticePackages.find((item) => item.value === 'top')
    const featured = dict.noticePackages.find((item) => item.value === 'featured')
    const free = dict.noticePackages.find((item) => item.value === 'free')
    assert.strictEqual(top.price, 9.9)
    assert.strictEqual(top.days, 7)
    assert.strictEqual(featured.price, 29.9)
    assert.strictEqual(featured.days, 7)
    assert.strictEqual(free.price, 0)
  })

  await it('订单过期后不再享受置顶优先', () => {
    const nt1 = store.notices.find((n) => n.id === 'nt1')
    const order = store.noticeOrders.find((o) => o.id === 'no1')
    const backup = order.expireAt
    order.expireAt = Date.now() - DAY
    assert.strictEqual(noticeApi.priorityOf(nt1, store.noticeOrders, Date.now()), 0)
    order.expireAt = backup
    assert.strictEqual(noticeApi.priorityOf(nt1, store.noticeOrders, Date.now()), 2)
  })

  await it('订单与公告套餐不一致时不享受优先', () => {
    const nt1 = store.notices.find((n) => n.id === 'nt1')
    const order = store.noticeOrders.find((o) => o.id === 'no1')
    const backup = order.plan
    order.plan = 'featured'
    assert.strictEqual(noticeApi.priorityOf(nt1, store.noticeOrders, Date.now()), 0)
    order.plan = backup
  })

  await it('订单状态不是已支付时不计入优先（防止写错成 paid）', () => {
    const nt1 = store.notices.find((n) => n.id === 'nt1')
    const order = store.noticeOrders.find((o) => o.id === 'no1')
    const backup = order.status
    order.status = 'pending'
    assert.strictEqual(noticeApi.priorityOf(nt1, store.noticeOrders, Date.now()), 0)
    order.status = backup
  })

  console.log('\n[4] 详情与浏览量')
  await it('非公开公告对他人不可见', async () => {
    await assert.rejects(api.getNoticeDetail('nt8'), '他人待审核公告不可见')
    await assert.rejects(api.getNoticeDetail('nt7'), '已过期公告不可见')
  })

  await it('公开公告浏览量 +1', async () => {
    const before = store.notices.find((n) => n.id === 'nt3').viewCount
    await api.getNoticeDetail('nt3')
    assert.strictEqual(store.notices.find((n) => n.id === 'nt3').viewCount, before + 1)
  })

  await it('详情返回打码联系方式与完整联系方式两个字段', async () => {
    const detail = await api.getNoticeDetail('nt1')
    assert.ok(detail.contact.length > 0)
    assert.notStrictEqual(detail.contactMasked, detail.contact)
    assert.ok(detail.contactMasked.indexOf('****') > 0)
  })

  console.log('\n[5] 发布流程')
  const created = await api.saveNotice({
    title: '测试公告：寻找北京地区代理记账合作',
    content: '这是一个用于验证发布流程的测试公告，内容需要超过二十个字才能通过校验。',
    category: 'cooperation',
    region: '北京市',
    contact: '微信 test1234',
  })

  await it('新公告进入待审核状态', () => {
    assert.strictEqual(created.status, 'pending')
    assert.strictEqual(created.isOwner, true)
    assert.strictEqual(created.badgeText, '')
  })

  await it('待审核公告不进入公开列表', async () => {
    const res = await api.getNoticeList({})
    assert.strictEqual(res.list.some((item) => item.id === created.id), false)
  })

  await it('待审核公告出现在「我的发布」', async () => {
    const res = await api.getNoticeList({ mine: true })
    assert.ok(res.list.some((item) => item.id === created.id))
    assert.ok(res.total >= 1)
  })

  await it('发布者本人可以查看自己的待审核公告', async () => {
    const detail = await api.getNoticeDetail(created.id)
    assert.strictEqual(detail.status, 'pending')
  })

  await it('标题过短被拒绝', async () => {
    await assert.rejects(api.saveNotice({ title: '太短', content: '正文'.repeat(20), category: 'cooperation' }))
  })

  await it('分类非法被拒绝', async () => {
    await assert.rejects(
      api.saveNotice({ title: '这是一个合法长度的标题', content: '正文'.repeat(20), category: 'unknown' })
    )
  })

  await it('地区不在字典内被拒绝', async () => {
    await assert.rejects(
      api.saveNotice({
        title: '这是一个合法长度的标题',
        content: '正文'.repeat(20),
        category: 'cooperation',
        region: '火星省',
      })
    )
  })

  console.log('\n[6] 演示订单')
  const pkgBefore = created.plan

  await it('未通过审核的公告也能下单，但审核状态不变', async () => {
    const res = await api.createNoticeOrder({ noticeId: created.id, plan: 'top' })
    assert.strictEqual(res.mock, true)
    assert.strictEqual(res.demoOnly, true)
    assert.strictEqual(res.order.status, 'mock_paid')
    assert.notStrictEqual(res.order.status, 'paid')
    const notice = store.notices.find((n) => n.id === created.id)
    assert.strictEqual(notice.status, 'pending', '付费不得绕过审核')
    assert.strictEqual(pkgBefore, 'free')
    assert.strictEqual(notice.plan, 'top')
  })

  await it('下单后仍不进入公开列表', async () => {
    const res = await api.getNoticeList({})
    assert.strictEqual(res.list.some((item) => item.id === created.id), false)
  })

  await it('订单金额与套餐配置一致', async () => {
    const order = store.noticeOrders.find((o) => o.noticeId === created.id)
    const pkg = dict.noticePackages.find((item) => item.value === 'top')
    assert.strictEqual(order.amount, pkg.price)
    assert.strictEqual(order.days, pkg.days)
    assert.strictEqual(order.mock, true)
    assert.strictEqual(order.payMode, 'demo')
  })

  await it('不能重复购买同一公告的推广套餐', async () => {
    await assert.rejects(api.createNoticeOrder({ noticeId: created.id, plan: 'featured' }))
  })

  await it('不能为别人的公告下单', async () => {
    await assert.rejects(api.createNoticeOrder({ noticeId: 'nt2', plan: 'top' }))
  })

  await it('免费套餐不产生订单', async () => {
    const before = store.noticeOrders.length
    const res = await api.createNoticeOrder({ noticeId: created.id, plan: 'free' })
    assert.strictEqual(res.order, null)
    assert.strictEqual(res.demoOnly, true)
    assert.strictEqual(store.noticeOrders.length, before)
  })

  await it('已通过审核的公告购买后获得置顶标识并排到最前', async () => {
    const res = await api.createNoticeOrder({ noticeId: 'nt4', plan: 'top' })
    assert.strictEqual(res.order.plan, 'top')
    const detail = await api.getNoticeDetail('nt4')
    assert.strictEqual(detail.badgeText, '置顶')
    const listNow = await api.getNoticeList({})
    assert.strictEqual(listNow.list[0].id, 'nt1', '同为置顶时按发布时间倒序')
    assert.ok(listNow.list.slice(0, 2).every((item) => item.badgeText === '置顶'))
  })

  console.log('\n[7] 联系发布者')
  await it('复用现有会话能力联系发布者', async () => {
    const res = await api.contactNoticePublisher('nt1')
    assert.ok(res.conversationId)
    assert.ok(res.peerName)
    const second = await api.contactNoticePublisher('nt1')
    assert.strictEqual(second.conversationId, res.conversationId, '会话应当幂等复用')
  })

  await it('不能联系自己的公告', async () => {
    await assert.rejects(api.contactNoticePublisher(created.id))
  })

  await it('已过展示期的公告无法联系', async () => {
    await assert.rejects(api.contactNoticePublisher('nt7'))
  })

  console.log('\n[8] 排序确定性')
  await it('同一时间戳按 id 升序兜底，多次调用顺序一致', () => {
    const fake = [
      { id: 'nc', status: 'approved', startAt: 1, endAt: Date.now() + DAY, createdAt: 100, plan: 'free' },
      { id: 'na', status: 'approved', startAt: 1, endAt: Date.now() + DAY, createdAt: 100, plan: 'free' },
      { id: 'nb', status: 'approved', startAt: 1, endAt: Date.now() + DAY, createdAt: 100, plan: 'free' },
    ]
    const first = noticeApi.sortNotices(fake, [], Date.now()).map((i) => i.id)
    const second = noticeApi.sortNotices(fake.slice().reverse(), [], Date.now()).map((i) => i.id)
    assert.deepStrictEqual(first, ['na', 'nb', 'nc'])
    assert.deepStrictEqual(first, second)
  })

  await it('手机号在联系方式中被打码', () => {
    assert.strictEqual(noticeApi.maskContact('电话 13800001234'), '电话 138****1234')
    assert.strictEqual(noticeApi.maskContact('微信 abc'), '微信 abc')
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
