const api = require('../../utils/api')
const dict = require('../../utils/dict')
const util = require('../../utils/util')

Page({
  data: {
    targetType: 'topic',
    targetId: '',
    targetTitle: '',
    reasons: dict.reportReasons,
    reason: '',
    detail: '',
    submitting: false,
  },

  onLoad(options) {
    this.setData({
      targetType: options.targetType || 'topic',
      targetId: options.targetId || '',
      targetTitle: options.title ? decodeURIComponent(options.title) : '',
    })
  },

  onReasonTap(e) {
    this.setData({ reason: e.currentTarget.dataset.value })
  },

  onDetailInput(e) {
    this.setData({ detail: e.detail.value })
  },

  onSubmit() {
    const { reason, detail, targetType, targetId, targetTitle, submitting } = this.data
    if (submitting) return
    if (!reason) {
      util.toast('请选择举报原因')
      return
    }
    this.setData({ submitting: true })
    api
      .reportContent({ reason, detail, targetType, targetId, targetTitle })
      .then(() => {
        this.setData({ submitting: false })
        util.toast('举报已提交，平台将进行人工审核', 'success')
        setTimeout(() => wx.navigateBack(), 800)
      })
      .catch((err) => {
        this.setData({ submitting: false })
        util.toast(err.message)
      })
  },
})
