/**
 * 接单人推荐算法（纯函数模块）。
 *
 * 设计原则：
 * 1. 只做「硬条件筛选 + 加权评分排序」，不访问 store / wx，方便单元测试；
 * 2. 真实部署时同一套规则必须放在服务端执行，前端不参与打分，
 *    更不能把前端传入的分数当作排序依据；
 * 3. 缺失数据一律使用中性分，不把「暂无记录」当成「表现差」；
 * 4. 结果排序包含稳定的 tie-breaker，保证刷新后不会无原因抖动。
 */
const dict = require('./dict')

/** 综合评分权重，合计为 1 */
const WEIGHTS = {
  business: 0.35,
  areaMode: 0.25,
  history: 0.2,
  budget: 0.1,
  capacity: 0.1,
}

/**
 * 现场办理关键词。
 * 命中即认为任务必须到场，此时「仅线上服务」或异地服务者不能承接，
 * 避免把线上能力无条件套用到需要实地办理的业务上。
 */
const ONSITE_PATTERN = /现场|实地|上门|驻场|面签|到店|外勤|跑腿|盘点|盘查|抽查|核验|函证/

/** 档案完整度评估字段 */
const REQUIRED_FIELDS = ['businessTypes', 'areas', 'serviceMode', 'orderStatus', 'monthlyCapacity', 'quoteMode']
const OPTIONAL_FIELDS = ['qualifications', 'yearsOfExperience', 'intro']

const CAPACITY_MAX = { '1-4': 4, '5-10': 10, '10+': 30 }
const CAPACITY_SCORE = { '1-4': 0.5, '5-10': 0.8, '10+': 1 }

const clamp01 = (n) => {
  const num = Number(n)
  if (!isFinite(num)) return 0
  return Math.min(1, Math.max(0, num))
}

const round = (n, digits) => Number(Number(n).toFixed(digits === undefined ? 4 : digits))

function unique(list) {
  return list.filter((item, index) => item && list.indexOf(item) === index)
}

function isFilled(value) {
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'number') return value > 0
  return !!String(value === undefined || value === null ? '' : value).trim()
}

function regionParts(region) {
  return String(region || '')
    .split('/')
    .filter(Boolean)
}

/**
 * 任务是否需要现场办理。
 * 优先采用发布方显式声明的 onsiteRequired，未声明时按关键词推断。
 */
function deriveOnsiteRequired(task) {
  const source = task || {}
  if (typeof source.onsiteRequired === 'boolean') return source.onsiteRequired
  const text = [source.address, source.description, (source.requirements || []).join(' ')]
    .filter(Boolean)
    .join(' ')
  return ONSITE_PATTERN.test(text)
}

/**
 * 地区匹配。
 * 档案 areas 条目为 { province, city }，city 为空串表示「全省服务」。
 * 目前字典为省 / 市两级（直辖市的区作为第二级），因此匹配按最长前缀进行，
 * 后续补充区县层时该函数无需修改。
 */
function matchArea(areas, region) {
  const parts = regionParts(region)
  const province = parts[0] || ''
  const city = parts[1] || ''
  let best = { level: 'none', score: 0, label: '' }
  ;(areas || []).forEach((area) => {
    if (!area || area.province !== province) return
    if (area.city && area.city === city) {
      if (best.score < 1) best = { level: 'city', score: 1, label: `${city}本地服务` }
      return
    }
    if (!area.city && best.score < 0.9) {
      best = { level: 'province', score: 0.9, label: `${province}全省覆盖` }
    }
  })
  return best
}

/** 服务方式匹配：需现场时仅线上直接不合格 */
function matchServiceMode(serviceMode, onsiteRequired) {
  if (onsiteRequired) {
    if (serviceMode === 'online') {
      return { ok: false, score: 0, reason: '' }
    }
    return { ok: true, score: 1, reason: '可现场办理' }
  }
  if (serviceMode === 'onsite') {
    return { ok: true, score: 0.7, reason: '仅线下服务' }
  }
  return { ok: true, score: 1, reason: serviceMode === 'online' ? '可线上服务' : '线上线下均可' }
}

