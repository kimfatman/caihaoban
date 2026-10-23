/**
 * 接口层（Mock 实现）。
 * 所有页面只通过本文件访问数据；真实环境只需把 run() 内的实现替换为 wx.request，
 * 接口签名、权限校验点与返回结构保持不变。业务接口的服务端权限校验点已在下方逐条标注。
 */
const store = require('./store')
const auth = require('./auth')
const dict = require('./dict')
const util = require('./util')
const recommend = require('./recommend')
const noticeApi = require('./notice')

const CURRENT = store.CURRENT_USER_ID
let seq = 2000
let currentOrgId = 'o1'

const nextId = (prefix) => `${prefix}${++seq}`
const now = () => Date.now()

/** 模拟网络与事务：fn 内的同步异常统一转为 Promise reject */
function run(fn, ms = 120) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const data = fn()
        resolve(data === undefined ? null : util.clone(data))
      } catch (err) {
        reject(err)
      }
    }, ms)
  })
}

function assert(condition, message) {
  if (!condition) {
    const err = new Error(message)
    err.friendly = true
    throw err
  }
}

function findOrThrow(list, id, label) {
  const hit = list.find((item) => item.id === id)
  assert(hit, `${label}不存在或已被删除`)
  return hit
}

function userOf(id) {
  return store.users.find((item) => item.id === id) || { nickname: '未知用户', phone: '' }
}

function log(action, target, detail) {
  store.auditLogs.unshift({
    id: nextId('al'),
    at: now(),
    actorId: CURRENT,
    actorName: userOf(CURRENT).nickname,
    action,
    target,
    detail,
    ip: '10.20.31.6',
  })
}

function pushMessage(type, title, content, bizId, bizType) {
  store.messages.unshift({
    id: nextId('msg'),
    type,
    title,
    content,
    bizId,
    bizType,
    createdAt: now(),
    read: false,
  })
}

/* ------------------------------------------------------------------ */
/* 私聊：会话标识与未读数                                              */
/* ------------------------------------------------------------------ */

const CHAT_BIZ_LABEL = { task: '来自任务', quote: '来自报价', order: '来自订单', none: '' }

/** 会话中「对方」的用户 ID */
function peerIdOf(conversation) {
  return conversation.memberIds.find((id) => id !== CURRENT) || CURRENT
}

/** 会话中对方发给我的未读条数 */
function unreadCountOf(conversation) {
  return (conversation.messages || []).filter((item) => item.fromId !== CURRENT && !item.read).length
}

/** 用户所属的第一个机构简称（展示用） */
function orgShortNameOf(userId) {
  const member = store.members.find((item) => item.userId === userId && item.status === 'active')
  if (!member) return ''
  const org = store.orgs.find((item) => item.id === member.orgId)
  return org ? org.shortName || org.name : ''
}

/** 我可见（参与）的会话 */
function myConversations() {
  return store.conversations.filter((item) => item.memberIds.includes(CURRENT))
}

/**
 * QQ 头像式的角标标签：圆形小徽章叠在头像右下角。
 * 实名认证 → 蓝色 ✓；机构已认证 → 绿色「企 / 店」；未认证 → 灰色 !。
 */
function avatarTags(user, org) {
  const tags = []
  if (user.idVerified) tags.push({ key: 'realname', text: '✓', type: 'primary' })
  if (org) {
    tags.push(
      org.status === 'verified'
        ? { key: 'org', text: org.type === 'store' ? '店' : '企', type: 'success' }
        : { key: 'org', text: '!', type: 'plain' }
    )
  }
  return tags
}

/** 统一的「人」视图：头像 + 姓名 + 所属机构 + 认证角标 */
function userAvatar(userId, orgId) {
  const user = userOf(userId)
  const org = orgId
    ? store.orgs.find((item) => item.id === orgId)
    : store.members
        .filter((item) => item.userId === userId && item.status === 'active')
        .map((item) => store.orgs.find((o) => o.id === item.orgId))
        .filter(Boolean)[0] || null
  return {
    ...util.avatarView(user, userId),
    userId,
    name: user.nickname,
    title: user.title || '',
    orgId: org ? org.id : '',
    orgName: org ? org.shortName || org.name : '',
    orgType: org ? org.type : '',
    orgTypeText: org ? (org.type === 'store' ? '门店' : '企业') : '',
    orgStatus: org ? org.status : '',
    orgStatusLabel: !org
      ? ''
      : org.status === 'verified'
      ? '已认证'
      : org.status === 'pending'
      ? '审核中'
      : '未通过',
    tags: avatarTags(user, org),
  }
}

/** 会话标题按业务对象反查，避免由前端拼接（含特殊字符）文案 */
function chatSubjectOf(bizType, bizId, fallback) {
  if (bizType === 'task') {
    const task = store.tasks.find((item) => item.id === bizId)
    return task ? task.title : fallback
  }
  if (bizType === 'quote') {
    const quote = store.quotes.find((item) => item.id === bizId)
    const task = quote ? store.tasks.find((item) => item.id === quote.taskId) : null
    return task ? task.title : fallback
  }
  if (bizType === 'order') {
    const order = store.orders.find((item) => item.id === bizId)
    return order ? order.taskTitle : fallback
  }
  return fallback
}

function noticeUnreadCount() {
  return store.messages.filter((item) => !item.read).length
}

function chatUnreadCount() {
  return myConversations().reduce((sum, item) => sum + unreadCountOf(item), 0)
}

/* ------------------------------------------------------------------ */
/* 会话与字典                                                          */
/* ------------------------------------------------------------------ */

function buildSession() {
  const user = userOf(CURRENT)
  const memberships = auth.memberships(CURRENT)
  const unread = noticeUnreadCount() + chatUnreadCount()
  return {
    user: {
      ...user,
      phoneMasked: util.maskPhone(user.phone),
    },
    memberships,
    currentOrgId,
    currentOrg: memberships.find((item) => item.orgId === currentOrgId) || memberships[0] || null,
    unread,
    permissions: auth.permissionsIn(CURRENT, currentOrgId),
  }
}

function getSession() {
  return run(() => buildSession(), 40)
}

function switchOrg(orgId) {
  return run(() => {
    assert(auth.isMember(CURRENT, orgId), '你不是该机构成员')
    currentOrgId = orgId
    return buildSession()
  }, 60)
}

/* ------------------------------------------------------------------ */
/* 任务                                                                */
/* ------------------------------------------------------------------ */

function taskState(task) {
  if (task.cancelledAt) return 'cancelled'
  if (task.dealQuoteId) return task.closedAt ? 'closed' : 'dealing'
  if (task.quoteDeadline <= now()) return 'expired'
  return 'open'
}

function quoteCountOf(taskId) {
  return store.quotes.filter((item) => item.taskId === taskId && ['pending', 'accepted'].includes(item.status)).length
}

/**
 * 发布人「认证能力」标识：实名认证 + 所属机构认证。
 * 服务端统一判定，页面只负责渲染，避免各端口径不一致。
 */
function publisherCapability(publisher, org) {
  const tags = []
  if (publisher.idVerified) {
    tags.push({ key: 'realname', label: '实名认证', level: 'high' })
  } else {
    tags.push({ key: 'realname', label: '未实名', level: 'low' })
  }
  const orgTypeText = org.type === 'store' ? '门店' : '企业'
  if (org.status === 'verified') {
    tags.push({ key: 'org', label: `${orgTypeText}认证`, level: 'high' })
  } else if (org.status === 'pending') {
    tags.push({ key: 'org', label: `${orgTypeText}审核中`, level: 'mid' })
  } else {
    tags.push({ key: 'org', label: `${orgTypeText}未认证`, level: 'low' })
  }
  // 双认证通过才视为「可信发布方」，用于头像角标与列表强调
  const solid = !!publisher.idVerified && org.status === 'verified'
  const level = solid ? 'high' : publisher.idVerified ? 'mid' : 'none'
  return {
    tags,
    level,
    levelLabel: solid ? '实名 + 机构双认证' : publisher.idVerified ? '已实名认证' : '未实名认证',
    solid,
  }
}

/**
 * 任务卡标签区：业务分类 + 由真实数据派生的任务属性。
 * type 决定样式：plain 中性灰（业务分类/普通属性）、accent 强调（紧急）。
 * 全部来自任务自身字段，不做无中生有的展示。
 */
function taskTags(task, state, quoteCount) {
  const tags = [{ key: 'service', label: dict.labelOf(dict.serviceTypes, task.serviceType), type: 'plain' }]
  if (/可远程/.test(task.address || '')) tags.push({ key: 'remote', label: '可远程', type: 'plain' })
  const attachments = task.attachments || []
  if (attachments.length) tags.push({ key: 'attach', label: `${attachments.length} 个附件`, type: 'plain' })
  const requirements = task.requirements || []
  if (requirements.length) tags.push({ key: 'req', label: `${requirements.length} 项要求`, type: 'plain' })
  if (quoteCount > 0) tags.push({ key: 'quote', label: `${quoteCount} 条报价`, type: 'plain' })
  if (state === 'open' && task.quoteDeadline > now() && task.quoteDeadline - now() < util.DAY) {
    tags.push({ key: 'urgent', label: '即将截止', type: 'accent' })
  }
  return tags
}

function decorateTask(task) {
  const state = taskState(task)
  const publisher = userOf(task.publisherUserId)
  const org = store.orgs.find((item) => item.id === task.publisherOrgId) || {}
  const capability = publisherCapability(publisher, org)
  const quoteCount = quoteCountOf(task.id)
  const quoteDeadline = new Date(task.quoteDeadline)
  return {
    ...task,
    state,
    stateLabel: dict.labelOf(dict.taskStatus, state),
    stateTag: dict.tagOf(dict.taskStatus, state),
    serviceTypeLabel: dict.labelOf(dict.serviceTypes, task.serviceType),
    regionText: (task.region || '').split('/').filter(Boolean).join(' · '),
    regionCityText: util.shortCity(task.region),
    cityText: (task.region || '').split('/')[2] || (task.region || '').split('/')[1] || '',
    referencePriceText: task.referencePrice ? `¥${util.money(task.referencePrice)}` : '面议',
    quoteDeadlineText: util.formatDate(task.quoteDeadline, true),
    expectedFinishText: util.formatDate(task.expectedFinishAt),
    countdown: state === 'open' ? util.countdown(task.quoteDeadline) : '',
    quoteDeadlineDate: util.formatDate(task.quoteDeadline),
    quoteDeadlineTime: `${String(quoteDeadline.getHours()).padStart(2, '0')}:${String(
      quoteDeadline.getMinutes()
    ).padStart(2, '0')}`,
    quoteCount,
    tags: taskTags(task, state, quoteCount),
    /** 身份行认证图标的简短文案，避免把多个认证胶囊堆在头像旁 */
    publisherVerifiedText: capability.solid ? '双认证' : publisher.idVerified ? '已实名' : '未认证',
    /** 工作量：由「发布 → 期望完成」的跨度派生，无则为空 */
    workloadText:
      task.expectedFinishAt > task.createdAt
        ? `周期 ${Math.max(1, Math.round((task.expectedFinishAt - task.createdAt) / util.DAY))} 天`
        : '',
    /** 是否必须现场办理：影响推荐时能否用「线上服务」跨地区兜底 */
    onsiteRequired: recommend.deriveOnsiteRequired(task),
    onsiteText: recommend.deriveOnsiteRequired(task) ? '需现场办理' : '可远程办理',
    requiredQualifications: task.requiredQualifications || [],
    requiredQualificationLabels: (task.requiredQualifications || []).map((item) =>
      dict.labelOf(dict.qualifications, item)
    ),
    isPublisher: task.publisherUserId === CURRENT,
    isMyOrgTask: auth.orgIdsOf(CURRENT).includes(task.publisherOrgId),
    canChat: task.publisherUserId !== CURRENT,
    publisherName: publisher.nickname,
    publisherTitle: publisher.title || '',
    publisherAvatar: userAvatar(task.publisherUserId, task.publisherOrgId),
    publisherAvatarText: util.initials(publisher.nickname),
    publisherAvatarTone: util.avatarTone(task.publisherUserId),
    publisherCapabilityTags: capability.tags,
    publisherCapabilityLevel: capability.level,
    publisherCapabilityLabel: capability.levelLabel,
    publisherSolid: capability.solid,
    publishedAtText: util.fromNow(task.createdAt),
    publisherOrgName: org.name || org.shortName || '',
    publisherOrgShortName: org.shortName || org.name || '',
    publisherOrgStatus: org.status || 'pending',
    publisherOrgStatusLabel:
      org.status === 'verified' ? '已认证' : org.status === 'pending' ? '审核中' : '未通过',
    publisherOrgType: org.type === 'store' ? '门店' : '企业',
    canQuote: state === 'open' && !auth.orgIdsOf(CURRENT).includes(task.publisherOrgId),
    canManage: state === 'open' && auth.can(task.publisherOrgId, CURRENT, 'task:manage'),
    cancelledText: task.cancelledAt ? util.formatDate(task.cancelledAt, true) : '',
    attachments: task.attachments || [],
    requirements: task.requirements || [],
  }
}

function getTaskList(params = {}) {
  return run(() => {
    const { keyword = '', city = '', serviceType = '', status = '', mine = false } = params
    const kw = keyword.trim()
    let list = store.tasks.slice()
    if (mine) {
      const myOrgs = auth.orgIdsOf(CURRENT)
      list = list.filter((item) => myOrgs.includes(item.publisherOrgId))
    }
    if (kw) {
      list = list.filter(
        (item) =>
          item.title.includes(kw) ||
          item.description.includes(kw) ||
          (item.region || '').includes(kw)
      )
    }
    if (city) list = list.filter((item) => (item.region || '').includes(city))
    if (serviceType) list = list.filter((item) => item.serviceType === serviceType)
    if (status) list = list.filter((item) => taskState(item) === status)
    return list
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((item) => decorateTask(item))
  })
}

