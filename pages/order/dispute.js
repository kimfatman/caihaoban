const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    orderId: '',
    order: null,
    reason: '',
    files: [],
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

  onReasonInput(e) {
    this.setData({ reason: e.detail.value })
  },

  chooseFiles() {
    util.chooseMedia(6).then((paths) => {
      if (!paths.length) return
      this.setData({ files: this.data.files.concat(paths.map((path) => ({ name: '争议材料.jpg', path }))) })
    })
  },

  removeFile(e) {
    const files = this.data.files.slice()
    files.splice(Number(e.currentTarget.dataset.index), 1)
    this.setData({ files })
  },

  onSubmit() {
    const { reason, files, orderId, submitting } = this.data
    if (submitting) return
    if (reason.trim().length < 10) {
      util.toast('请详细描述争议情况（至少 10 个字）')
      return
    }
    this.setData({ submitting: true })
    api
      .applyDispute(orderId, { reason: reason.trim(), files: files.map((item) => ({ name: item.name })) })
      .then(() => {
        this.setData({ submitting: false })
        util.toast('争议申请已提交，平台将介入处理', 'success')
        setTimeout(() => wx.navigateBack(), 800)
      })
      .catch((err) => {
        this.setData({ submitting: false })
        util.toast(err.message)
      })
  },
})
