const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    orderId: '',
    order: null,
    afterAmount: '',
    reason: '',
    submitting: false,
  },

  onLoad(options) {
    this.setData({ orderId: options.orderId })
    this.loadOrder()
  },

  loadOrder() {
    api
      .getOrderDetail(this.data.orderId)
      .then((order) => this.setData({ order }))
      .catch((err) => util.toast(err.message))
  },

  onAmountInput(e) {
    this.setData({ afterAmount: e.detail.value })
  },

  onReasonInput(e) {
    this.setData({ reason: e.detail.value })
  },

  onSubmit() {
    const { afterAmount, reason, orderId, submitting } = this.data
    if (submitting) return
    const amount = Number(afterAmount)
    if (!amount || amount <= 0) {
      util.toast('请填写变更后总额')
      return
    }
    if (reason.trim().length < 5) {
      util.toast('请填写变更原因（至少 5 个字）')
      return
    }
    this.setData({ submitting: true })
    api
      .createFeeChange(orderId, { after: amount, reason: reason.trim() })
      .then(() => {
        this.setData({ submitting: false })
        util.toast('变更申请已提交，等待对方确认', 'success')
        setTimeout(() => wx.navigateBack(), 700)
      })
      .catch((err) => {
        this.setData({ submitting: false })
        util.toast(err.message)
      })
  },
})
