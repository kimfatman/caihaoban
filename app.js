const api = require('./utils/api')

App({
  globalData: {
    session: null,
    /** 消息页默认展示的页签：notice 通知 / chat 私聊 */
    messageTab: 'notice',
    /**
     * 成交操作的幂等键，模拟客户端发起「接受报价」时携带的唯一请求号，
     * 服务端在同一任务上只允许生成一个订单。
     */
    idempotencyKeys: {},
  },

  onLaunch() {
    this.refreshSession()
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
