const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    orderId: '',
    type: 'progress',
    order: null,
    content: '',
    files: [],
    submitting: false,
  },

  onLoad(options) {
    this.setData({
      orderId: options.orderId,
      type: options.type === 'evidence' ? 'evidence' : 'progress',
    })
    this.loadOrder()
  },

  loadOrder() {
    api
      .getOrderDetail(this.data.orderId)
      .then((order) => this.setData({ order }))
      .catch((err) => util.toast(err.message))
  },

  switchType(e) {
    this.setData({ type: e.currentTarget.dataset.type })
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value })
  },

  chooseFiles() {
    util.chooseMedia(6).then((paths) => {
      if (!paths.length) return
      this.setData({
        files: this.data.files.concat(paths.map((path) => ({ name: '凭证图片.jpg', path }))),
      })
    })
  },

  removeFile(e) {
    const files = this.data.files.slice()
    files.splice(Number(e.currentTarget.dataset.index), 1)
    this.setData({ files })
  },

  onSubmit() {
    const { type, content, files, orderId, submitting } = this.data
    if (submitting) return
    if (!content.trim()) {
      util.toast(type === 'progress' ? '请填写进度说明' : '请填写凭证说明')
      return
    }
    if (type === 'evidence' && files.length === 0) {
      util.toast('请至少上传 1 个履约凭证')
      return
    }
    this.setData({ submitting: true })
    const payload = { content: content.trim(), files: files.map((item) => ({ name: item.name })) }
    const action =
      type === 'progress'
        ? api.updateProgress(orderId, payload)
        : api.submitEvidence(orderId, { ...payload, type: '交付成果' })
    action
      .then(() => {
        this.setData({ submitting: false })
        util.toast(type === 'progress' ? '进度已更新' : '凭证已提交，等待验收', 'success')
        setTimeout(() => wx.navigateBack(), 600)
      })
      .catch((err) => {
        this.setData({ submitting: false })
        util.toast(err.message)
      })
  },
})
