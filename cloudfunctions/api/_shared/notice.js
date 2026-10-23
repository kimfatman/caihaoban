/**
 * 公告牌的纯函数模块。
 *
 * 这里只做「判定与排序」，不读写 store、不依赖 api，
 * 因此筛选规则、有效期、付费优先条件都可以被单测直接覆盖，
 * 接入真实后端时也可以原样搬到服务端复用。
 */
const dict = require('./dict')

const DAY = 24 * 3600 * 1000

/** 取套餐配置（价格为 0 表示免费） */
function packageOf(plan) {
  return dict.noticePackages.find((item) => item.value === plan) || dict.noticePackages[0]
}

/** 展示期是否有效：状态为已通过，且 now 落在 [startAt, endAt] 内 */
function isWithinPeriod(notice, ts) {
  if (!notice) return false
  if (notice.status !== dict.noticePublicStatus) return false
  if (!notice.startAt || !notice.endAt) return false
  return ts >= notice.startAt && ts <= notice.endAt
}

/**
 * 付费优先是否成立。
 * 四个条件缺一不可：公告关联了订单、订单已支付（Mock 为 mock_paid）、
 * 订单未过期、订单套餐与公告套餐一致。
 */
function paidOrderOf(notice, orders, ts) {
  if (!notice || !notice.orderId) return null
  const order = (orders || []).find((item) => item.id === notice.orderId && item.noticeId === notice.id)
  if (!order) return null
  if (order.status !== 'mock_paid') return null
  if (!order.expireAt || ts > order.expireAt) return null
  if (order.plan !== notice.plan) return null
  return order
}

/** 排序优先级：只有「有效期内 + 有效付费订单」才享受加权，否则按普通公告处理 */
function priorityOf(notice, orders, ts) {
  if (!isWithinPeriod(notice, ts)) return 0
  const pkg = packageOf(notice.plan)
  if (!pkg.priority) return 0
  return paidOrderOf(notice, orders, ts) ? pkg.priority : 0
}

/**
 * 列表排序：付费优先 → 发布时间倒序 → id 升序兜底。
 * 兜底保证同分同时间时顺序稳定，翻页与刷新不会抖动。
 */
function sortNotices(list, orders, ts) {
  return list.slice().sort((a, b) => {
    const pa = priorityOf(a, orders, ts)
    const pb = priorityOf(b, orders, ts)
    if (pa !== pb) return pb - pa
    if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

/** 公开列表只保留展示期内的公告 */
function filterPublic(list, ts) {
  return list.filter((item) => isWithinPeriod(item, ts))
}

/** 关键词命中标题或正文 */
function matchesKeyword(notice, keyword) {
  const kw = String(keyword || '').trim()
  if (!kw) return true
  return notice.title.indexOf(kw) >= 0 || notice.content.indexOf(kw) >= 0
}

function matchesCategory(notice, category) {
  return !category || notice.category === category
}

/** 当前应当展示的状态：approved 但已过展示期的降级为 expired */
function deriveStatus(notice, ts) {
  if (!notice) return ''
  if (notice.status !== 'approved') return notice.status
  if (!notice.endAt || ts > notice.endAt) return 'expired'
  return 'approved'
}

/** 列表/详情统一使用的角标：置顶 > 推广 > 无，且必须满足付费优先条件 */
function badgeOf(notice, orders, ts) {
  const priority = priorityOf(notice, orders, ts)
  if (!priority) return { text: '', tag: '' }
  const pkg = packageOf(notice.plan)
  return { text: pkg.badge || '', tag: pkg.tag || 'tag-plain' }
}

/** 展示期剩余天数（向上取整，过期返回 0） */
function remainDays(notice, ts) {
  if (!notice || !notice.endAt || ts > notice.endAt) return 0
  return Math.ceil((notice.endAt - ts) / DAY)
}

/** 把 11 位手机号打码，非手机号文本原样返回（联系方式默认不直接展示） */
function maskContact(contact) {
  const text = String(contact || '')
  if (!text) return ''
  return text.replace(/\d{11}/g, (num) => `${num.slice(0, 3)}****${num.slice(7)}`)
}

/**
 * 发布表单校验：返回错误文案，空串表示通过。
 * 放在纯函数里，接口层只负责 assert，页面可复用做即时提示。
 */
function validateNotice(payload) {
  const body = payload || {}
  const title = String(body.title || '').trim()
  const content = String(body.content || '').trim()
  if (title.length < 6) return '公告标题至少 6 个字'
  if (title.length > 40) return '公告标题不超过 40 个字'
  if (content.length < 20) return '公告正文至少 20 个字'
  if (content.length > 1000) return '公告正文不超过 1000 字'
  if (!dict.noticeCategories.some((item) => item.value === body.category)) return '请选择公告分类'
  const region = String(body.region || '').trim()
  if (region && !dict.regions.some((item) => item.name === region)) return '合作地区不在支持范围内'
  const contact = String(body.contact || '').trim()
  if (contact.length > 60) return '联系方式不超过 60 个字'
  return ''
}

module.exports = {
  DAY,
  packageOf,
  isWithinPeriod,
  paidOrderOf,
  priorityOf,
  sortNotices,
  filterPublic,
  matchesKeyword,
  matchesCategory,
  deriveStatus,
  badgeOf,
  remainDays,
  maskContact,
  validateNotice,
}
