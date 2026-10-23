/**
 * 云函数 api：统一入口，按 action 路由分发。
 *
 * action 形如 "user.login"，第一段对应 modules/ 下的域名模块，第二段对应该模块导出的方法。
 * 统一返回 { ok: true, data } / { ok: false, message }，客户端在 utils/api.js 的 cloudCall 中解包。
 *
 * 身份一律来自 cloud.getWXContext().OPENID，不再使用硬编码的 CURRENT_USER_ID。
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const modules = {
  user: require('./modules/user'),
  task: require('./modules/task'),
  quote: require('./modules/quote'),
  order: require('./modules/order'),
  chat: require('./modules/chat'),
  notice: require('./modules/notice'),
  org: require('./modules/org'),
}

function fail(message) {
  return { ok: false, message }
}

exports.main = async (event) => {
  const { action = '', params = {} } = event || {}
  const wxContext = cloud.getWXContext()

  /** 每个请求的上下文：身份 + 数据库句柄，各域模块只通过它取身份与数据 */
  const ctx = {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
    db,
    cloud,
  }

  if (!ctx.openid) return fail('无法获取用户身份（OPENID 缺失）')

  const [domain, method] = String(action).split('.')
  const mod = modules[domain]
  if (!mod) return fail(`云函数暂不支持该业务域：${domain || action}`)
  if (typeof mod[method] !== 'function') return fail(`云函数暂不支持该操作：${action}`)

  try {
    const data = await mod[method](params, ctx)
    return { ok: true, data: data === undefined ? null : data }
  } catch (err) {
    console.error(`[api] ${action} 执行失败`, err)
    return fail(err && err.friendly ? err.message : '服务异常，请稍后重试')
  }
}