/**
 * 地区 + 服务方式综合评估。
 * 硬条件：地区不匹配「且」无法远程承接时淘汰。
 * 需现场办理的任务不允许用线上能力跨地区兜底。
 */
function evaluateAreaMode(profile, task, onsiteRequired, relaxed) {
  const area = matchArea(profile.areas, task.region)
  const mode = matchServiceMode(profile.serviceMode, onsiteRequired)
  const onlineViable =
    !onsiteRequired && (profile.serviceMode === 'online' || profile.serviceMode === 'both')

  // 需现场办理但只能线上：即使地区命中也不可承接
  if (!mode.ok && !relaxed) {
    return { ok: false, reject: '任务需现场办理，但该服务者仅支持线上' }
  }
  // 地区不匹配且无法远程承接
  if (!area.score && !onlineViable && !relaxed) {
    return {
      ok: false,
      reject: onsiteRequired ? '任务需现场办理且不在服务地区' : '服务地区不匹配且无法线上承接',
    }
  }

  const areaPart = area.score || (relaxed ? 0.2 : 0.45)
  const modePart = mode.ok ? mode.score : relaxed ? 0.3 : 0
  const reasons = []
  if (area.score) {
    reasons.push(area.label)
    if (mode.ok) reasons.push(mode.reason)
  } else if (onlineViable) {
    reasons.push('可远程承接')
  } else if (relaxed) {
    reasons.push('服务地区待确认')
  }
  if (!mode.ok && relaxed) reasons.push('需确认能否到场')
  return {
    ok: true,
    score: clamp01(0.6 * areaPart + 0.4 * modePart),
    reasons,
    // 只有放宽模式下的条件缺失才作为「需人工确认」的提示
    relaxedMiss: !!relaxed && (!area.score || !mode.ok),
  }
}

/** 业务匹配：通过硬条件后，用该业务的历史承接量区分深度 */
function evaluateBusiness(profile, stats, task) {
  if ((profile.businessTypes || []).indexOf(task.serviceType) < 0) {
    return { ok: false, reject: '业务类型不符' }
  }
  const sameType = (stats && stats.completedByType && stats.completedByType[task.serviceType]) || 0
  return { ok: true, score: clamp01(0.6 + 0.4 * Math.min(1, sameType / 3)) }
}

/**
 * 历史履约表现。
 * 完全无记录 → 0.5 中性分，并显式标注「暂无历史记录」，
 * 与「有记录但评分低」区分开，避免新用户被判为低质量。
 */
function evaluateHistory(stats) {
  const completed = (stats && stats.completed) || 0
  const reviewCount = (stats && stats.reviewCount) || 0
  if (!completed && !reviewCount) {
    return { score: 0.5, text: '暂无历史记录', neutral: true }
  }
  const countScore = Math.min(1, completed / 5)
  const ratingScore = reviewCount > 0 ? clamp01((stats.ratingAvg - 1) / 4) : 0.6
  const score = 0.5 * (0.5 + 0.5 * countScore) + 0.5 * ratingScore
  const text =
    reviewCount > 0
      ? `完成 ${completed} 单 · ${Number(stats.ratingAvg).toFixed(1)} 分`
      : `完成 ${completed} 单 · 暂无评价`
  return { score: clamp01(score), text, neutral: false }
}

/** 预算与报价匹配：有历史成交价时按偏差归一化，无数据时取中性分 */
function evaluateBudget(profile, stats, task) {
  const ref = Number(task.referencePrice) || 0
  const mode = profile.quoteMode
  if (!ref) {
    return { score: mode === 'negotiable' ? 1 : 0.8, text: mode === 'negotiable' ? '接受面议' : '任务未设预算' }
  }
  let base = 0.5
  let text = '暂无历史成交价'
  const avgPrice = (stats && stats.avgPrice) || 0
  if (avgPrice > 0) {
    const ratio = Math.abs(avgPrice - ref) / ref
    base = clamp01(1 - ratio)
    text = ratio <= 0.2 ? '历史报价接近预算' : ratio <= 0.5 ? '历史报价与预算略有差距' : '历史报价与预算差距较大'
  }
  const factor = mode === 'fixed' ? 1 : mode === 'project' ? 0.98 : 0.95
  return { score: clamp01(base * factor), text }
}

