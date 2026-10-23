const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    orderId: '',
    order: null,
    loading: true,
  },

  onLoad(options) {
    this.setData({ orderId: options.orderId })
  },

  onShow() {
    this.loadDetail()
  },

  loadDetail() {
    api
      .getOrderDetail(this.data.orderId)
      .then((order) => this.setData({ order, loading: false }))
      .catch((err) => {
        this.setData({ loading: false })
        util.toast(err.message)
      })
  },

  confirmFee(e) {
    const changeId = e.currentTarget.dataset.id
    const agree = e.currentTarget.dataset.agree === '1'
    api
      .confirmFeeChange(this.data.orderId, changeId, agree)
      .then(() => {
        util.toast(agree ? '已确认变更' : '已拒绝变更', 'success')
        this.loadDetail()
      })
      .catch((err) => util.toast(err.message))
  },

  confirmPayment(e) {
    const paymentId = e.currentTarget.dataset.id
    const agree = e.currentTarget.dataset.agree === '1'
    api
      .confirmPayment(this.data.orderId, paymentId, agree)
      .then(() => {
        util.toast(agree ? '已确认' : '已否认', 'success')
        this.loadDetail()
      })
      .catch((err) => util.toast(err.message))
  },

  goFeeChange() {
    wx.navigateTo({ url: `/pages/order/fee-change?orderId=${this.data.orderId}` })
  },

  goPayment() {
    wx.navigateTo({ url: `/pages/order/payment-declare?orderId=${this.data.orderId}` })
  },
})
