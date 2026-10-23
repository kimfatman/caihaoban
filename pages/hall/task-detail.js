const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    taskId: '',
    task: null,
    myQuote: null,
    loading: true,
    /* 推荐接单人 */
    recVisible: false,
    recLoading: false,
    recLoadingMore: false,
    recError: '',
    recList: [],
    recPage: 1,
    recPageSize: 5,
    recHasMore: false,
    recTotal: 0,
    recExcluded: 0,
    recRelaxed: false,
    recEmptyText: '',
  },

  onLoad(options) {
    this.setData({ taskId: options.id })
  },

  onShow() {
    if (this.data.taskId) this.loadDetail()
  },

  loadDetail() {
    const { taskId } = this.data
    this.setData({ loading: true })
    api
      .getTaskDetail(taskId)
      .then((task) => {
        this.setData({ task, loading: false })
        const quoteId = task.myQuoteId || task.orgQuoteId
        if (quoteId) {
          api.getQuoteDetail(quoteId).then((quote) => {
            this.setData({ myQuote: quote })
          })
        }
        this.loadRecommend(task)
        return null
      })
      .catch((err) => {
        this.setData({ loading: false })
        util.toast(err.message)
      })
  },

  /* ---------------- 推荐接单人 ---------------- */

  /** 仅发布方且任务处于开放状态时才请求推荐，接口内部还会再校验一次权限 */
  loadRecommend(task) {
    const current = task || this.data.task
    if (!current || !current.isDemander || current.state !== 'open') {
      this.setData({ recVisible: false, recLoading: false, recList: [] })
      return Promise.resolve()
    }
    this.setData({ recLoading: true, recError: '', recPage: 1 })
    return api
      .getRecommendedProviders(current.id, {
        page: 1,
        pageSize: this.data.recPageSize,
        relaxed: this.data.recRelaxed,
      })
      .then((res) => {
        this.setData({
          recVisible: !!res.visible,
          recLoading: false,
          recError: '',
          recList: res.list,
          recTotal: res.total,
          recHasMore: res.hasMore,
          recExcluded: res.excludedCount || 0,
          recEmptyText: res.emptyText || '',
          recPage: 1,
        })
        // 曝光埋点：同一任务 + 同一候选人只记一次
        if (!this.exposedProviders) this.exposedProviders = {}
        res.list.forEach((item) => {
          const key = `${current.id}_${item.userId}`
          if (this.exposedProviders[key]) return
          this.exposedProviders[key] = true
          api
            .recordRecommendEvent({
              kind: 'expose',
              scene: 'provider',
              taskId: current.id,
              targetUserId: item.userId,
            })
            .catch(() => {})
        })
      })
      .catch((err) => {
        this.setData({ recLoading: false, recError: err.message || '推荐加载失败' })
      })
  },

  loadMoreRecommend() {
    const { task, recHasMore, recLoadingMore, recPage, recPageSize, recRelaxed } = this.data
    if (!task || !recHasMore || recLoadingMore) return
    const page = recPage + 1
    this.setData({ recLoadingMore: true })
    api
      .getRecommendedProviders(task.id, { page, pageSize: recPageSize, relaxed: recRelaxed })
      .then((res) => {
        this.setData({
          recList: this.data.recList.concat(res.list),
          recPage: page,
          recHasMore: res.hasMore,
          recLoadingMore: false,
        })
      })
      .catch((err) => {
        this.setData({ recLoadingMore: false })
        util.toast(err.message)
      })
  },

  onToggleRelax() {
    this.setData({ recRelaxed: !this.data.recRelaxed })
    this.loadRecommend()
  },

  onRetryRecommend() {
    this.loadRecommend()
  },

  onInviteProvider(e) {
    const userId = e.detail.userId
    const { task } = this.data
    if (!task || !userId) return
    api
      .recordRecommendEvent({ kind: 'invite', scene: 'provider', taskId: task.id, targetUserId: userId })
      .catch(() => {})
    api
      .inviteProvider(task.id, userId)
      .then((res) => util.toast(res.invited ? '已发送协作邀请' : '此前已邀请过该服务者', 'success'))
      .catch((err) => util.toast(err.message))
  },

  onProviderProfile(e) {
    const userId = e.detail.userId
    if (!userId) return
    wx.navigateTo({ url: `/pages/provider/detail?userId=${userId}&taskId=${this.data.task.id}` })
  },

  goTaskHall() {
    wx.switchTab({ url: '/pages/hall/hall' })
  },

  onQuoteTap() {
    const { task, myQuote } = this.data
    if (myQuote) {
      wx.navigateTo({ url: `/pages/hall/quote-submit?quoteId=${myQuote.id}` })
      return
    }
    wx.navigateTo({ url: `/pages/hall/quote-submit?taskId=${task.id}` })
  },

  onQuoteListTap() {
    wx.navigateTo({ url: `/pages/hall/quote-list?taskId=${this.data.task.id}` })
  },

  goOrder() {
    wx.navigateTo({ url: `/pages/order/order-detail?id=${this.data.task.orderId}` })
  },

  onEditTap() {
    wx.navigateTo({ url: `/pages/hall/task-publish?id=${this.data.task.id}` })
  },

  onCancelTap() {
    const { task } = this.data
    wx.showModal({
      title: '取消任务',
      content: '取消后任务关闭，已提交的报价将自动失效，且不会自动重新开放。',
      editable: true,
      placeholderText: '请填写取消原因',
      confirmColor: '#e54545',
      success: (res) => {
        if (!res.confirm) return
        api
          .cancelTask(task.id, res.content)
          .then(() => {
            util.toast('任务已取消', 'success')
            this.loadDetail()
          })
          .catch((err) => util.toast(err.message))
      },
    })
  },

  onPreviewFile(e) {
    const file = e.currentTarget.dataset.file
    util.toast(`${file.name}：示例环境暂不支持在线预览`)
  },

  onCopyOrg() {
    wx.setClipboardData({ data: this.data.task.publisherOrgName })
  },

  onChatTap() {
    const { task } = this.data
    if (!task || !task.canChat) return
    wx.navigateTo({
      url: `/pages/message/chat?userId=${task.publisherUserId}&bizType=task&bizId=${task.id}`,
    })
  },
})
