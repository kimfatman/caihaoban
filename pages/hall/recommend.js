const api = require('../../utils/api')
const dict = require('../../utils/dict')

Page({
  data: {
    sorts: dict.recommendSorts,
    sort: 'best',
    list: [],
    total: 0,
    page: 1,
    pageSize: 8,
    hasMore: false,
    loading: true,
    loadingMore: false,
    error: '',
    needProfile: false,
    paused: false,
    emptyText: '',
    profile: null,
  },

  onLoad() {
    // 曝光去重：同一页面实例内同一任务只记一次曝光
    this.exposed = {}
    this.load(true)
  },

  onPullDownRefresh() {
    this.load(true).then(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading && !this.data.loadingMore) this.load(false)
  },

  load(reset) {
    const page = reset ? 1 : this.data.page + 1
    this.setData(reset ? { loading: true, error: '' } : { loadingMore: true })

    return api
      .getRecommendedTasks({ sort: this.data.sort, page, pageSize: this.data.pageSize })
      .then((res) => {
        this.setData({
          loading: false,
          loadingMore: false,
          error: '',
          needProfile: !!res.needProfile,
          paused: !!res.paused,
          profile: res.profile || null,
          emptyText: res.emptyText || '',
          list: reset ? res.list : this.data.list.concat(res.list),
          total: res.total,
          page,
          hasMore: res.hasMore,
        })
        // 曝光埋点：只记录真实渲染出来、且本页面尚未记录过的任务
        res.list.forEach((item) => {
          if (this.exposed[item.id]) return
          this.exposed[item.id] = true
          api.recordRecommendEvent({ kind: 'expose', scene: 'task', taskId: item.id }).catch(() => {})
        })
      })
      .catch((err) => {
        // 失败时保留已有列表，仅提示错误并提供重试
        this.setData({
          loading: false,
          loadingMore: false,
          error: err.message || '加载失败，请重试',
        })
      })
  },

  onSortTap(e) {
    const sort = e.currentTarget.dataset.value
    if (!sort || sort === this.data.sort) return
    this.setData({ sort, list: [], hasMore: false })
    this.load(true)
  },

  onTaskTap(e) {
    const id = (e.detail && e.detail.id) || e.currentTarget.dataset.id
    if (!id) return
    api.recordRecommendEvent({ kind: 'click', scene: 'task', taskId: id }).catch(() => {})
    wx.navigateTo({ url: `/pages/hall/task-detail?id=${id}` })
  },

  /** 列表内直接去报价：已报过价则进入修改，避免重复提交报错 */
  onQuoteTap(e) {
    const id = e.detail && e.detail.id
    if (!id) return
    const task = this.data.list.find((item) => item.id === id)
    if (!task) return
    api.recordRecommendEvent({ kind: 'click', scene: 'task', taskId: id }).catch(() => {})
    const quoteId = task.myQuoteId || task.orgQuoteId
    wx.navigateTo({
      url: quoteId ? `/pages/hall/quote-submit?quoteId=${quoteId}` : `/pages/hall/quote-submit?taskId=${id}`,
    })
  },

  onRetry() {
    this.load(true)
  },

  goProfile() {
    wx.navigateTo({ url: '/pages/mine/service-profile' })
  },

  goHall() {
    wx.switchTab({ url: '/pages/hall/hall' })
  },
})