function getTaskDetail(taskId) {
  return run(() => {
    const task = findOrThrow(store.tasks, taskId, '任务')
    const detail = decorateTask(task)
    const isDemander = auth.orgIdsOf(CURRENT).includes(task.publisherOrgId)
    // 需求方查看全部报价；报价方只能看到本机构提交的报价
    const myQuote = !isDemander
      ? store.quotes.find(
          (item) => item.taskId === taskId && auth.orgIdsOf(CURRENT).includes(item.orgId) && item.userId === CURRENT
        )
      : null
    const orgQuote = !isDemander
      ? store.quotes.find((item) => item.taskId === taskId && auth.orgIdsOf(CURRENT).includes(item.orgId))
      : null
    return {
      ...detail,
      attachments: (task.attachments || []).map((file) => ({
        ...file,
        url: '',
      })),
      myQuoteId: myQuote ? myQuote.id : '',
      orgQuoteId: orgQuote ? orgQuote.id : '',
      quoteStatusText: orgQuote ? dict.labelOf(dict.quoteStatus, orgQuote.status) : '',
      auditTrail: (task.audit || []).map((item) => ({ ...item, atText: util.formatDate(item.at, true) })),
      canViewQuotes: isDemander && auth.can(task.publisherOrgId, CURRENT, 'quote:accept'),
      isDemander,
      orderId: (store.orders.find((item) => item.taskId === taskId && item.status !== 'cancelled') || {}).id || '',
    }
  })
}

function saveTask(payload, taskId) {
  return run(() => {
    // 服务端校验：实名认证 + 所属机构权限（task:publish）
    assert(auth.isVerified(CURRENT), '请先完成实名认证后再发布任务')
    const orgId = payload.orgId || currentOrgId
    assert(auth.isMember(CURRENT, orgId), '你不是所选机构的成员')
    assert(auth.can(orgId, CURRENT, 'task:publish'), '你在该机构没有发布任务的权限')
    assert(payload.title && payload.title.trim().length >= 5, '任务标题至少 5 个字')
    assert(payload.description && payload.description.trim().length >= 20, '详细说明至少 20 个字')
    assert(payload.region, '请选择服务区域')
    assert(
      !payload.requiredQualifications ||
        payload.requiredQualifications.every((item) => dict.qualifications.some((q) => q.value === item)),
      '必要资质取值不合法'
    )
    assert(payload.quoteDeadline && payload.quoteDeadline > now(), '报价截止时间需晚于当前时间')
    if (payload.expectedFinishAt) {
      assert(payload.expectedFinishAt > payload.quoteDeadline, '期望完成时间需晚于报价截止时间')
    }

    if (taskId) {
      const task = findOrThrow(store.tasks, taskId, '任务')
      assert(auth.orgIdsOf(CURRENT).includes(task.publisherOrgId), '无权编辑该任务')
      assert(auth.can(task.publisherOrgId, CURRENT, 'task:manage'), '你在该机构没有管理任务的权限')
      assert(taskState(task) === 'open', '只有报价中的任务可以编辑')
      Object.assign(task, {
        title: payload.title,
        serviceType: payload.serviceType,
        description: payload.description,
        region: payload.region,
        address: payload.address || '',
        expectedFinishAt: payload.expectedFinishAt,
        referencePrice: payload.referencePrice || null,
        quoteDeadline: payload.quoteDeadline,
        attachments: payload.attachments || [],
        requirements: payload.requirements || [],
        requiredQualifications: payload.requiredQualifications || [],
        onsiteRequired: payload.onsiteRequired,
        updatedAt: now(),
      })
      task.audit = task.audit || []
      task.audit.unshift({ at: now(), by: userOf(CURRENT).nickname, action: '编辑任务' })
      log('task.update', task.id, '编辑任务信息')
      return decorateTask(task)
    }

    const task = {
      id: nextId('t'),
      title: payload.title.trim(),
      serviceType: payload.serviceType,
      description: payload.description.trim(),
      region: payload.region,
      address: payload.address || '',
      publisherUserId: CURRENT,
      publisherOrgId: orgId,
      expectedFinishAt: payload.expectedFinishAt,
      referencePrice: payload.referencePrice || null,
      quoteDeadline: payload.quoteDeadline,
      attachments: payload.attachments || [],
      requirements: payload.requirements || [],
      requiredQualifications: payload.requiredQualifications || [],
      onsiteRequired: payload.onsiteRequired,
      createdAt: now(),
      cancelledAt: null,
      closedAt: null,
      dealQuoteId: null,
      audit: [{ at: now(), by: userOf(CURRENT).nickname, action: '发布任务' }],
    }
    store.tasks.unshift(task)
    log('task.create', task.id, `发布任务：${task.title}`)
    return decorateTask(task)
  })
}

function cancelTask(taskId, reason) {
  return run(() => {
    const task = findOrThrow(store.tasks, taskId, '任务')
    assert(auth.orgIdsOf(CURRENT).includes(task.publisherOrgId), '无权取消该任务')
    assert(auth.can(task.publisherOrgId, CURRENT, 'task:manage'), '你在该机构没有管理任务的权限')
    assert(taskState(task) === 'open', '当前状态的任务不可取消，请通过订单流程处理')
    assert(reason && reason.trim(), '请填写取消原因')
    task.cancelledAt = now()
    task.cancelReason = reason.trim()
    task.audit.unshift({ at: now(), by: userOf(CURRENT).nickname, action: '取消任务', remark: reason.trim() })
    store.quotes
      .filter((item) => item.taskId === taskId && item.status === 'pending')
      .forEach((item) => {
        item.status = 'invalid'
        item.updatedAt = now()
      })
    log('task.cancel', task.id, reason.trim())
    pushMessage('quote', '任务已取消', `你关注的任务「${task.title}」已被发布方取消。`, task.id, 'task')
    return decorateTask(task)
  })
}

/* ------------------------------------------------------------------ */
/* 报价                                                                */
/* ------------------------------------------------------------------ */

function isDemanderSide(task, userId) {
  return auth.orgIdsOf(userId).includes(task.publisherOrgId)
}

function isQuoteOwner(quote, userId) {
  return quote.userId === userId
}

function decorateQuote(quote, task) {
  const viewerOrgIds = auth.orgIdsOf(CURRENT)
  const demanderSide = isDemanderSide(task, CURRENT)
  const canViewAmount = demanderSide || viewerOrgIds.includes(quote.orgId)
  return {
    ...quote,
    canChat: quote.userId !== CURRENT,
    chatUserId: demanderSide ? quote.userId : task.publisherUserId,
    chatLabel: demanderSide ? '联系报价方' : '联系需求方',
    userAvatar: userAvatar(quote.userId, quote.orgId),
    amountText: canViewAmount ? `¥${util.money(quote.amount)}` : '****',
    canViewAmount,
    statusLabel: dict.labelOf(dict.quoteStatus, quote.status),
    statusTag: dict.tagOf(dict.quoteStatus, quote.status),
    createdAtText: util.formatDate(quote.createdAt, true),
    expectFinishText: util.formatDate(quote.expectFinishAt),
    taskTitle: task.title,
    isMine: quote.userId === CURRENT,
    canEdit:
      canViewAmount &&
      (isQuoteOwner(quote, CURRENT) || auth.can(quote.orgId, CURRENT, 'quote:manage')) &&
      quote.status === 'pending' &&
      taskState(task) === 'open',
    versionCount: (quote.versions || []).length,
  }
}

function getTaskQuotes(taskId) {
  return run(() => {
    const task = findOrThrow(store.tasks, taskId, '任务')
    const demander = isDemanderSide(task, CURRENT)
    const viewerOrgIds = auth.orgIdsOf(CURRENT)
    let list = store.quotes.filter((item) => item.taskId === taskId)
    if (!demander) {
      // 服务端策略：报价方默认不能查看其他报价，仅返回本机构报价
      list = list.filter((item) => viewerOrgIds.includes(item.orgId))
    }
    const quotes = list
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((item) => decorateQuote(item, task))
    return {
      task: decorateTask(task),
      isDemander: demander,
      canAccept: demander && auth.can(task.publisherOrgId, CURRENT, 'quote:accept'),
      quotes,
      total: quotes.length,
    }
  })
}

function getQuoteDetail(quoteId) {
  return run(() => {
    const quote = findOrThrow(store.quotes, quoteId, '报价')
    const task = findOrThrow(store.tasks, quote.taskId, '任务')
    assert(
      isDemanderSide(task, CURRENT) || auth.orgIdsOf(CURRENT).includes(quote.orgId),
      '无权查看该报价'
    )
    const detail = decorateQuote(quote, task)
    return {
      ...detail,
      task: decorateTask(task),
      versions: (quote.versions || [])
        .slice()
        .sort((a, b) => b.version - a.version)
        .map((item) => ({
          ...item,
          updatedAtText: util.formatDate(item.updatedAt, true),
          amountText: `¥${util.money(item.amount)}`,
          expectFinishText: util.formatDate(item.expectFinishAt),
        })),
      canAccept:
        isDemanderSide(task, CURRENT) &&
        auth.can(task.publisherOrgId, CURRENT, 'quote:accept') &&
        quote.status === 'pending' &&
        taskState(task) === 'open',
      orderId: (store.orders.find((item) => item.quoteId === quote.id) || {}).id || '',
    }
  })
}

function saveQuote(payload, quoteId) {
  return run(() => {
    // 服务端校验：实名 + quote:create/quote:manage，报价修改权属于报价方
    assert(auth.isVerified(CURRENT), '请先完成实名认证后再报价')
    assert(payload.amount > 0, '请填写有效的报价金额')
    const task = findOrThrow(store.tasks, payload.taskId, '任务')
    assert(taskState(task) === 'open', '该任务已不接受新报价')
    assert(!isDemanderSide(task, CURRENT), '不能对自己机构发布的任务报价')

    if (quoteId) {
      const quote = findOrThrow(store.quotes, quoteId, '报价')
      assert(auth.orgIdsOf(CURRENT).includes(quote.orgId), '无权修改该报价')
      assert(
        isQuoteOwner(quote, CURRENT) || auth.can(quote.orgId, CURRENT, 'quote:manage'),
        '只有报价方可以修改报价'
      )
      assert(quote.status === 'pending', '当前报价状态不可修改')
      assert(taskState(task) === 'open', '报价截止后不可修改')
      const version = (quote.versions || []).length + 1
      quote.amount = payload.amount
      quote.remark = payload.remark || ''
      quote.expectFinishAt = payload.expectFinishAt
      quote.feeInclude = payload.feeInclude || ''
      quote.advanceFee = payload.advanceFee || ''
      quote.attachments = payload.attachments || quote.attachments || []
      quote.updatedAt = now()
      quote.versions = quote.versions || []
      quote.versions.push({
        version,
        amount: quote.amount,
        remark: quote.remark,
        expectFinishAt: quote.expectFinishAt,
        feeInclude: quote.feeInclude,
        advanceFee: quote.advanceFee,
        updatedAt: now(),
        action: '修改报价',
      })
      log('quote.update', quote.id, `报价更新为 V${version}，金额 ${quote.amount}`)
      pushMessage('quote', '报价已修改', `你对「${task.title}」的报价已更新为 V${version}。`, quote.id, 'quote')
      return decorateQuote(quote, task)
    }

    const orgIds = auth.orgIdsOf(CURRENT)
    const orgId = payload.orgId && orgIds.includes(payload.orgId) ? payload.orgId : orgIds[0]
    assert(auth.can(orgId, CURRENT, 'quote:create'), '你在该机构没有报价权限')
    const duplicated = store.quotes.find(
      (item) => item.taskId === task.id && item.orgId === orgId && ['pending', 'accepted'].includes(item.status)
    )
    assert(!duplicated, '本机构已提交过报价，可在报价截止前修改')

    const quote = {
      id: nextId('q'),
      taskId: task.id,
      userId: CURRENT,
      orgId,
      userName: userOf(CURRENT).nickname,
      orgName: auth.orgName(orgId),
      amount: payload.amount,
      remark: payload.remark || '',
      expectFinishAt: payload.expectFinishAt,
      feeInclude: payload.feeInclude || '',
      advanceFee: payload.advanceFee || '',
      attachments: payload.attachments || [],
      status: 'pending',
      createdAt: now(),
      updatedAt: now(),
      versions: [
        {
          version: 1,
          amount: payload.amount,
          remark: payload.remark || '',
          expectFinishAt: payload.expectFinishAt,
          feeInclude: payload.feeInclude || '',
          advanceFee: payload.advanceFee || '',
          updatedAt: now(),
          action: '提交报价',
        },
      ],
    }
    store.quotes.push(quote)
    task.audit = task.audit || []
    task.audit.push({ at: now(), by: userOf(CURRENT).nickname, action: '收到新报价' })
    log('quote.create', quote.id, `任务 ${task.id} 报价 ${quote.amount} 元`)
    pushMessage('quote', '收到新报价', `「${task.title}」收到 1 条新报价。`, task.id, 'task')
    return decorateQuote(quote, task)
  })
}

function withdrawQuote(quoteId, reason) {
  return run(() => {
    const quote = findOrThrow(store.quotes, quoteId, '报价')
    const task = findOrThrow(store.tasks, quote.taskId, '任务')
    assert(auth.orgIdsOf(CURRENT).includes(quote.orgId), '无权撤回该报价')
    assert(
      isQuoteOwner(quote, CURRENT) || auth.can(quote.orgId, CURRENT, 'quote:manage'),
      '只有报价方可以撤回报价'
    )
    assert(quote.status === 'pending', '当前报价状态不可撤回')
    assert(taskState(task) === 'open', '报价截止后不可撤回')
    quote.status = 'withdrawn'
    quote.updatedAt = now()
    quote.withdrawReason = reason || ''
    quote.versions.push({
      version: quote.versions.length + 1,
      amount: quote.amount,
      remark: `撤回报价${reason ? `：${reason}` : ''}`,
      expectFinishAt: quote.expectFinishAt,
      feeInclude: quote.feeInclude,
      advanceFee: quote.advanceFee,
      updatedAt: now(),
      action: '撤回报价',
    })
    log('quote.withdraw', quote.id, reason || '撤回报价')
    return decorateQuote(quote, task)
  })
}

