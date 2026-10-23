/**
 * 身份域。
 *
 * 第一版职责：把请求身份从「客户端硬编码 CURRENT_USER_ID='u1'」换成「云函数上下文的 OPENID」。
 * 当前只返回 OPENID，不伪造 userId —— users 集合建立后（独立任务卡）再补 openid → userId 的映射与建档。
 */
async function whoami(params, ctx) {
  return {
    openid: ctx.openid,
    appid: ctx.appid,
    userId: null,
    bound: false,
  }
}

async function login(params, ctx) {
  // TODO(users 集合就绪后)：按 openid 查询 users，不存在则建档，返回完整会话
  return {
    openid: ctx.openid,
    userId: null,
    isNew: true,
  }
}

module.exports = { whoami, login }
