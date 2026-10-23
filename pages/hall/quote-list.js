const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    taskId: '',
    task: null,
    quotes: [],
    total: 0,
    isDemander: false,
    canAccept: false,
    loading: true,
  },

  onLoad(options) {
    this.setData({ taskId: options.taskId })
  },

  onShow() {
    this.loadList()
  },

  loadList() {
    api
      .getTaskQuotes(this.data.taskId)
      .then((res) => {
        this.setData({
          task: res.task,
          quotes: res.quotes,
          total: res.total,
          isDemander: res.isDemander,
          canAccept: res.canAccept,
          loading: false,
        })
      })
      .catch((err) => {
        this.setData({ loading: false })
        util.toast(err.message)
      })
  },

  onQuoteTap(e) {
    wx.navigateTo({ url: `/pages/hall/quote-detail?id=${e.currentTarget.dataset.id}` })
  },

  onAcceptTap(e) {
    const quoteId = e.currentTarget.dataset.id
    const quote = this.data.quotes.find((item) => item.id === quoteId)
    if (!this.data.canAccept) {
      util.toast('你在当前机构没有确认成交的权限')
      return
    }
    wx.showModal({
      title: '确认接受报价',
      content: `接受「${quote.orgName}」的报价 ${quote.amountText}？确认后将生成唯一订单，其余报价自动失效。`,
      confirmColor: '#1b6ef3',
      success: (res) => {
        if (!res.confirm) return
        util.loading('正在生成订单')
        api
          .acceptQuote({
            quoteId,
            idempotencyKey: `accept-${this.data.taskId}-${quoteId}`,
          })
          .then((result) => {
            util.hideLoading()
            util.toast(result.duplicated ? '该任务已成交，已为你打开订单' : '成交成功', 'success')
            setTimeout(() => {
              wx.redirectTo({ url: `/pages/order/order-detail?id=${result.orderId}` })
            }, 600)
          })
          .catch((err) => {
            util.hideLoading()
            util.toast(err.message)
          })
      },
    })
  },

  goTask() {
    wx.navigateTo({ url: `/pages/hall/task-detail?id=${this.data.taskId}` })
  },

  onChatTap(e) {
    const { id, user } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/message/chat?userId=${user}&bizType=quote&bizId=${id}`,
    })
  },
})