/**
 * 接受报价 → 生成唯一订单。
 * 事务 + 唯一约束 + 幂等：同一任务已成交时返回既有订单；同一幂等键重复提交返回首次结果。
 */
function acceptQuote(payload) {
  const { quoteId, idempotencyKey } = payload || {}
  return run(() => {
    const idemKey = idempotencyKey || `accept-${CURRENT}-${quoteId}`
    if (store.idempotency[idemKey]) {
      return { ...store.idempotency[idemKey], duplicated: true }
    }
    const quote = findOrThrow(store.quotes, quoteId, '报价')
    const task = findOrThrow(store.tasks, quote.taskId, '任务')
    assert(isDemanderSide(task, CURRENT), '只有需求方可以确认成交')
    assert(
      auth.can(task.publisherOrgId, CURRENT, 'quote:accept'),
      '你在该机构没有确认成交的权限'
    )
    assert(quote.status === 'pending', '该报价已失效，无法接受')
    assert(taskState(task) === 'open', '当前任务状态不可成交')

    const existed = store.orders.find((item) => item.taskId === task.id && item.status !== 'cancelled')
    if (existed) {
      const result = { orderId: existed.id, order: existed, duplicated: true }
      store.idempotency[idemKey] = result
      return result
    }

    // —— 事务开始 ——
    quote.status = 'accepted'
    quote.updatedAt = now()
    store.quotes
      .filter((item) => item.taskId === task.id && item.id !== quote.id && item.status === 'pending')
      .forEach((item) => {
        item.status = 'invalid'
        item.updatedAt = now()
        pushMessage('quote', '报价已失效', `「${task.title}」已成交，你的报价自动失效。`, item.id, 'quote')
      })
    task.dealQuoteId = quote.id
    task.closedAt = null
    task.audit.unshift({
      at: now(),
      by: userOf(CURRENT).nickname,
      action: '接受报价，生成订单',
      remark: `${quote.orgName} ¥${util.money(quote.amount)}`,
    })

    const order = {
      id: nextId('od'),
      no: util.buildOrderNo(seq),
      taskId: task.id,
      taskTitle: task.title,
      serviceType: task.serviceType,
      quoteId: quote.id,
      quoteVersion: quote.versions.length,
      quoteSnapshot: {
        amount: quote.amount,
        remark: quote.remark,
        expectFinishAt: quote.expectFinishAt,
        feeInclude: quote.feeInclude,
        advanceFee: quote.advanceFee,
        version: quote.versions.length,
        snapshotAt: now(),
      },
      price: quote.amount,
      demander: {
        userId: task.publisherUserId,
        orgId: task.publisherOrgId,
        name: userOf(task.publisherUserId).nickname,
        orgName: auth.orgName(task.publisherOrgId),
        phone: userOf(task.publisherUserId).phone,
      },
      supplier: {
        userId: quote.userId,
        orgId: quote.orgId,
        name: quote.userName,
        orgName: quote.orgName,
        phone: userOf(quote.userId).phone,
      },
      status: 'pending_start',
      region: task.region,
      expectedFinishAt: quote.expectFinishAt,
      createdAt: now(),
      startedAt: null,
      progresses: [],
      evidences: [],
      feeChanges: [],
      payments: [],
      operations: [
        {
          id: nextId('op'),
          at: now(),
          byId: CURRENT,
          byName: userOf(CURRENT).nickname,
          action: '接受报价，生成订单',
          remark: `报价版本 V${quote.versions.length}，金额 ${quote.amount} 元`,
        },
      ],
      cancelRequest: null,
      dispute: null,
      review: null,
    }
    store.orders.unshift(order)
    // —— 事务结束 ——

    log('quote.accept', quote.id, `生成订单 ${order.no}`)
    pushMessage('order', '报价已被接受', `「${task.title}」已成交，订单 ${order.no} 已生成。`, order.id, 'order')

    const result = { orderId: order.id, order, duplicated: false }
    store.idempotency[idemKey] = result
    return result
  }, 300)
}

function getMyQuotes() {
  return run(() => {
    const myOrgIds = auth.orgIdsOf(CURRENT)
    return store.quotes
      .filter((item) => myOrgIds.includes(item.orgId))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((item) => {
        const task = store.tasks.find((t) => t.id === item.taskId) || {}
        return {
          ...decorateQuote(item, task),
          taskState: taskState(task),
          taskStateLabel: dict.labelOf(dict.taskStatus, taskState(task)),
        }
      })
  })
}

/* ------------------------------------------------------------------ */
/* 订单                                                                */
/* ------------------------------------------------------------------ */

function sideOf(order, userId) {
  const orgIds = auth.orgIdsOf(userId)
  if (orgIds.includes(order.demander.orgId)) return 'demand'
  if (orgIds.includes(order.supplier.orgId)) return 'supply'
  return null
}

function orderFee(order) {
  const extra = (order.feeChanges || [])
    .filter((item) => item.status === 'agreed')
    .reduce((sum, item) => sum + (item.after - item.before), 0)
  return {
    price: order.price,
    extraFee: extra,
    total: order.price + extra,
  }
}

function decorateOrder(order) {
  const side = sideOf(order, CURRENT)
  const status = order.status
  const active = !['completed', 'cancelled'].includes(status)
  const fee = orderFee(order)
  const cancelPending = order.cancelRequest && order.cancelRequest.status === 'pending'
  const myOrgId = side === 'demand' ? order.demander.orgId : order.supplier.orgId
  const can = (permission) => (side ? auth.can(myOrgId, CURRENT, permission) : false)
  return {
    ...order,
    ...fee,
    totalText: `¥${util.money(fee.total)}`,
    priceText: `¥${util.money(fee.price)}`,
    extraFeeText: fee.extraFee ? `¥${util.money(fee.extraFee)}` : '-',
    statusLabel: dict.labelOf(dict.orderStatus, status),
    statusTag: dict.tagOf(dict.orderStatus, status),
    serviceTypeLabel: dict.labelOf(dict.serviceTypes, order.serviceType),
    regionText: (order.region || '').split('/').filter(Boolean).join(' · '),
    side,
    sideLabel: side === 'demand' ? '我发布的' : side === 'supply' ? '我承接的' : '',
    roleText: side === 'demand' ? '需求方' : '承接方',
    footerHint:
      status === 'completed'
        ? '订单已完成'
        : status === 'cancelled'
        ? '订单已取消'
        : status === 'disputing'
        ? '争议处理中'
        : status === 'pending_acceptance'
        ? side === 'supply'
          ? '等待需求方验收'
          : '待验收'
        : '暂无待办操作',
    createdAtText: util.formatDate(order.createdAt, true),
    expectedFinishText: util.formatDate(order.expectedFinishAt),
    counterpart: side === 'demand' ? order.supplier : order.demander,
    permissions: {
      canProgress: side === 'supply' && can('order:manage') && ['pending_start', 'in_progress'].includes(status),
      canSubmitEvidence: side === 'supply' && can('order:manage') && ['pending_start', 'in_progress'].includes(status),
      canAccept: side === 'demand' && can('order:accept') && status === 'pending_acceptance',
      canFeeChange: active && can('fee:change'),
      canDeclare: active && can('fee:declare'),
      canConfirmFee: active,
      canDispute: active && !order.dispute && can('dispute:apply'),
      canCancel: active && !cancelPending && can('order:manage'),
      canReview: side === 'demand' && status === 'completed' && !order.review,
      canRespondCancel: !!cancelPending && order.cancelRequest.byId !== CURRENT,
    },
    pendingFeeChanges: (order.feeChanges || []).filter(
      (item) =>
        item.status === 'pending' &&
        ((side === 'demand' && item.demandConfirmed !== true && item.createdBy !== CURRENT) ||
          (side === 'supply' && item.supplyConfirmed !== true && item.createdBy !== CURRENT))
    ).length,
    pendingPayments: (order.payments || []).filter(
      (item) =>
        item.status === 'pending' &&
        ((side === 'demand' && item.demandConfirmed !== true) || (side === 'supply' && item.supplyConfirmed !== true))
    ).length,
    cancelRequestView: order.cancelRequest
      ? {
          ...order.cancelRequest,
          createdAtText: util.formatDate(order.cancelRequest.createdAt, true),
          statusLabel:
            order.cancelRequest.status === 'pending'
              ? '待对方确认'
              : order.cancelRequest.status === 'agreed'
              ? '已同意'
              : '已拒绝',
        }
      : null,
    operations: (order.operations || []).map((item) => ({ ...item, atText: util.formatDate(item.at, true) })),
  }
}

