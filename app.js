const api = require('./utils/api')

/** 云开发环境 ID（云开发控制台 → 设置 → 环境 ID） */
const CLOUD_ENV = 'cloud1-d9g6b40nx0c9b0405'

App({
  globalData: {
    session: null,
    /** 消息页默认展示的页签：notice 通知 / chat 私聊 */
    messageTab: 'notice',
    /** 云函数返回的真实身份：{ openid, appid, userId, bound }，未就绪时为 null */
    cloudIdentity: null,
    /**
     * 成交操作的幂等键，模拟客户端发起「接受报价」时携带的唯一请求号，
     * 服务端在同一任务上只允许生成一个订单。
     */
    idempotencyKeys: {},
  },

  onLaunch() {
    this.initCloud()
    this.refreshSession()
  },

  /**
   * 初始化云开发。失败不影响原型继续运行：cloudEnabled 为 false 时，
   * utils/api.js 仍走内存 Mock。
   */
  initCloud() {
    if (typeof wx === 'undefined' || !wx.cloud) {
      console.warn('[cloud] 当前环境不支持 wx.cloud，继续使用本地 Mock')
      return
    }
    wx.cloud.init({ env: CLOUD_ENV, traceUser: true })
    const ready = api.enableCloud()
    if (!ready) {
      console.warn('[cloud] 初始化失败，继续使用本地 Mock')
      return
    }
    this.loadCloudIdentity()
  },

  /** 拉取云函数返回的真实身份，用于验证「身份来自 OPENID」这条链路是否打通 */
  loadCloudIdentity() {
    api
      .getCloudIdentity()
      .then((identity) => {
        this.globalData.cloudIdentity = identity
        console.log('[cloud] 身份就绪 openid=', identity.openid)
        if (!identity.bound) return this.registerCloudUser()
        return identity
      })
      .catch((err) => console.warn('[cloud] 身份获取失败：', err.message))
  },

  /** 首次进入：在 users 集合建档，拿到后续业务要用的真实 userId */
  registerCloudUser() {
    return api
      .cloudLogin()
      .then((res) => {
        this.globalData.cloudIdentity = Object.assign({}, this.globalData.cloudIdentity, res)
        console.log('[cloud] 建档完成 userId=', res.userId)
      })
      .catch((err) => console.warn('[cloud] 建档失败：', err.message))
  },

  refreshSession() {
    return api.getSession().then((session) => {
      this.globalData.session = session
      return session
    })
  },

  /**
   * 页面通用取会话方法：确保首屏可以拿到当前登录用户。
   */
  ensureSession() {
    if (this.globalData.session) return Promise.resolve(this.globalData.session)
    return this.refreshSession()
  },
})