/** 接单能力与当前负载 */
function evaluateCapacity(profile, load) {
  const capScore = CAPACITY_SCORE[profile.monthlyCapacity]
  const max = CAPACITY_MAX[profile.monthlyCapacity] || 4
  const activeOrders = (load && load.activeOrders) || 0
  const loadScore = clamp01(1 - activeOrders / max)
  const score = 0.5 * (capScore === undefined ? 0.5 : capScore) + 0.5 * loadScore
  return { score: clamp01(score), text: activeOrders > 0 ? `在途 ${activeOrders} 单` : '当前无在途订单' }
}

/** 档案完整度：必填 6 项占 70%，可选 3 项占 30% */
function profileCompleteness(profile) {
  if (!profile) return 0
  const required = REQUIRED_FIELDS.filter((key) => isFilled(profile[key])).length / REQUIRED_FIELDS.length
  const optional = OPTIONAL_FIELDS.filter((key) => isFilled(profile[key])).length / OPTIONAL_FIELDS.length
  return clamp01(required * 0.7 + optional * 0.3)
}

/**
 * 单个候选人的评估。
 * 返回 { ok: false, reject } 表示被硬条件淘汰；否则返回评分明细。
 */
function scoreProvider(input) {
  const profile = input.profile || {}
  const task = input.task || {}
  const stats = input.stats || {}
  const load = input.load || {}
  const relaxed = !!input.relaxed
  const onsiteRequired = deriveOnsiteRequired(task)
  const flags = []

  // 1. 接单状态：暂不接单直接排除（放宽模式下降级为提示）
  if (profile.orderStatus !== 'accepting') {
    if (!relaxed) return { ok: false, reject: '暂不接单' }
    flags.push('当前暂不接单')
  }

  // 2. 业务类型
  const business = evaluateBusiness(profile, stats, task)
  if (!business.ok) return { ok: false, reject: business.reject }

  // 3. 地区与服务方式
  const areaMode = evaluateAreaMode(profile, task, onsiteRequired, relaxed)
  if (!areaMode.ok) return { ok: false, reject: areaMode.reject }
  if (areaMode.relaxedMiss) flags.push('需确认能否到场')

  // 4. 必要资质：任何一项不满足都不可进入推荐名单
  const required = task.requiredQualifications || []
  const owned = profile.qualifications || []
  const missing = required.filter((item) => owned.indexOf(item) < 0)
  if (missing.length) {
    return { ok: false, reject: `缺少${dict.labelOf(dict.qualifications, missing[0])}` }
  }

  // 5. 综合评分
  const history = evaluateHistory(stats)
  const budget = evaluateBudget(profile, stats, task)
  const capacity = evaluateCapacity(profile, load)
  const base =
    WEIGHTS.business * business.score +
    WEIGHTS.areaMode * areaMode.score +
    WEIGHTS.history * history.score +
    WEIGHTS.budget * budget.score +
    WEIGHTS.capacity * capacity.score

  const completeness = profileCompleteness(profile)
  // 资料不完整只降权，不排除：完整度 0 → ×0.75，完整度 1 → ×1
  const score = clamp01(base * (0.75 + 0.25 * completeness))

  const reasons = ['业务匹配']
    .concat(areaMode.reasons)
    .concat(required.length ? ['资质符合'] : [])
    .concat(history.text ? [history.text] : [])

  return {
    ok: true,
    score: round(score),
    completeness: round(completeness),
    onsiteRequired,
    parts: {
      business: round(business.score, 3),
      areaMode: round(areaMode.score, 3),
      history: round(history.score, 3),
      budget: round(budget.score, 3),
      capacity: round(capacity.score, 3),
    },
    reasons: unique(reasons).slice(0, 4),
    flags,
  }
}