function getOrderList(params = {}) {
  return run(() => {
    const { role = 'all', status = '' } = params
    return store.orders
      .filter((order) => {
        const side = sideOf(order, CURRENT)
        if (!side) return false
        if (role === 'demand' && side !== 'demand') return false
        if (role === 'supply' && side !== 'supply') return false
        if (status && order.status !== status) return false
        return true
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((item) => decorateOrder(item))
  })
}

function getOrderDetail(orderId) {
  return run(() => {
    const order = findOrThrow(store.orders, orderId, '订单')
    assert(sideOf(order, CURRENT), '无权查看该订单资料')
    const detail = decorateOrder(order)
    const dispute = order.dispute
    return {
      ...detail,
      quoteSnapshotView: {
        ...order.quoteSnapshot,
        amountText: `¥${util.money(order.quoteSnapshot.amount)}`,
        snapshotAtText: util.formatDate(order.quoteSnapshot.snapshotAt, true),
        expectFinishText: util.formatDate(order.quoteSnapshot.expectFinishAt),
      },
      progresses: (order.progresses || [])
        .slice()
        .sort((a, b) => b.at - a.at)
        .map((item) => ({ ...item, atText: util.formatDate(item.at, true) })),
      evidences: (order.evidences || [])
        .slice()
        .sort((a, b) => b.at - a.at)
        .map((item) => ({ ...item, atText: util.formatDate(item.at, true) })),
      feeChanges: (order.feeChanges || [])
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((item) => ({
          ...item,
          createdAtText: util.formatDate(item.createdAt, true),
          beforeText: `¥${util.money(item.before)}`,
          afterText: `¥${util.money(item.after)}`,
          diffText: `${item.after - item.before >= 0 ? '+' : ''}¥${util.money(item.after - item.before)}`,
          statusLabel:
            item.status === 'agreed' ? '双方已确认' : item.status === 'rejected' ? '未达成一致' : '待双方确认',
          statusTag:
            item.status === 'agreed' ? 'tag-success' : item.status === 'rejected' ? 'tag-danger' : 'tag-warn',
          canConfirm:
            item.status === 'pending' &&
            ((sideOf(order, CURRENT) === 'demand' && item.demandConfirmed !== true) ||
              (sideOf(order, CURRENT) === 'supply' && item.supplyConfirmed !== true)),
          isMine: item.createdBy === CURRENT,
        })),
      payments: (order.payments || [])
        .slice()
        .sort((a, b) => b.declaredAt - a.declaredAt)
        .map((item) => ({
          ...item,
          declaredAtText: util.formatDate(item.declaredAt, true),
          amountText: `¥${util.money(item.amount)}`,
          typeLabel: item.type === 'pay' ? '付款申报' : '收款申报',
          statusLabel:
            item.status === 'confirmed' ? '双方已确认' : item.status === 'rejected' ? '未确认' : '待确认',
          statusTag:
            item.status === 'confirmed' ? 'tag-success' : item.status === 'rejected' ? 'tag-danger' : 'tag-warn',
          canConfirm:
            item.status === 'pending' &&
            ((sideOf(order, CURRENT) === 'demand' && item.declaredBy !== CURRENT && item.demandConfirmed !== true) ||
              (sideOf(order, CURRENT) === 'supply' && item.declaredBy !== CURRENT && item.supplyConfirmed !== true)),
        })),
      dispute: dispute
        ? {
            ...dispute,
            createdAtText: util.formatDate(dispute.createdAt, true),
            handledAtText: dispute.handledAt ? util.formatDate(dispute.handledAt, true) : '',
            statusLabel: dispute.status === 'processing' ? '处理中' : '已处理',
            records: (dispute.records || []).map((item) => ({ ...item, atText: util.formatDate(item.at, true) })),
          }
        : null,
      review: order.review
        ? { ...order.review, createdAtText: util.formatDate(order.review.createdAt, true) }
        : null,
    }
  })
}

function updateProgress(orderId, payload) {
  return run(() => {
    const order = findOrThrow(store.orders, orderId, '订单')
    const side = sideOf(order, CURRENT)
    assert(side === 'supply', '只有承接方可以更新进度')
    assert(auth.can(order.supplier.orgId, CURRENT, 'order:manage'), '你在该机构没有维护订单的权限')
    assert(['pending_start', 'in_progress'].includes(order.status), '当前订单状态不可更新进度')
    assert(payload.content && payload.content.trim(), '请填写进度说明')
    order.progresses.unshift({
      id: nextId('pg'),
      at: now(),
      byId: CURRENT,
      byName: userOf(CURRENT).nickname,
      content: payload.content.trim(),
      files: payload.files || [],
    })
    if (order.status === 'pending_start') {
      order.status = 'in_progress'
      order.startedAt = now()
    }
    order.operations.unshift({
      id: nextId('op'),
      at: now(),
      byId: CURRENT,
      byName: userOf(CURRENT).nickname,
      action: '更新进度',
      remark: payload.content.trim().slice(0, 40),
    })
    log('order.progress', order.id, payload.content.trim().slice(0, 60))
    pushMessage('order', '订单进度更新', `「${order.taskTitle}」承接方更新了进度。`, order.id, 'order')
    return decorateOrder(order)
  })
}

function submitEvidence(orderId, payload) {
  return run(() => {
    const order = findOrThrow(store.orders, orderId, '订单')
    assert(sideOf(order, CURRENT) === 'supply', '只有承接方可以提交履约凭证')
    assert(auth.can(order.supplier.orgId, CURRENT, 'order:manage'), '你在该机构没有维护订单的权限')
    assert(['pending_start', 'in_progress'].includes(order.status), '当前订单状态不可提交凭证')
    assert(payload.content && payload.content.trim(), '请填写凭证说明')
    assert((payload.files || []).length > 0, '请至少上传 1 个履约凭证')
    order.evidences.unshift({
      id: nextId('ev'),
      at: now(),
      byId: CURRENT,
      byName: userOf(CURRENT).nickname,
      type: payload.type || '交付成果',
      content: payload.content.trim(),
      files: payload.files,
    })
    order.status = 'pending_acceptance'
    order.operations.unshift({
      id: nextId('op'),
      at: now(),
      byId: CURRENT,
      byName: userOf(CURRENT).nickname,
      action: '提交履约凭证并申请验收',
      remark: payload.content.trim().slice(0, 40),
    })
    log('order.evidence', order.id, payload.content.trim().slice(0, 60))
    pushMessage('order', '订单待验收', `「${order.taskTitle}」已提交履约凭证，请验收。`, order.id, 'order')
    return decorateOrder(order)
  })
}

function acceptDelivery(orderId, payload) {
  return run(() => {
    const order = findOrThrow(store.orders, orderId, '订单')
    assert(sideOf(order, CURRENT) === 'demand', '只有需求方可以验收')
    assert(auth.can(order.demander.orgId, CURRENT, 'order:accept'), '你在该机构没有验收权限')
    assert(order.status === 'pending_acceptance', '当前订单不在待验收状态')
    if (payload.result === 'accept') {
      order.status = 'completed'
      order.completedAt = now()
      order.operations.unshift({
        id: nextId('op'),
        at: now(),
        byId: CURRENT,
        byName: userOf(CURRENT).nickname,
        action: '验收通过，订单完成',
      })
      pushMessage('order', '订单已完成', `「${order.taskTitle}」验收通过，订单已完成。`, order.id, 'order')
    } else {
      assert(payload.remark && payload.remark.trim(), '请填写退回补充说明')
      order.status = 'in_progress'
      order.operations.unshift({
        id: nextId('op'),
        at: now(),
        byId: CURRENT,
        byName: userOf(CURRENT).nickname,
        action: '退回补充材料',
        remark: payload.remark.trim(),
      })
      pushMessage('order', '订单被退回补充', `「${order.taskTitle}」验收未通过：${payload.remark.trim()}`, order.id, 'order')
    }
    log('order.accept', order.id, payload.result === 'accept' ? '验收通过' : '退回补充')
    return decorateOrder(order)
  })
}

function requestCancelOrder(orderId, reason) {
  return run(() => {
    const order = findOrThrow(store.orders, orderId, '订单')
    const side = sideOf(order, CURRENT)
    assert(side, '无权操作该订单')
    assert(auth.can(side === 'demand' ? order.demander.orgId : order.supplier.orgId, CURRENT, 'order:manage'), '你在该机构没有订单管理权限')
    assert(['pending_start', 'in_progress', 'pending_acceptance'].includes(order.status), '当前订单状态不可取消')
    assert(!order.cancelRequest || order.cancelRequest.status !== 'pending', '已有待确认的取消申请')
    assert(reason && reason.trim().length >= 5, '请填写取消原因（至少 5 个字）')
    order.cancelRequest = {
      id: nextId('cr'),
      byId: CURRENT,
      byName: userOf(CURRENT).nickname,
      side,
      reason: reason.trim(),
      createdAt: now(),
      status: 'pending',
    }
    order.operations.unshift({
      id: nextId('op'),
      at: now(),
      byId: CURRENT,
      byName: userOf(CURRENT).nickname,
      action: '发起订单取消申请',
      remark: reason.trim(),
    })
    log('order.cancel.request', order.id, reason.trim())
    pushMessage('order', '订单取消申请', `「${order.taskTitle}」对方发起取消申请，请确认。`, order.id, 'order')
    return decorateOrder(order)
  })
}

function respondCancelOrder(orderId, agree) {
  return run(() => {
    const order = findOrThrow(store.orders, orderId, '订单')
    const request = order.cancelRequest
    assert(request && request.status === 'pending', '没有待确认的取消申请')
    assert(request.byId !== CURRENT, '需由对方确认取消申请')
    request.status = agree ? 'agreed' : 'rejected'
    request.respondedAt = now()
    if (agree) {
      order.status = 'cancelled'
      order.cancelledAt = now()
      const task = store.tasks.find((item) => item.id === order.taskId)
      if (task) {
        // 订单取消后任务默认关闭，不自动重新开放
        task.closedAt = now()
        task.closeReason = '订单取消，任务关闭'
        task.audit.unshift({ at: now(), by: userOf(CURRENT).nickname, action: '订单取消，任务关闭' })
      }
    }
    order.operations.unshift({
      id: nextId('op'),
      at: now(),
      byId: CURRENT,
      byName: userOf(CURRENT).nickname,
      action: agree ? '同意取消订单' : '拒绝取消订单',
    })
    log('order.cancel.respond', order.id, agree ? '同意取消' : '拒绝取消')
    pushMessage('order', agree ? '订单已取消' : '取消申请被拒绝', `「${order.taskTitle}」`, order.id, 'order')
    return decorateOrder(order)
  })
}

function createFeeChange(orderId, payload) {
  return run(() => {
    const order = findOrThrow(store.orders, orderId, '订单')
    const side = sideOf(order, CURRENT)
    assert(side, '无权操作该订单')
    const orgId = side === 'demand' ? order.demander.orgId : order.supplier.orgId
    assert(auth.can(orgId, CURRENT, 'fee:change'), '你在该机构没有申请费用变更的权限')
    assert(!['completed', 'cancelled'].includes(order.status), '当前订单状态不可变更费用')
    const fee = orderFee(order)
    assert(payload.after > 0, '请填写变更后总额')
    assert(payload.after !== fee.total, '变更后金额与当前总额一致')
    assert(payload.reason && payload.reason.trim().length >= 5, '请填写费用变更原因')
    const change = {
      id: nextId('fc'),
      version: (order.feeChanges || []).length + 1,
      reason: payload.reason.trim(),
      before: fee.total,
      after: payload.after,
      createdBy: CURRENT,
      createdByName: userOf(CURRENT).nickname,
      createdAt: now(),
      demandConfirmed: side === 'demand' ? true : null,
      supplyConfirmed: side === 'supply' ? true : null,
      status: 'pending',
      respondedAt: null,
    }
    order.feeChanges.unshift(change)
    order.operations.unshift({
      id: nextId('op'),
      at: now(),
      byId: CURRENT,
      byName: userOf(CURRENT).nickname,
      action: '申请费用变更',
      remark: `${change.before} → ${change.after}`,
    })
    log('order.fee.change', order.id, `费用变更 ${change.before} → ${change.after}`)
    pushMessage('fee', '费用变更待确认', `「${order.taskTitle}」金额 ${change.before} → ${change.after} 元，请确认。`, order.id, 'order')
    return decorateOrder(order)
  })
}

function confirmFeeChange(orderId, changeId, agree) {
  return run(() => {
    const order = findOrThrow(store.orders, orderId, '订单')
    const side = sideOf(order, CURRENT)
    assert(side, '无权操作该订单')
    const orgId = side === 'demand' ? order.demander.orgId : order.supplier.orgId
    assert(auth.can(orgId, CURRENT, 'fee:confirm'), '你在该机构没有确认费用变更的权限')
    const change = (order.feeChanges || []).find((item) => item.id === changeId)
    assert(change, '费用变更记录不存在')
    assert(change.status === 'pending', '该变更已处理')
    assert(change.createdBy !== CURRENT, '需由对方确认费用变更')
    if (side === 'demand') change.demandConfirmed = !!agree
    else change.supplyConfirmed = !!agree
    if (!agree) {
      change.status = 'rejected'
      change.respondedAt = now()
    } else if (change.demandConfirmed === true && change.supplyConfirmed === true) {
      change.status = 'agreed'
      change.respondedAt = now()
    }
    order.operations.unshift({
      id: nextId('op'),
      at: now(),
      byId: CURRENT,
      byName: userOf(CURRENT).nickname,
      action: agree ? '确认费用变更' : '拒绝费用变更',
      remark: `${change.before} → ${change.after}`,
    })
    log('order.fee.confirm', order.id, agree ? '确认费用变更' : '拒绝费用变更')
    pushMessage('fee', '费用变更处理结果', `「${order.taskTitle}」费用变更${agree ? '已确认' : '被拒绝'}。`, order.id, 'order')
    return decorateOrder(order)
  })
}

function declarePayment(orderId, payload) {
  return run(() => {
    const order = findOrThrow(store.orders, orderId, '订单')
    const side = sideOf(order, CURRENT)
    assert(side, '无权操作该订单')
    const orgId = side === 'demand' ? order.demander.orgId : order.supplier.orgId
    assert(auth.can(orgId, CURRENT, 'fee:declare'), '你在该机构没有申报收付款的权限')
    assert(order.status !== 'cancelled', '已取消订单不可申报')
    assert(payload.amount > 0, '请填写申报金额')
    assert(payload.remark && payload.remark.trim(), '请填写申报说明')
    const record = {
      id: nextId('pm'),
      type: payload.type || (side === 'demand' ? 'pay' : 'receive'),
      amount: payload.amount,
      remark: payload.remark.trim(),
      files: payload.files || [],
      declaredBy: CURRENT,
      declaredByName: userOf(CURRENT).nickname,
      declaredAt: now(),
      demandConfirmed: side === 'demand' ? true : null,
      supplyConfirmed: side === 'supply' ? true : null,
      status: 'pending',
    }
    order.payments.unshift(record)
    order.operations.unshift({
      id: nextId('op'),
      at: now(),
      byId: CURRENT,
      byName: userOf(CURRENT).nickname,
      action: record.type === 'pay' ? '申报付款' : '申报收款',
      remark: `${record.amount} 元`,
    })
    log('order.payment.declare', order.id, `${record.type} ${record.amount} 元（用户申报，平台未核实）`)
    pushMessage('fee', '收付款申报待确认', `「${order.taskTitle}」对方申报 ${record.amount} 元，请确认。`, order.id, 'order')
    return decorateOrder(order)
  })
}

function confirmPayment(orderId, paymentId, agree) {
  return run(() => {
    const order = findOrThrow(store.orders, orderId, '订单')
    const side = sideOf(order, CURRENT)
    assert(side, '无权操作该订单')
    const orgId = side === 'demand' ? order.demander.orgId : order.supplier.orgId
    assert(auth.can(orgId, CURRENT, 'fee:confirm'), '你在该机构没有确认收付款的权限')
    const record = (order.payments || []).find((item) => item.id === paymentId)
    assert(record, '申报记录不存在')
    assert(record.status === 'pending', '该申报已处理')
    assert(record.declaredBy !== CURRENT, '需由对方确认申报')
    if (side === 'demand') record.demandConfirmed = !!agree
    else record.supplyConfirmed = !!agree
    record.status = agree ? (record.demandConfirmed === true && record.supplyConfirmed === true ? 'confirmed' : 'pending') : 'rejected'
    record.respondedAt = now()
    order.operations.unshift({
      id: nextId('op'),
      at: now(),
      byId: CURRENT,
      byName: userOf(CURRENT).nickname,
      action: agree ? '确认收付款申报' : '否认收付款申报',
      remark: `${record.amount} 元`,
    })
    log('order.payment.confirm', order.id, agree ? '确认申报' : '否认申报')
    pushMessage('fee', '收付款申报结果', `「${order.taskTitle}」${record.amount} 元申报${agree ? '已确认' : '被否认'}。`, order.id, 'order')
    return decorateOrder(order)
  })
}

function applyDispute(orderId, payload) {
  return run(() => {
    const order = findOrThrow(store.orders, orderId, '订单')
    const side = sideOf(order, CURRENT)
    assert(side, '无权操作该订单')
    const orgId = side === 'demand' ? order.demander.orgId : order.supplier.orgId
    assert(auth.can(orgId, CURRENT, 'dispute:apply'), '你在该机构没有发起争议的权限')
    assert(!['completed', 'cancelled'].includes(order.status), '当前订单状态不可发起争议')
    assert(!order.dispute, '该订单已在争议处理中')
    assert(payload.reason && payload.reason.trim().length >= 10, '请详细描述争议情况（至少 10 个字）')
    order.dispute = {
      id: nextId('dp'),
      orderId: order.id,
      reason: payload.reason.trim(),
      files: payload.files || [],
      createdBy: CURRENT,
      createdByName: userOf(CURRENT).nickname,
      createdAt: now(),
      status: 'processing',
      handlerNote: '平台已受理，等待双方补充材料。',
      handledAt: null,
      records: [{ at: now(), by: userOf(CURRENT).nickname, action: '提交争议申请' }],
    }
    order.status = 'disputing'
    order.operations.unshift({
      id: nextId('op'),
      at: now(),
      byId: CURRENT,
      byName: userOf(CURRENT).nickname,
      action: '发起争议',
      remark: payload.reason.trim().slice(0, 40),
    })
    log('order.dispute', order.id, payload.reason.trim().slice(0, 60))
    pushMessage('order', '订单进入争议处理', `「${order.taskTitle}」已进入争议处理。`, order.id, 'order')
    return decorateOrder(order)
  })
}

function reviewOrder(orderId, payload) {
  return run(() => {
    const order = findOrThrow(store.orders, orderId, '订单')
    assert(sideOf(order, CURRENT) === 'demand', '只有需求方可以评价承接方')
    assert(order.status === 'completed', '订单完成后才能评价')
    assert(!order.review, '该订单已评价')
    assert(payload.rating >= 1 && payload.rating <= 5, '请选择评分')
    order.review = {
      rating: payload.rating,
      tags: payload.tags || [],
      content: (payload.content || '').trim(),
      byId: CURRENT,
      byName: userOf(CURRENT).nickname,
      createdAt: now(),
    }
    order.operations.unshift({
      id: nextId('op'),
      at: now(),
      byId: CURRENT,
      byName: userOf(CURRENT).nickname,
      action: '提交评价',
      remark: `${payload.rating} 星`,
    })
    log('order.review', order.id, `${payload.rating} 星`)
    return decorateOrder(order)
  })
}

/* ------------------------------------------------------------------ */
/* 社区                                                                */
/* ------------------------------------------------------------------ */

function decorateTopic(topic) {
  const isMine = topic.authorId === CURRENT
  return {
    ...topic,
    categoryLabel: dict.labelOf(dict.topicCategories, topic.category),
    createdAtText: util.fromNow(topic.createdAt),
    authorAvatar: userAvatar(topic.authorId),
    liked: topic.likedBy.includes(CURRENT),
    favorited: topic.favoritedBy.includes(CURRENT),
    isMine,
    likeCountText: topic.likeCount > 0 ? String(topic.likeCount) : '点赞',
    summary: topic.content.replace(/\s+/g, ' ').slice(0, 80),
    commentCount: (topic.comments || []).reduce((sum, item) => sum + 1 + (item.replies || []).length, 0),
    statusLabel: topic.status === 'normal' ? '' : topic.status === 'hidden' ? '已下架' : '审核中',
  }
}

function getTopicList(params = {}) {
  return run(() => {
    const { keyword = '', category = '', region = '', sort = 'latest', mine = false, favorites = false } = params
    let list = store.topics.filter((item) => item.status !== 'hidden')
    if (mine) list = list.filter((item) => item.authorId === CURRENT)
    if (favorites) list = list.filter((item) => item.favoritedBy.includes(CURRENT))
    if (keyword.trim()) {
      const kw = keyword.trim()
      list = list.filter((item) => item.title.includes(kw) || item.content.includes(kw))
    }
    if (category) list = list.filter((item) => item.category === category)
    if (region) list = list.filter((item) => (item.region || '').includes(region))
    list = list.slice().sort((a, b) =>
      sort === 'hot'
        ? b.likeCount + b.viewCount / 10 - (a.likeCount + a.viewCount / 10)
        : b.createdAt - a.createdAt
    )
    return list.map((item) => decorateTopic(item))
  })
}

function getTopicDetail(topicId) {
  return run(() => {
    const topic = findOrThrow(store.topics, topicId, '话题')
    topic.viewCount += 1
    const decorateComment = (comment) => ({
      ...comment,
      createdAtText: util.fromNow(comment.createdAt),
      liked: (comment.likedBy || []).includes(CURRENT),
      isMine: comment.userId === CURRENT,
      userAvatar: userAvatar(comment.userId),
      replies: (comment.replies || []).map((reply) => ({
        ...reply,
        createdAtText: util.fromNow(reply.createdAt),
        liked: (reply.likedBy || []).includes(CURRENT),
        isMine: reply.userId === CURRENT,
        userAvatar: userAvatar(reply.userId),
      })),
    })
    return {
      ...decorateTopic(topic),
      comments: (topic.comments || []).map(decorateComment),
      canManage: topic.authorId === CURRENT,
    }
  })
}

function createTopic(payload) {
  return run(() => {
    assert(auth.isVerified(CURRENT), '请先完成实名认证')
    assert(payload.title && payload.title.trim().length >= 6, '标题至少 6 个字')
    assert(payload.content && payload.content.trim().length >= 20, '正文至少 20 个字')
    assert(payload.category, '请选择话题分类')
    const topic = {
      id: nextId('tp'),
      title: payload.title.trim(),
      content: payload.content.trim(),
      category: payload.category,
      region: payload.region || '',
      authorId: CURRENT,
      authorName: userOf(CURRENT).nickname,
      authorOrg: auth.orgName(currentOrgId),
      createdAt: now(),
      likeCount: 0,
      likedBy: [],
      favoritedBy: [],
      viewCount: 0,
      commentCount: 0,
      images: payload.images || [],
      attachments: payload.attachments || [],
      status: 'normal',
      comments: [],
    }
    store.topics.unshift(topic)
    log('topic.create', topic.id, topic.title)
    return decorateTopic(topic)
  })
}

function toggleTopicLike(topicId) {
  return run(() => {
    const topic = findOrThrow(store.topics, topicId, '话题')
    const index = topic.likedBy.indexOf(CURRENT)
    if (index >= 0) {
      topic.likedBy.splice(index, 1)
      topic.likeCount = Math.max(0, topic.likeCount - 1)
    } else {
      topic.likedBy.push(CURRENT)
      topic.likeCount += 1
    }
    return { liked: index < 0, likeCount: topic.likeCount }
  }, 60)
}

function toggleTopicFavorite(topicId) {
  return run(() => {
    const topic = findOrThrow(store.topics, topicId, '话题')
    const index = topic.favoritedBy.indexOf(CURRENT)
    if (index >= 0) topic.favoritedBy.splice(index, 1)
    else topic.favoritedBy.push(CURRENT)
    return { favorited: index < 0 }
  }, 60)
}

function addComment(topicId, payload) {
  return run(() => {
    const topic = findOrThrow(store.topics, topicId, '话题')
    assert(auth.isVerified(CURRENT), '请先完成实名认证')
    assert(payload.content && payload.content.trim(), '请填写评论内容')
    const base = {
      userId: CURRENT,
      userName: userOf(CURRENT).nickname,
      userOrg: auth.orgName(currentOrgId),
      content: payload.content.trim(),
      createdAt: now(),
      likeCount: 0,
      likedBy: [],
    }
    if (payload.parentId) {
      const parent = topic.comments.find((item) => item.id === payload.parentId)
      assert(parent, '回复的评论不存在')
      parent.replies = parent.replies || []
      parent.replies.push({
        ...base,
        id: nextId('cr'),
        parentId: parent.id,
        replyTo: payload.replyTo || parent.userName,
      })
      pushMessage('community', '收到新回复', `${base.userName} 回复了你在「${topic.title}」中的评论。`, topicId, 'topic')
    } else {
      topic.comments.push({ ...base, id: nextId('c'), topicId, parentId: null, replies: [] })
      pushMessage('community', '话题有新评论', `${base.userName} 评论了「${topic.title}」。`, topicId, 'topic')
    }
    log('topic.comment', topic.id, base.content.slice(0, 40))
    return getTopicDetailSync(topicId)
  })
}

function getTopicDetailSync(topicId) {
  const topic = store.topics.find((item) => item.id === topicId)
  return {
    ...decorateTopic(topic),
    comments: topic.comments.map((comment) => ({
      ...comment,
      createdAtText: util.fromNow(comment.createdAt),
      liked: (comment.likedBy || []).includes(CURRENT),
      isMine: comment.userId === CURRENT,
      userAvatar: userAvatar(comment.userId),
      replies: (comment.replies || []).map((reply) => ({
        ...reply,
        createdAtText: util.fromNow(reply.createdAt),
        liked: (reply.likedBy || []).includes(CURRENT),
        isMine: reply.userId === CURRENT,
        userAvatar: userAvatar(reply.userId),
      })),
    })),
  }
}

function toggleCommentLike(topicId, commentId, replyId) {
  return run(() => {
    const topic = findOrThrow(store.topics, topicId, '话题')
    const comment = topic.comments.find((item) => item.id === commentId)
    assert(comment, '评论不存在')
    const target = replyId ? (comment.replies || []).find((item) => item.id === replyId) : comment
    assert(target, '评论不存在')
    target.likedBy = target.likedBy || []
    const index = target.likedBy.indexOf(CURRENT)
    if (index >= 0) {
      target.likedBy.splice(index, 1)
      target.likeCount = Math.max(0, (target.likeCount || 0) - 1)
    } else {
      target.likedBy.push(CURRENT)
      target.likeCount = (target.likeCount || 0) + 1
    }
    return { liked: index < 0, likeCount: target.likeCount }
  }, 60)
}

function reportContent(payload) {
  return run(() => {
    assert(payload.reason, '请选择举报原因')
    const report = {
      id: nextId('rp'),
      targetType: payload.targetType || 'topic',
      targetId: payload.targetId,
      targetTitle: payload.targetTitle || '',
      reason: payload.reason,
      detail: (payload.detail || '').trim(),
      reporterId: CURRENT,
      reporterName: userOf(CURRENT).nickname,
      createdAt: now(),
      status: 'pending',
      result: '',
    }
    store.reports.unshift(report)
    log('community.report', report.targetId, report.reason)
    return report
  })
}

function getMyContents(tab) {
  return run(() => {
    if (tab === 'comment') {
      const result = []
      store.topics.forEach((topic) => {
        (topic.comments || []).forEach((comment) => {
          if (comment.userId === CURRENT) result.push({ ...comment, topicId: topic.id, topicTitle: topic.title, createdAtText: util.fromNow(comment.createdAt) })
        })
      })
      return result.sort((a, b) => b.createdAt - a.createdAt)
    }
    if (tab === 'favorite') {
      return store.topics.filter((item) => item.favoritedBy.includes(CURRENT)).map(decorateTopic)
    }
    return store.topics.filter((item) => item.authorId === CURRENT).map(decorateTopic)
  })
}

/* ------------------------------------------------------------------ */
/* 消息                                                                */
/* ------------------------------------------------------------------ */

function getMessages(type = 'all') {
  return run(() => {
    let list = store.messages.slice()
    if (type !== 'all') list = list.filter((item) => item.type === type)
    list.sort((a, b) => b.createdAt - a.createdAt)
    const notice = noticeUnreadCount()
    const chat = chatUnreadCount()
    return {
      list: list.map((item) => ({
        ...item,
        createdAtText: util.fromNow(item.createdAt),
        typeLabel: dict.labelOf(dict.messageTypes, item.type),
      })),
      unread: { all: notice + chat, notice, chat },
    }
  })
}

/* ------------------------------------------------------------------ */
/* 私聊                                                                */
/* ------------------------------------------------------------------ */

function decorateConversation(conversation) {
  const peerId = peerIdOf(conversation)
  const peer = userOf(peerId)
  const messages = conversation.messages || []
  const last = messages[messages.length - 1]
  return {
    id: conversation.id,
    peerId,
    peerName: peer.nickname,
    peerTitle: peer.title || '',
    peerOrgName: orgShortNameOf(peerId),
    peerAvatar: userAvatar(peerId),
    myAvatar: userAvatar(CURRENT),
    avatarText: util.initials(peer.nickname),
    subject: conversation.subject || '私聊',
    bizType: conversation.bizType,
    bizId: conversation.bizId,
    bizLabel: CHAT_BIZ_LABEL[conversation.bizType] || '',
    lastContent: last ? (last.type === 'image' ? '[图片]' : last.content) : '还没有消息，打个招呼吧',
    lastAtText: last ? util.fromNow(last.createdAt) : util.fromNow(conversation.createdAt),
    updatedAt: conversation.updatedAt,
    unread: unreadCountOf(conversation),
  }
}

/** 私聊会话列表（服务端校验：仅返回当前用户参与的会话） */
function getChatList() {
  return run(() => {
    const list = myConversations()
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(decorateConversation)
    return { list, unread: list.reduce((sum, item) => sum + item.unread, 0) }
  })
}

/** 会话详情：进入即把对方消息置为已读 */
function getChatDetail(conversationId) {
  return run(() => {
    const conversation = findOrThrow(store.conversations, conversationId, '会话')
    assert(conversation.memberIds.includes(CURRENT), '无权查看该会话')
    conversation.messages.forEach((item) => {
      if (item.fromId !== CURRENT) item.read = true
    })
    let prevAt = 0
    let prevFrom = ''
    const messages = conversation.messages.map((item) => {
      const showTime = item.createdAt - prevAt > 5 * 60 * 1000
      // 连续同人消息只保留首个头像；出现时间分隔时必定重新展示，避免归属不清
      const groupStart = showTime || item.fromId !== prevFrom
      prevAt = item.createdAt
      prevFrom = item.fromId
      return {
        id: item.id,
        mine: item.fromId === CURRENT,
        type: item.type,
        content: item.content,
        timeText: util.formatDate(item.createdAt, true).slice(5),
        showTime,
        groupStart,
      }
    })
    return { ...decorateConversation(conversation), messages }
  })
}

/**
 * 发起私聊：按「联系人 + 业务对象」归并会话。
 * 服务端校验：不能与自己聊天、联系人需存在、会话成员需包含自己。
 */
/** 幂等获取/创建与某个用户的会话，供 startChat 与「邀请报价」共用 */
function ensureConversation(userId, bizType = 'none', bizId = '') {
  const peer = store.users.find((item) => item.id === userId)
  assert(peer, '联系人不存在或已注销')
  let conversation = myConversations().find(
    (item) =>
      item.memberIds.includes(userId) && (item.bizType || 'none') === bizType && (item.bizId || '') === bizId
  )
  if (!conversation) {
    conversation = {
      id: nextId('cv'),
      memberIds: [CURRENT, userId],
      bizType,
      bizId,
      subject: chatSubjectOf(bizType, bizId, peer.nickname),
      createdAt: now(),
      updatedAt: now(),
      messages: [],
    }
    store.conversations.unshift(conversation)
    log('chat.create', conversation.id, `与 ${peer.nickname} 建立会话`)
  }
  return conversation
}

function startChat(payload) {
  return run(() => {
    const { userId, bizType = 'none', bizId = '' } = payload || {}
    assert(userId, '请选择要联系的人')
    assert(userId !== CURRENT, '不能与自己发起私聊')
    const peer = store.users.find((item) => item.id === userId)
    assert(peer, '联系人不存在或已注销')
    const conversation = ensureConversation(userId, bizType, bizId)
    return { id: conversation.id, subject: conversation.subject, peerId: userId, peerName: peer.nickname }
  }, 60)
}

function sendChatMessage(conversationId, payload) {
  return run(() => {
    const conversation = findOrThrow(store.conversations, conversationId, '会话')
    assert(conversation.memberIds.includes(CURRENT), '无权在该会话中发言')
    const type = payload.type || 'text'
    const content = type === 'image' ? payload.content : (payload.content || '').trim()
    assert(type === 'image' || content, '请输入消息内容')
    assert((content || '').length <= 500, '单条消息不超过 500 字')
    conversation.messages.push({
      id: nextId('cm'),
      fromId: CURRENT,
      type,
      content,
      createdAt: now(),
      read: false,
    })
    conversation.updatedAt = now()
    log('chat.send', conversation.id, type === 'image' ? '[图片]' : content.slice(0, 40))
    return { ok: true }
  }, 80)
}

function readAllChats() {
  return run(() => {
    myConversations().forEach((conversation) => {
      conversation.messages.forEach((item) => {
        if (item.fromId !== CURRENT) item.read = true
      })
    })
    return { ok: true }
  }, 40)
}

function readMessage(messageId) {
  return run(() => {
    const message = findOrThrow(store.messages, messageId, '消息')
    message.read = true
    return { id: message.id }
  }, 40)
}

function readAllMessages(type = 'all') {
  return run(() => {
    store.messages.forEach((item) => {
      if (type === 'all' || item.type === type) item.read = true
    })
    return { ok: true }
  }, 40)
}

/* ------------------------------------------------------------------ */
/* 我的：资料 / 机构 / 评价 / 反馈                                      */
/* ------------------------------------------------------------------ */

function getProfile() {
  return run(() => ({
    ...getProfileSync(),
    stats: {
      published: store.tasks.filter((item) => auth.orgIdsOf(CURRENT).includes(item.publisherOrgId)).length,
      quotes: store.quotes.filter((item) => auth.orgIdsOf(CURRENT).includes(item.orgId)).length,
      orders: store.orders.filter((item) => !!sideOf(item, CURRENT)).length,
      topics: store.topics.filter((item) => item.authorId === CURRENT).length,
    },
  }))
}

function updateProfile(payload) {
  return run(() => {
    const user = userOf(CURRENT)
    assert(payload.nickname && payload.nickname.trim(), '昵称不能为空')
    user.nickname = payload.nickname.trim()
    if (payload.title !== undefined) user.title = payload.title.trim()
    if (payload.phone) {
      assert(/^1\d{10}$/.test(payload.phone), '请填写正确的手机号')
      user.phone = payload.phone
    }
    if (payload.avatar !== undefined) user.avatar = normalizeAvatar(payload.avatar)
    log('user.update', user.id, '更新个人资料')
    return getProfileSync()
  })
}

/** 头像：只写入小程序临时文件路径或 https 地址，其他协议一律丢弃 */
function normalizeAvatar(value) {
  const raw = (value || '').trim()
  if (!raw) return ''
  assert(/^(https:\/\/|wxfile:\/\/|http:\/\/|\/)/.test(raw), '头像地址不合法')
  return raw
}

function updateAvatar(payload) {
  return run(() => {
    const user = userOf(CURRENT)
    const source = payload.source === 'wechat' ? 'wechat' : 'album'
    const avatar = normalizeAvatar(payload.avatar)
    assert(avatar, source === 'wechat' ? '未获取到微信头像，请重新选择' : '请选择一张图片')
    user.avatar = avatar
    log('user.update', user.id, source === 'wechat' ? '设置微信头像' : '上传自定义头像')
    return { ...getProfileSync(), avatar }
  }, 80)
}

function resetAvatar() {
  return run(() => {
    const user = userOf(CURRENT)
    user.avatar = ''
    log('user.update', user.id, '恢复默认头像')
    return getProfileSync()
  }, 60)
}

function getProfileSync() {
  const user = userOf(CURRENT)
  const avatar = userAvatar(CURRENT)
  return {
    ...user,
    phoneMasked: util.maskPhone(user.phone),
    memberships: auth.memberships(CURRENT),
    avatarView: avatar,
    avatarTags: avatar.tags,
  }
}

function submitVerify(payload) {
  return run(() => {
    const user = userOf(CURRENT)
    assert(payload.realName && payload.realName.trim(), '请填写真实姓名')
    assert(/^\d{17}[\dXx]$/.test(payload.idNumber || ''), '请填写正确的身份证号')
    user.realName = payload.realName.trim()
    user.idVerified = true
    user.verifyStatus = 'verified'
    log('user.verify', user.id, '提交实名认证')
    return getProfileSync()
  })
}

function getOrgList() {
  return run(() =>
    auth.memberships(CURRENT).map((item) => {
      const org = store.orgs.find((o) => o.id === item.orgId)
      const orgMembers = store.members.filter((m) => m.orgId === item.orgId && m.status === 'active')
      return {
        ...org,
        role: item.role,
        roleLabel: item.role === 'owner' ? '负责人' : item.role === 'admin' ? '管理员' : '成员',
        memberCount: orgMembers.length,
        canManage: auth.can(item.orgId, CURRENT, 'member:manage'),
        statusLabel: org.status === 'verified' ? '已认证' : org.status === 'pending' ? '审核中' : '未通过',
        statusTag: org.status === 'verified' ? 'tag-success' : 'tag-warn',
        typeLabel: org.type === 'store' ? '门店' : '企业',
      }
    })
  )
}

function getOrgDetail(orgId) {
  return run(() => {
    assert(auth.isMember(CURRENT, orgId), '你不是该机构成员')
    const org = findOrThrow(store.orgs, orgId, '机构')
    const role = auth.membership(CURRENT, orgId).role
    return {
      ...org,
      typeLabel: org.type === 'store' ? '门店' : '企业',
      statusLabel: org.status === 'verified' ? '已认证' : org.status === 'pending' ? '审核中' : '未通过',
      statusTag: org.status === 'verified' ? 'tag-success' : 'tag-warn',
      role,
      roleLabel: role === 'owner' ? '负责人' : role === 'admin' ? '管理员' : '成员',
      permissions: auth.PERMISSIONS,
      myPermissions: auth.permissionsIn(CURRENT, orgId),
      canManage: auth.can(orgId, CURRENT, 'member:manage'),
      members: store.members
        .filter((item) => item.orgId === orgId && item.status === 'active')
        .map((item) => {
          const user = userOf(item.userId)
          return {
            memberId: item.id,
            userId: item.userId,
            name: user.nickname,
            phone: util.maskPhone(user.phone),
            title: user.title || '',
            role: item.role,
            avatarView: userAvatar(item.userId, orgId),
            roleLabel: item.role === 'owner' ? '负责人' : item.role === 'admin' ? '管理员' : '成员',
            joinedAtText: util.formatDate(item.joinedAt),
            isSelf: item.userId === CURRENT,
            canRemove: auth.can(orgId, CURRENT, 'member:manage') && item.userId !== CURRENT,
          }
        }),
      parentName: org.parentId ? (store.orgs.find((o) => o.id === org.parentId) || {}).name : '',
    }
  })
}

function addOrgMember(orgId, payload) {
  return run(() => {
    assert(auth.can(orgId, CURRENT, 'member:manage'), '你在该机构没有成员管理权限')
    assert(payload.name && payload.name.trim(), '请填写成员姓名')
    assert(/^1\d{10}$/.test(payload.phone || ''), '请填写正确的手机号')
    const existed = store.members.find((item) => item.orgId === orgId && item.status === 'active' && userOf(item.userId).phone === payload.phone)
    assert(!existed, '该手机号已是机构成员')
    let user = store.users.find((item) => item.phone === payload.phone)
    if (!user) {
      user = {
        id: nextId('u'),
        nickname: payload.name.trim(),
        realName: payload.name.trim(),
        phone: payload.phone,
        avatar: '',
        title: payload.title || '成员',
        idVerified: false,
        verifyStatus: 'none',
        createdAt: now(),
      }
      store.users.push(user)
    }
    store.members.push({
      id: nextId('m'),
      orgId,
      userId: user.id,
      role: payload.role || 'member',
      joinedAt: now(),
      status: 'active',
    })
    log('org.member.add', orgId, `新增成员 ${payload.name}`)
    return { ok: true }
  })
}

function updateOrgMember(orgId, memberId, role) {
  return run(() => {
    assert(auth.can(orgId, CURRENT, 'member:manage'), '你在该机构没有成员管理权限')
    const member = store.members.find((item) => item.id === memberId && item.orgId === orgId)
    assert(member, '成员不存在')
    assert(member.role !== 'owner', '负责人角色不可变更')
    member.role = role
    log('org.member.update', orgId, `调整成员角色为 ${role}`)
    return { ok: true }
  })
}

function removeOrgMember(orgId, memberId) {
  return run(() => {
    assert(auth.can(orgId, CURRENT, 'member:manage'), '你在该机构没有成员管理权限')
    const member = store.members.find((item) => item.id === memberId && item.orgId === orgId)
    assert(member, '成员不存在')
    assert(member.role !== 'owner', '负责人不可移除')
    assert(member.userId !== CURRENT, '不能移除自己')
    member.status = 'removed'
    log('org.member.remove', orgId, '移除成员')
    return { ok: true }
  })
}

function getMyReviews() {
  return run(() => {
    const list = store.orders
      .filter((order) => sideOf(order, CURRENT) === 'demand' && ['completed', 'disputing'].includes(order.status))
      .sort((a, b) => (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt))
      .map((order) => ({
        ...decorateOrder(order),
        review: order.review
          ? { ...order.review, createdAtText: util.formatDate(order.review.createdAt, true) }
          : null,
      }))
    return {
      pending: list.filter((item) => !item.review),
      done: list.filter((item) => !!item.review),
    }
  })
}

function submitFeedback(payload) {
  return run(() => {
    assert(payload.content && payload.content.trim().length >= 5, '请描述你遇到的问题（至少 5 个字）')
    store.feedbacks.unshift({
      id: nextId('fb'),
      userId: CURRENT,
      userName: userOf(CURRENT).nickname,
      type: payload.type || '功能建议',
      content: payload.content.trim(),
      contact: payload.contact || '',
      createdAt: now(),
      status: 'pending',
    })
    log('feedback.create', 'feedback', payload.content.trim().slice(0, 40))
    return { ok: true }
  })
}

function getAuditLogs() {
  return run(() =>
    store.auditLogs.map((item) => ({ ...item, atText: util.formatDate(item.at, true) }))
  )
}

/* ------------------------------------------------------------------ */
/* 接单人推荐                                                          */
/* ------------------------------------------------------------------ */

const ACTIVE_ORDER_STATUS = ['pending_start', 'in_progress', 'pending_acceptance']
const MUNICIPALITIES = ['北京市', '上海市', '天津市', '重庆市', '香港特别行政区', '澳门特别行政区']

/**
 * 某个用户作为承接方的真实履约数据。
 * 全部从 store.orders / order.review 现算，缺数据即返回 0，
 * 不使用任何预置的评分、成交率或假评价。
 */
function providerStats(userId) {
  const supplierOrders = store.orders.filter((order) => order.supplier && order.supplier.userId === userId)
  const completedOrders = supplierOrders.filter((order) => order.status === 'completed')
  const reviews = completedOrders.map((order) => order.review).filter(Boolean)
  const completedByType = {}
  completedOrders.forEach((order) => {
    completedByType[order.serviceType] = (completedByType[order.serviceType] || 0) + 1
  })
  const prices = completedOrders.map((order) => Number(order.price)).filter((price) => price > 0)
  const ratingAvg = reviews.length
    ? reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviews.length
    : 0
  return {
    completed: completedOrders.length,
    completedByType,
    reviewCount: reviews.length,
    ratingAvg,
    avgPrice: prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0,
    activeOrders: supplierOrders.filter((order) => ACTIVE_ORDER_STATUS.includes(order.status)).length,
  }
}

function blankServiceProfile(userId) {
  return {
    id: '',
    userId,
    businessTypes: [],
    areas: [],
    serviceMode: '',
    orderStatus: 'accepting',
    monthlyCapacity: '',
    quoteMode: '',
    qualifications: [],
    yearsOfExperience: 0,
    intro: '',
    createdAt: 0,
    updatedAt: 0,
  }
}

function findProfile(userId) {
  return store.serviceProfiles.find((item) => item.userId === userId)
}

function scopeText(area) {
  if (!area) return ''
  if (area.city) return `${area.province} · ${area.city}`
  return `${area.province} · ${MUNICIPALITIES.includes(area.province) ? '全市' : '全省'}`
}

function areaSummary(areas) {
  const list = areas || []
  if (!list.length) return '未设置'
  const first = scopeText(list[0])
  return list.length > 1 ? `${first} 等 ${list.length} 个地区` : first
}

function orgOf(userId) {
  const orgId = auth.orgIdsOf(userId)[0]
  return store.orgs.find((item) => item.id === orgId) || {}
}

function decorateServiceProfile(profile) {
  const record = profile || blankServiceProfile(CURRENT)
  const stats = providerStats(record.userId)
  const completeness = recommend.profileCompleteness(profile)
  return {
    ...record,
    hasProfile: !!profile,
    businessLabels: (record.businessTypes || []).map((item) => dict.labelOf(dict.serviceTypes, item)),
    areaTexts: (record.areas || []).map((item) => scopeText(item)),
    areaSummary: areaSummary(record.areas),
    serviceModeLabel: dict.labelOf(dict.serviceModes, record.serviceMode, '未设置'),
    orderStatusLabel: dict.labelOf(dict.providerStatus, record.orderStatus, '未设置'),
    monthlyCapacityLabel: dict.labelOf(dict.monthlyCapacity, record.monthlyCapacity, '未设置'),
    quoteModeLabel: dict.labelOf(dict.quoteModes, record.quoteMode, '未设置'),
    qualificationLabels: (record.qualifications || []).map((item) => dict.labelOf(dict.qualifications, item)),
    yearsText: record.yearsOfExperience > 0 ? `${record.yearsOfExperience} 年` : '未填写',
    completeness,
    completenessPercent: Math.round(completeness * 100),
    isComplete: completeness >= 0.999,
    completedCount: stats.completed,
    activeOrderCount: stats.activeOrders,
    historyText:
      stats.reviewCount > 0
        ? `完成 ${stats.completed} 单 · ${stats.ratingAvg.toFixed(1)} 分`
        : stats.completed > 0
        ? `完成 ${stats.completed} 单 · 暂无评价`
        : '暂无历史记录',
    updatedAtText: record.updatedAt ? util.formatDate(record.updatedAt, true) : '未填写',
    accepting: record.orderStatus === 'accepting',
  }
}

function getServiceProfile() {
  return run(() => decorateServiceProfile(findProfile(CURRENT)))
}

/** 枚举去重 + 取值校验，避免前后端枚举不一致时静默写入脏数据 */
function sanitizeEnumList(values, dictList, label) {
  const list = Array.isArray(values) ? values : []
  const allowed = dictList.map((item) => item.value)
  const invalid = list.filter((item) => allowed.indexOf(item) < 0)
  assert(!invalid.length, `${label}包含不支持的选项`)
  return list.filter((item, index) => list.indexOf(item) === index)
}

/** 地区校验：省份必须存在于字典，城市必须属于该省；city 为空串代表全省 */
function sanitizeAreas(input) {
  const list = Array.isArray(input) ? input : []
  const result = []
  list.forEach((area) => {
    const province = area ? dict.regions.find((item) => item.name === area.province) : null
    assert(province, '可服务地区包含未知省份')
    const city = area.city || ''
    assert(!city || province.cities.indexOf(city) >= 0, `「${province.name}」下没有「${city}」`)
    if (!result.some((item) => item.province === province.name && item.city === city)) {
      result.push({ province: province.name, city })
    }
  })
  return result
}

function saveServiceProfile(payload) {
  const body = payload || {}
  return run(() => {
    // 服务端校验：实名认证 + 只能写自己的档案
    assert(auth.isVerified(CURRENT), '请先完成实名认证后再设置服务能力')
    const existing = findProfile(CURRENT)
    if (body.id) assert(existing && existing.id === body.id, '只能修改自己的服务能力档案')

    const businessTypes = sanitizeEnumList(body.businessTypes, dict.serviceTypes, '擅长业务')
    assert(businessTypes.length > 0, '请至少选择 1 项擅长业务')
    assert(businessTypes.length <= dict.serviceTypes.length, `擅长业务最多 ${dict.serviceTypes.length} 项`)

    const areas = sanitizeAreas(body.areas)
    assert(areas.length > 0, '请至少选择 1 个可服务地区')
    assert(areas.length <= 20, '可服务地区最多 20 个')

    assert(
      dict.serviceModes.some((item) => item.value === body.serviceMode),
      '请选择服务方式'
    )
    assert(
      dict.providerStatus.some((item) => item.value === body.orderStatus),
      '请选择接单状态'
    )
    assert(
      dict.monthlyCapacity.some((item) => item.value === body.monthlyCapacity),
      '请选择月度接单能力'
    )
    assert(
      dict.quoteModes.some((item) => item.value === body.quoteMode),
      '请选择报价方式'
    )

    const qualifications = sanitizeEnumList(body.qualifications || [], dict.qualifications, '相关资质')
    const years = Number(body.yearsOfExperience || 0)
    assert(isFinite(years) && years >= 0 && years <= 50, '服务年限需在 0—50 年之间')
    const intro = String(body.intro || '').trim()
    assert(intro.length <= 300, '服务介绍不超过 300 字')

    const record = {
      businessTypes,
      areas,
      serviceMode: body.serviceMode,
      orderStatus: body.orderStatus,
      monthlyCapacity: body.monthlyCapacity,
      quoteMode: body.quoteMode,
      qualifications,
      yearsOfExperience: years,
      intro,
      updatedAt: now(),
    }

    if (existing) {
      Object.assign(existing, record)
    } else {
      store.serviceProfiles.push(Object.assign({ id: nextId('sp'), userId: CURRENT, createdAt: now() }, record))
    }
    log(
      'service.profile.save',
      CURRENT,
      `保存服务能力档案（完整度 ${Math.round(recommend.profileCompleteness(record) * 100)}%）`
    )
    return decorateServiceProfile(findProfile(CURRENT))
  })
}

/** 服务者公开主页：不返回手机号等联系方式，联系方式仍走订单/私聊流程 */
function getProviderProfile(userId) {
  return run(() => {
    assert(userId, '缺少服务者参数')
    const user = store.users.find((item) => item.id === userId)
    assert(user, '服务者不存在或已注销')
    const profile = findProfile(userId)
    const org = orgOf(userId)
    return {
      ...decorateServiceProfile(profile),
      userId,
      nickname: user.nickname,
      title: user.title || '',
      avatar: userAvatar(userId, org.id),
      orgName: org.name || '',
      orgType: org.type === 'store' ? '门店' : '企业',
      orgStatus: org.status || 'none',
      orgStatusLabel: org.status === 'verified' ? '已认证' : org.status === 'pending' ? '审核中' : '未认证',
      idVerified: !!user.idVerified,
      isSelf: userId === CURRENT,
      canInvite: userId !== CURRENT && !!profile && profile.orderStatus === 'accepting',
    }
  })
}

/**
 * 场景 A：为任务推荐接单人。
 * 权限：仅任务发布方可查看；候选人由服务端按硬条件筛选后统一打分排序。
 */
function getRecommendedProviders(taskId, options) {
  const opts = options || {}
  const page = Math.max(1, Number(opts.page) || 1)
  const pageSize = Math.min(20, Math.max(1, Number(opts.pageSize) || 5))
  const relaxed = !!opts.relaxed
  return run(() => {
    const task = findOrThrow(store.tasks, taskId, '任务')
    const detail = decorateTask(task)
    const empty = (text, visible) => ({
      visible: visible !== false,
      list: [],
      total: 0,
      page,
      pageSize,
      hasMore: false,
      relaxed,
      excludedCount: 0,
      emptyText: text,
    })

    if (!auth.orgIdsOf(CURRENT).includes(task.publisherOrgId)) {
      return empty('仅任务发布方可查看推荐接单人', false)
    }
    if (detail.state !== 'open') {
      return empty('任务已结束，不再推荐接单人')
    }
    // 发布机构成员均可查看名单；只有具备任务管理权限的成员才能发起邀请
    const canInvite = auth.can(task.publisherOrgId, CURRENT, 'task:manage')

    const quotedUserIds = store.quotes
      .filter((item) => item.taskId === taskId && item.status !== 'withdrawn')
      .map((item) => item.userId)

    const candidates = store.serviceProfiles
      // 排除本人、发布者本人、与发布机构同机构的成员
      .filter((profile) => profile.userId !== CURRENT && profile.userId !== task.publisherUserId)
      .filter((profile) => !auth.orgIdsOf(profile.userId).includes(task.publisherOrgId))
      .filter((profile) => {
        const user = store.users.find((item) => item.id === profile.userId)
        return !!user && user.disabled !== true
      })
      .map((profile) => {
        const stats = providerStats(profile.userId)
        return {
          profile,
          userId: profile.userId,
          task,
          stats,
          load: { activeOrders: stats.activeOrders },
          relaxed,
        }
      })

    const ranked = recommend.rankProviders(candidates)

    const decorated = ranked.list.map((item) => {
      const user = userOf(item.userId)
      const org = orgOf(item.userId)
      const profile = item.profile
      return {
        userId: item.userId,
        rank: item.rank,
        score: item.score,
        completeness: item.completeness,
        reasons: item.reasons,
        flags: item.flags || [],
        avatar: userAvatar(item.userId, org.id),
        nickname: user.nickname,
        title: user.title || '',
        orgName: org.name || '',
        orgType: org.type === 'store' ? '门店' : '企业',
        orgStatus: org.status || 'none',
        orgStatusLabel: org.status === 'verified' ? '已认证' : org.status === 'pending' ? '审核中' : '未认证',
        idVerified: !!user.idVerified,
        businessLabels: (profile.businessTypes || []).slice(0, 2).map((v) => dict.labelOf(dict.serviceTypes, v)),
        businessMore: Math.max(0, (profile.businessTypes || []).length - 2),
        areaText: areaSummary(profile.areas),
        serviceModeLabel: dict.labelOf(dict.serviceModes, profile.serviceMode),
        orderStatusLabel: dict.labelOf(dict.providerStatus, profile.orderStatus),
        historyText: recommend.evaluateHistory(item.stats).text,
        hasQuoted: quotedUserIds.indexOf(item.userId) >= 0,
        canInvite: canInvite && quotedUserIds.indexOf(item.userId) < 0 && profile.orderStatus === 'accepting',
      }
    })

    const start = (page - 1) * pageSize
    return {
      visible: true,
      taskTitle: detail.title,
      list: decorated.slice(start, start + pageSize),
      total: decorated.length,
      page,
      pageSize,
      hasMore: start + pageSize < decorated.length,
      relaxed,
      excludedCount: ranked.rejected.length,
      emptyText: decorated.length
        ? ''
        : relaxed
        ? '放宽地区与接单状态后，仍没有符合该任务业务与资质要求的服务者'
        : '暂无完全匹配的服务者，可放宽条件看看',
    }
  })
}

/**
 * 场景 B：为接单人推荐任务。
 * 只做匹配与展示，不会自动报价或自动接单。
 */
function getRecommendedTasks(options) {
  const opts = options || {}
  const sort = dict.recommendSorts.some((item) => item.value === opts.sort) ? opts.sort : 'best'
  const page = Math.max(1, Number(opts.page) || 1)
  const pageSize = Math.min(20, Math.max(1, Number(opts.pageSize) || 10))
  return run(() => {
    const profile = findProfile(CURRENT)
    const profileView = decorateServiceProfile(profile)
    if (!profile) {
      return {
        needProfile: true,
        list: [],
        total: 0,
        page,
        pageSize,
        hasMore: false,
        sort,
        sorts: dict.recommendSorts,
        profile: profileView,
        emptyText: '完善「我的服务能力」后可获得个性化任务推荐',
      }
    }

    const stats = providerStats(CURRENT)
    const load = { activeOrders: stats.activeOrders }
    const myOrgIds = auth.orgIdsOf(CURRENT)
    const candidates = store.tasks
      .filter((task) => taskState(task) === 'open')
      .filter((task) => task.publisherUserId !== CURRENT)
      .filter((task) => myOrgIds.indexOf(task.publisherOrgId) < 0)
      .map((task) => ({ task, profile, stats, load }))

    const ranked = recommend.rankTasks(candidates)
    const sorted = recommend.sortTasks(ranked.list, sort)
    const decorated = sorted.map((item) =>
      Object.assign(decorateTask(item.task), {
        matchScore: item.score,
        matchReasons: item.reasons,
        onsiteRequired: item.onsiteRequired,
      })
    )

    const start = (page - 1) * pageSize
    const paused = profile.orderStatus !== 'accepting'
    return {
      needProfile: false,
      paused,
      profile: profileView,
      sorts: dict.recommendSorts,
      list: decorated.slice(start, start + pageSize),
      total: decorated.length,
      page,
      pageSize,
      hasMore: start + pageSize < decorated.length,
      sort,
      excludedCount: ranked.rejected.length,
      emptyText: paused
        ? '你当前设置为「暂不接单」，恢复接单后会继续收到推荐'
        : '暂无符合你服务能力的任务，可扩大擅长业务或服务地区',
    }
  })
}

/** 任务大厅入口用的轻量摘要，避免首页拉取整份推荐列表 */
function getRecommendSummary() {
  return run(() => {
    const profile = findProfile(CURRENT)
    const profileView = decorateServiceProfile(profile)
    if (!profile) {
      return {
        hasProfile: false,
        accepting: false,
        count: 0,
        hint: '完善服务能力，获取为你匹配的任务',
        profile: profileView,
      }
    }
    const stats = providerStats(CURRENT)
    const myOrgIds = auth.orgIdsOf(CURRENT)
    const candidates = store.tasks
      .filter((task) => taskState(task) === 'open')
      .filter((task) => task.publisherUserId !== CURRENT)
      .filter((task) => myOrgIds.indexOf(task.publisherOrgId) < 0)
      .map((task) => ({ task, profile, stats, load: { activeOrders: stats.activeOrders } }))
    const ranked = recommend.rankTasks(candidates)
    const paused = profile.orderStatus !== 'accepting'
    return {
      hasProfile: true,
      accepting: !paused,
      count: ranked.list.length,
      hint: paused
        ? '当前为「暂不接单」，恢复后可继续接收推荐'
        : ranked.list.length
        ? `已按你的服务能力匹配 ${ranked.list.length} 个任务`
        : '暂无符合服务能力的任务',
      profile: profileView,
    }
  }, 60)
}

/**
 * 邀请接单人报价。
 * 只负责建立沟通与通知，不生成订单、不改变任务状态；
 * 报价与成交仍走 saveQuote / acceptQuote 等既有接口。
 */
function inviteProvider(taskId, userId) {
  return run(() => {
    const task = findOrThrow(store.tasks, taskId, '任务')
    assert(auth.orgIdsOf(CURRENT).includes(task.publisherOrgId), '只有任务发布方可以邀请接单人')
    assert(auth.can(task.publisherOrgId, CURRENT, 'task:manage'), '你在该机构没有管理任务的权限')
    assert(taskState(task) === 'open', '任务已结束，无法邀请')
    assert(userId && userId !== CURRENT, '不能邀请自己')
    assert(!auth.orgIdsOf(userId).includes(task.publisherOrgId), '该服务者属于本机构，无需邀请')

    const user = store.users.find((item) => item.id === userId)
    assert(user, '服务者不存在或已注销')
    assert(user.disabled !== true, '该账号已被限制，无法邀请')

    const profile = findProfile(userId)
    assert(profile, '该服务者尚未填写服务能力')
    assert(profile.orderStatus === 'accepting', '该服务者当前暂不接单')

    const existingQuote = store.quotes.find(
      (item) => item.taskId === taskId && item.userId === userId && item.status !== 'withdrawn'
    )
    assert(!existingQuote, '该服务者已提交报价，无需重复邀请')

    // 幂等：同一任务对同一人只产生一条邀请记录与一条通知
    const invited = store.recommendEvents.find(
      (item) => item.kind === 'invite' && item.taskId === taskId && item.targetUserId === userId
    )
    if (!invited) {
      store.recommendEvents.unshift({
        id: nextId('rc'),
        at: now(),
        kind: 'invite',
        scene: 'provider',
        taskId,
        targetUserId: userId,
        viewerId: CURRENT,
      })
      pushMessage(
        'system',
        '收到协作邀请',
        `${userOf(CURRENT).nickname} 邀请你参与任务「${task.title}」的报价，可在任务详情中查看要求。`,
        taskId,
        'task'
      )
      log('recommend.invite', taskId, `邀请 ${user.nickname} 参与报价`)
    }

    const conversation = ensureConversation(userId, 'task', taskId)
    return { ok: true, invited: !invited, conversationId: conversation.id }
  })
}

/**
 * 推荐行为埋点：expose / click / invite / quote / order。
 * 不接受前端传入的分数，只记录真实的曝光与点击事实。
 */
function recordRecommendEvent(payload) {
  const body = payload || {}
  return run(() => {
    const kinds = ['expose', 'click', 'invite', 'quote', 'order']
    assert(kinds.indexOf(body.kind) >= 0, '未知的推荐行为类型')
    assert(['provider', 'task'].indexOf(body.scene) >= 0, '未知的推荐场景')
    const event = {
      id: nextId('rc'),
      at: now(),
      kind: body.kind,
      scene: body.scene,
      taskId: body.taskId || '',
      targetUserId: body.scene === 'provider' ? body.targetUserId || '' : '',
      viewerId: CURRENT,
    }
    store.recommendEvents.unshift(event)
    if (store.recommendEvents.length > 500) store.recommendEvents.length = 500
    return { ok: true, id: event.id }
  }, 30)
}

/** 推荐效果统计（当前用户视角），用于后续做曝光点击率与转化率看板 */
function getRecommendStats() {
  return run(() => {
    const mine = store.recommendEvents.filter((item) => item.viewerId === CURRENT)
    const countOf = (kind) => mine.filter((item) => item.kind === kind).length
    const expose = countOf('expose')
    const click = countOf('click')
    return {
      expose,
      click,
      invite: countOf('invite'),
      quote: countOf('quote'),
      order: countOf('order'),
      clickRate: expose ? Math.round((click / expose) * 100) : 0,
      inviteRate: click ? Math.round((countOf('invite') / click) * 100) : 0,
    }
  }, 40)
}

/* ------------------------------------------------------------------ */
/* 公告牌                                                              */
/* ------------------------------------------------------------------ */

/**
 * 公告统一视图。
 * contact 只在详情场景返回（withContact=true），列表永远拿不到联系方式；
 * 详情页默认展示打码版本，需要用户主动点击才展示完整内容。
 */
function decorateNotice(notice, ts, options) {
  const opts = options || {}
  const status = noticeApi.deriveStatus(notice, ts)
  const badge = noticeApi.badgeOf(notice, store.noticeOrders, ts)
  const pkg = noticeApi.packageOf(notice.plan)
  const order = noticeApi.paidOrderOf(notice, store.noticeOrders, ts)
  const publisher = userOf(notice.publisherUserId)
  const org = store.orgs.find((item) => item.id === notice.publisherOrgId) || {}
  const remainDays = noticeApi.remainDays(notice, ts)
  return {
    id: notice.id,
    title: notice.title,
    content: notice.content,
    summary: notice.content.replace(/\s+/g, ' ').slice(0, 64),
    category: notice.category,
    categoryLabel: dict.labelOf(dict.noticeCategories, notice.category),
    region: notice.region || '',
    regionText: notice.region || '不限地区',
    status,
    statusLabel: dict.labelOf(dict.noticeStatus, status),
    statusTag: dict.tagOf(dict.noticeStatus, status),
    publisherUserId: notice.publisherUserId,
    publisherName: publisher.nickname,
    publisherTitle: publisher.title || '',
    publisherOrgName: org.name || '',
    publisherAvatar: userAvatar(notice.publisherUserId, notice.publisherOrgId),
    publisherVerified: !!publisher.idVerified,
    createdAtText: util.fromNow(notice.createdAt),
    publishedAtText: util.formatDate(notice.createdAt, true),
    validPeriodText: notice.endAt ? `至 ${util.formatDate(notice.endAt)}` : '审核通过后开始计时',
    remainText: remainDays > 0 ? `剩余 ${remainDays} 天` : '已结束',
    periodText: notice.endAt
      ? `至 ${util.formatDate(notice.endAt)} · ${remainDays > 0 ? `剩余 ${remainDays} 天` : '已结束'}`
      : '审核通过后开始计时',
    promotionText: order ? `${pkg.label} · 演示订单` : '普通公告',
    viewCount: notice.viewCount,
    viewCountText: `${notice.viewCount} 次浏览`,
    plan: notice.plan,
    planLabel: pkg.label,
    planPriceText: pkg.price > 0 ? `¥${pkg.price.toFixed(2)}` : '免费',
    badgeText: badge.text,
    badgeTag: badge.tag,
    isPaidTop: badge.text === '置顶',
    hasPaidOrder: !!order,
    orderId: notice.orderId,
    rejectReason: notice.rejectReason || '',
    isOwner: notice.publisherUserId === CURRENT,
    canContact: noticeApi.isWithinPeriod(notice, ts) && notice.publisherUserId !== CURRENT,
    contact: opts.withContact ? notice.contact || '' : '',
    contactMasked: opts.withContact ? noticeApi.maskContact(notice.contact) : '',
    auditTrail: (notice.auditTrail || []).map((item) => ({
      action: item.action,
      by: item.by,
      remark: item.remark || '',
      atText: util.formatDate(item.at, true),
    })),
  }
}

/**
 * 公告列表。
 * 公开列表：只返回「审核通过 + 展示期内」的公告，按付费优先 → 发布时间排序。
 * mine=true：返回本人的全部公告（含待审核 / 未通过 / 已过期），按时间倒序。
 */
function getNoticeList(params) {
  const body = params || {}
  const keyword = String(body.keyword || '')
  const category = body.category || ''
  const mine = !!body.mine
  const page = Math.max(1, Number(body.page) || 1)
  const pageSize = Math.min(20, Math.max(1, Number(body.pageSize) || 10))

  return run(() => {
    const ts = now()
    let list
    if (mine) {
      list = store.notices.filter((item) => item.publisherUserId === CURRENT)
      // 同一时间戳按 id 升序兜底，保证多次进入顺序一致
      list = list
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    } else {
      list = noticeApi.filterPublic(store.notices, ts)
      list = list.filter((item) => noticeApi.matchesCategory(item, category))
      list = list.filter((item) => noticeApi.matchesKeyword(item, keyword))
      list = noticeApi.sortNotices(list, store.noticeOrders, ts)
    }
    const start = (page - 1) * pageSize
    return {
      list: list.slice(start, start + pageSize).map((item) => decorateNotice(item, ts)),
      total: list.length,
      page,
      pageSize,
      hasMore: start + pageSize < list.length,
      mine,
    }
  })
}

function getNoticeDetail(noticeId) {
  return run(() => {
    const notice = findOrThrow(store.notices, noticeId, '公告')
    const ts = now()
    const isOwner = notice.publisherUserId === CURRENT
    assert(isOwner || noticeApi.isWithinPeriod(notice, ts), '该公告未通过审核或已结束展示')
    // 浏览量只统计真实访问，发布者自己查看不计入
    if (!isOwner) notice.viewCount += 1
    return decorateNotice(notice, ts, { withContact: true })
  })
}

/** 发布公告：统一进入待审核，付费套餐不能改变审核状态 */
function saveNotice(payload) {
  return run(() => {
    const body = payload || {}
    assert(auth.isVerified(CURRENT), '请先完成实名认证后再发布公告')
    const error = noticeApi.validateNotice(body)
    assert(!error, error)

    const ts = now()
    const record = {
      id: nextId('nt'),
      title: String(body.title).trim(),
      content: String(body.content).trim(),
      category: body.category,
      region: String(body.region || '').trim(),
      contact: String(body.contact || '').trim(),
      publisherUserId: CURRENT,
      publisherOrgId: auth.orgIdsOf(CURRENT)[0] || '',
      status: 'pending',
      rejectReason: '',
      createdAt: ts,
      updatedAt: ts,
      startAt: 0,
      endAt: 0,
      viewCount: 0,
      plan: 'free',
      orderId: '',
      auditTrail: [{ at: ts, action: '提交审核', by: userOf(CURRENT).nickname }],
    }
    store.notices.unshift(record)
    log('notice.submit', record.id, `提交公告「${record.title}」`)
    pushMessage('system', '公告已提交审核', `「${record.title}」已提交，审核通过后会在公告牌中展示。`, record.id, 'notice')
    return decorateNotice(record, ts, { withContact: true })
  })
}

/** 套餐配置：价格与天数全部来自 dict.noticePackages，页面不另写常量 */
function getNoticePackages() {
  return run(() => ({
    demoOnly: true,
    tip: '演示流程，暂未开通真实支付',
    list: dict.noticePackages.map((item) => ({
      value: item.value,
      label: item.label,
      description: item.description,
      price: item.price,
      priceText: item.price > 0 ? `¥${item.price.toFixed(2)}` : '免费',
      days: item.days,
      daysText: `${item.days} 天`,
      badge: item.badge || '',
      paid: item.price > 0,
    })),
  }), 60)
}

/**
 * 创建公告推广订单（纯 Mock）。
 * 明确约定：
 *   1. 不接入微信支付，不发起任何真实支付请求；
 *   2. 订单状态固定为 mock_paid，不写成 paid，避免被当成真实收款；
 *   3. 下单不会改变审核状态，未审核通过的公告即使买了套餐也不会进入公开列表。
 */
function createNoticeOrder(payload) {
  const body = payload || {}
  return run(() => {
    const notice = findOrThrow(store.notices, body.noticeId, '公告')
    assert(notice.publisherUserId === CURRENT, '只能为自己的公告购买推广套餐')
    const pkg = dict.noticePackages.find((item) => item.value === body.plan)
    assert(pkg, '推广套餐不存在')
    if (!pkg.price) {
      return { ok: true, mock: true, demoOnly: true, order: null, message: '普通公告免费，无需下单' }
    }
    assert(!notice.orderId, '该公告已购买过推广套餐')

    const ts = now()
    const order = {
      id: nextId('no'),
      noticeId: notice.id,
      userId: CURRENT,
      plan: pkg.value,
      amount: pkg.price,
      days: pkg.days,
      status: 'mock_paid',
      payMode: 'demo',
      mock: true,
      createdAt: ts,
      paidAt: ts,
      expireAt: ts + pkg.days * noticeApi.DAY,
      remark: '演示订单，未发生真实支付',
    }
    store.noticeOrders.unshift(order)
    notice.plan = pkg.value
    notice.orderId = order.id
    notice.updatedAt = ts
    // 只在公告已通过审核时顺延展示期；待审核状态不受付费影响
    if (notice.status === 'approved' && notice.endAt) {
      notice.endAt = Math.max(notice.endAt, order.expireAt)
    }
    log('notice.order', notice.id, `演示下单 ${pkg.label}（¥${pkg.price}），未发生真实支付`)
    return {
      ok: true,
      mock: true,
      demoOnly: true,
      message: '演示下单成功，未发生真实支付',
      order: {
        id: order.id,
        plan: order.plan,
        planLabel: pkg.label,
        amount: order.amount,
        amountText: `¥${order.amount.toFixed(2)}`,
        days: order.days,
        status: order.status,
        statusLabel: '演示已下单',
        expireText: util.formatDate(order.expireAt, true),
        remark: order.remark,
      },
    }
  })
}

/** 复用现有私聊能力联系发布者，不伪造会话创建结果 */
function contactNoticePublisher(noticeId) {
  return run(() => {
    const notice = findOrThrow(store.notices, noticeId, '公告')
    assert(notice.publisherUserId !== CURRENT, '这是你自己发布的公告')
    assert(noticeApi.isWithinPeriod(notice, now()), '该公告已结束展示，无法联系发布者')
    const conversation = ensureConversation(notice.publisherUserId, 'none', '')
    const peer = userOf(notice.publisherUserId)
    return {
      conversationId: conversation.id,
      peerId: notice.publisherUserId,
      peerName: peer.nickname,
    }
  }, 60)
}

module.exports = {
  getSession,
  switchOrg,
  getTaskList,
  getTaskDetail,
  saveTask,
  cancelTask,
  getTaskQuotes,
  getQuoteDetail,
  saveQuote,
  withdrawQuote,
  acceptQuote,
  getMyQuotes,
  getOrderList,
  getOrderDetail,
  updateProgress,
  submitEvidence,
  acceptDelivery,
  requestCancelOrder,
  respondCancelOrder,
  createFeeChange,
  confirmFeeChange,
  declarePayment,
  confirmPayment,
  applyDispute,
  reviewOrder,
  getTopicList,
  getTopicDetail,
  createTopic,
  toggleTopicLike,
  toggleTopicFavorite,
  addComment,
  toggleCommentLike,
  reportContent,
  getMyContents,
  getMessages,
  readMessage,
  readAllMessages,
  getChatList,
  getChatDetail,
  startChat,
  sendChatMessage,
  readAllChats,
  getProfile,
  updateProfile,
  updateAvatar,
  resetAvatar,
  submitVerify,
  getOrgList,
  getOrgDetail,
  addOrgMember,
  updateOrgMember,
  removeOrgMember,
  getMyReviews,
  submitFeedback,
  getAuditLogs,
  /* 接单人推荐 */
  getServiceProfile,
  saveServiceProfile,
  getProviderProfile,
  getRecommendedProviders,
  getRecommendedTasks,
  getRecommendSummary,
  inviteProvider,
  recordRecommendEvent,
  getRecommendStats,
  /* 公告牌 */
  getNoticeList,
  getNoticeDetail,
  saveNotice,
  getNoticePackages,
  createNoticeOrder,
  contactNoticePublisher,
}
