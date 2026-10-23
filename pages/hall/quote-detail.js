const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    quoteId: '',
    quote: null,
    accepting: false,
  },

  onLoad(options) {
    this.setData({ quoteId: options.id })
  },

  onShow() {
    this.loadDetail()
  },

  loadDetail() {
    api
      .getQuoteDetail(this.data.quoteId)
      .then((quote) => this.setData({ quote }))
      .catch((err) => util.toast(err.message))
  },

  onAccept() {
    const { quote, accepting } = this.data
    if (accepting) return
    wx.showModal({
      title: '确认接受报价',
      content: `接受「${quote.orgName}」的报价 ${quote.amountText}？确认后生成唯一订单，其余报价自动失效。`,
      confirmColor: '#1b6ef3',
      success: (res) => {
        if (!res.confirm) return
        this.setData({ accepting: true })
        util.loading('正在生成订单')
        api
          .acceptQuote({ quoteId: quote.id, idempotencyKey: `accept-${quote.task.id}-${quote.id}` })
          .then((result) => {
            util.hideLoading()
            this.setData({ accepting: false })
            util.toast(result.duplicated ? '该任务已成交' : '成交成功', 'success')
            setTimeout(() => {
              wx.redirectTo({ url: `/pages/order/order-detail?id=${result.orderId}` })
            }, 600)
          })
          .catch((err) => {
            util.hideLoading()
            this.setData({ accepting: false })
            util.toast(err.message)
          })
      },
    })
  },

  goOrder() {
    wx.navigateTo({ url: `/pages/order/order-detail?id=${this.data.quote.orderId}` })
  },

  goTask() {
    wx.navigateTo({ url: `/pages/hall/task-detail?id=${this.data.quote.task.id}` })
  },

  onChatTap() {
    const { quote } = this.data
    if (!quote || !quote.canChat) return
    wx.navigateTo({
      url: `/pages/message/chat?userId=${quote.chatUserId}&bizType=quote&bizId=${quote.id}`,
    })
  },
})