/** 稳定排序：综合分 → 完整度 → userId 字典序 */
function compareProvider(a, b) {
  if (b.score !== a.score) return b.score - a.score
  if (b.completeness !== a.completeness) return b.completeness - a.completeness
  if (a.userId === b.userId) return 0
  return a.userId < b.userId ? -1 : 1
}

/** 批量评估并排序，附带 rank（从 1 开始） */
function rankProviders(items) {
  const passed = []
  const rejected = []
  items.forEach((item) => {
    const result = scoreProvider(item)
    if (result.ok) passed.push(Object.assign({}, item, result))
    else rejected.push({ userId: item.userId, reason: result.reject })
  })
  passed.sort(compareProvider)
  return {
    list: passed.map((item, index) => Object.assign({}, item, { rank: index + 1 })),
    rejected,
  }
}

/**
 * 任务对某个接单人的匹配度。
 * 五个维度与接单人侧保持一致，只是「业务匹配度」改为按该用户的历史承接深度。
 */
function scoreTask(input) {
  const profile = input.profile || {}
  const stats = input.stats || {}
  const load = input.load || {}
  const task = input.task || {}
  const onsiteRequired = deriveOnsiteRequired(task)

  if ((profile.businessTypes || []).indexOf(task.serviceType) < 0) {
    return { ok: false, reject: '业务类型不符' }
  }
  const areaMode = evaluateAreaMode(profile, task, onsiteRequired, false)
  if (!areaMode.ok) return { ok: false, reject: areaMode.reject }

  const required = task.requiredQualifications || []
  const owned = profile.qualifications || []
  const missing = required.filter((item) => owned.indexOf(item) < 0)
  if (missing.length) {
    return { ok: false, reject: `缺少${dict.labelOf(dict.qualifications, missing[0])}` }
  }

  const sameType = (stats.completedByType && stats.completedByType[task.serviceType]) || 0
  const businessScore = clamp01(0.7 + 0.3 * Math.min(1, sameType / 3))
  const history = evaluateHistory(stats)
  const budget = evaluateBudget(profile, stats, task)
  const capacity = evaluateCapacity(profile, load)

  const base =
    WEIGHTS.business * businessScore +
    WEIGHTS.areaMode * areaMode.score +
    WEIGHTS.history * history.score +
    WEIGHTS.budget * budget.score +
    WEIGHTS.capacity * capacity.score
  const completeness = profileCompleteness(profile)
  const score = clamp01(base * (0.75 + 0.25 * completeness))

  const reasons = ['符合擅长业务']
    .concat(areaMode.reasons)
    .concat(required.length ? ['资质符合'] : [])
    .concat(budget.text === '任务未设预算' ? [] : [budget.text])

  return {
    ok: true,
    score: round(score),
    onsiteRequired,
    reasons: unique(reasons).slice(0, 3),
  }
}

/** 任务列表排序：best / latest / budget，均带稳定 tie-breaker */
function sortTasks(list, sort) {
  const items = list.slice()
  if (sort === 'latest') {
    items.sort((a, b) => {
      if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
    return items
  }
  if (sort === 'budget') {
    items.sort((a, b) => {
      const pa = Number(a.referencePrice) || 0
      const pb = Number(b.referencePrice) || 0
      if (pb !== pa) return pb - pa
      if (b.score !== a.score) return b.score - a.score
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
    return items
  }
  items.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
  return items
}

/** 批量评估任务（已由调用方完成状态与权限过滤） */
function rankTasks(items) {
  const passed = []
  const rejected = []
  items.forEach((item) => {
    const result = scoreTask(item)
    if (result.ok) passed.push(Object.assign({}, item, result))
    else rejected.push({ taskId: item.task.id, reason: result.reject })
  })
  return { list: passed, rejected }
}

module.exports = {
  WEIGHTS,
  deriveOnsiteRequired,
  matchArea,
  matchServiceMode,
  evaluateAreaMode,
  evaluateBusiness,
  evaluateHistory,
  evaluateBudget,
  evaluateCapacity,
  profileCompleteness,
  scoreProvider,
  rankProviders,
  scoreTask,
  rankTasks,
  sortTasks,
}
