const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    orderId: '',
    order: null,
    type: 'pay',
    amount: '',
    remark: '',
    files: [],
    submitting: false,
  },

  onLoad(options) {
    this.setData({ orderId: options.orderId })
    api
      .getOrderDetail(options.orderId)
      .then((order) => {
        this.setData({
          order,
          type: order.side === 'supply' ? 'receive' : 'pay',
        })
      })
      .catch((err) => util.toast(err.message))
  },

  switchType(e) {
    this.setData({ type: e.currentTarget.dataset.type })
  },

  onAmountInput(e) {
    this.setData({ amount: e.detail.value })
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value })
  },

  chooseFiles() {
    util.chooseMedia(3).then((paths) => {
      if (!paths.length) return
      this.setData({ files: this.data.files.concat(paths.map((path) => ({ name: '凭证图片.jpg', path }))) })
    })
  },

  removeFile(e) {
    const files = this.data.files.slice()
    files.splice(Number(e.currentTarget.dataset.index), 1)
    this.setData({ files })
  },

  onSubmit() {
    const { type, amount, remark, files, orderId, submitting } = this.data
    if (submitting) return
    if (!Number(amount) || Number(amount) <= 0) {
      util.toast('请填写申报金额')
      return
    }
    if (!remark.trim()) {
      util.toast('请填写申报说明')
      return
    }
    this.setData({ submitting: true })
    api
      .declarePayment(orderId, {
        type,
        amount: Number(amount),
        remark: remark.trim(),
        files: files.map((item) => ({ name: item.name })),
      })
      .then(() => {
        this.setData({ submitting: false })
        util.toast('申报已提交，等待对方确认', 'success')
        setTimeout(() => wx.navigateBack(), 700)
      })
      .catch((err) => {
        this.setData({ submitting: false })
        util.toast(err.message)
      })
  },
})
