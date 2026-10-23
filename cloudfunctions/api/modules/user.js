/**
 * 身份域。
 *
 * 职责：
 * 1. 用 OPENID 作为唯一身份来源，取代硬编码的 CURRENT_USER_ID='u1'；
 * 2. 首次调用即建档（users 集合），重复调用返回同一用户；
 * 3. 并发建档靠 openid 唯一索引兜底：冲突后重新查询，不把并发当失败。
 *
 * 安全约定：
 * - idVerified / status / idCardLast4 / 各时间戳只允许云函数写入，客户端传入的一律忽略；
 * - 不存储身份证号，只保留实名认证通过后写入的后四位（实名认证不在本卡范围，字段先留空）。
 */
const db = require('../_shared/db')

const COLLECTION = 'users'
const DEFAULT_STATUS = 'normal'
const DEFAULT_NICKNAME = '新用户'

/** 允许客户端写入的资料字段，其余字段一律由服务端决定 */
const CLIENT_FIELDS = ['nickname', 'phone', 'title', 'avatarUrl', 'avatarFileId']

/** 不可继续使用的状态 → 提示文案 */
const BLOCKED_STATUS = {
  disabled: '账号已被禁用，如有疑问请联系管理员',
  deleted: '账号已注销，无法继续使用',
}

function reject(message) {
  const err = new Error(message)
  err.friendly = true
  throw err
}

/** 只取白名单内的字段，长度做上限，昵称缺失时给默认值 */
function pickProfile(input) {
  const source = input || {}
  const profile = {}
  CLIENT_FIELDS.forEach((field) => {
    const value = source[field]
    if (value === undefined || value === null) return
    profile[field] = typeof value === 'string' ? value.trim().slice(0, 60) : value
  })
  if (!profile.nickname) profile.nickname = DEFAULT_NICKNAME
  return profile
}

/** 对外返回的用户信息：不含任何服务端内部字段 */
function publicUser(record) {
  return {
    userId: record._id,
    openid: record.openid,
    nickname: record.nickname || DEFAULT_NICKNAME,
    phone: record.phone || '',
    title: record.title || '',
    idVerified: !!record.idVerified,
    idCardLast4: record.idCardLast4 || '',
    avatarUrl: record.avatarUrl || '',
    avatarFileId: record.avatarFileId || '',
    status: record.status || DEFAULT_STATUS,
    createdAt: record.createdAt || 0,
    lastLoginAt: record.lastLoginAt || 0,
  }
}

async function findByOpenid(openid) {
  const res = await db.collection(COLLECTION).where({ openid }).limit(1).get()
  return res && res.data && res.data[0] ? res.data[0] : null
}

/** 已禁用 / 已注销的账号不得继续使用 */
function assertUsable(record) {
  if (!record) return
  const message = BLOCKED_STATUS[record.status]
  if (message) reject(message)
}

async function touchLogin(record) {
  const at = db.now()
  await db.collection(COLLECTION).doc(record._id).update({ data: { lastLoginAt: at, updatedAt: at } })
  record.lastLoginAt = at
  return record
}

/**
 * 登录：按 openid 查，查不到则建档；并发下若唯一索引冲突则重新查询。
 * 每次调用都会刷新 lastLoginAt。
 */
async function login(params, ctx) {
  const openid = ctx.openid
  let record = await findByOpenid(openid)
  let isNew = false

  if (!record) {
    const at = db.now()
    const data = Object.assign({}, pickProfile(params), {
      openid,
      idVerified: false,
      idCardLast4: '',
      status: DEFAULT_STATUS,
      createdAt: at,
      updatedAt: at,
      lastLoginAt: at,
    })
    try {
      const added = await db.collection(COLLECTION).add({ data })
      record = Object.assign({ _id: added._id }, data)
      isNew = true
    } catch (err) {
      if (!db.isDuplicateError(err)) throw err
      // 并发：同一 openid 的另一个请求刚建好档，重新查询后按既有用户返回
      record = await findByOpenid(openid)
      if (!record) throw err
    }
  }

  assertUsable(record)
  await touchLogin(record)

  return {
    userId: record._id,
    openid,
    status: record.status,
    isNew,
    user: publicUser(record),
  }
}

/**
 * 当前身份：返回真实 userId 与 status。
 * 未建档返回 bound=false（首次进入的正常状态）；已禁用 / 已注销返回明确错误。
 */
async function whoami(params, ctx) {
  const record = await findByOpenid(ctx.openid)
  if (!record) {
    return { openid: ctx.openid, appid: ctx.appid, userId: null, bound: false, status: null }
  }
  assertUsable(record)
  return {
    openid: ctx.openid,
    appid: ctx.appid,
    userId: record._id,
    bound: true,
    status: record.status,
    user: publicUser(record),
  }
}

module.exports = { whoami, login }
