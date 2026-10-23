const api = require('../../utils/api')
const util = require('../../utils/util')

const types = ['功能建议', '使用问题', '订单与费用', '社区内容', '其他']

Page({
  data: {
    types,
    type: '功能建议',
    content: '',
    contact: '',
    submitting: false,
  },

  onTypeTap(e) {
    this.setData({ type: e.currentTarget.dataset.value })
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value })
  },

  onContactInput(e) {
    this.setData({ contact: e.detail.value })
  },

  onSubmit() {
    const { type, content, contact, submitting } = this.data
    if (submitting) return
    if (content.trim().length < 5) {
      util.toast('请描述你遇到的问题（至少 5 个字）')
      return
    }
    this.setData({ submitting: true })
    api
      .submitFeedback({ type, content: content.trim(), contact: contact.trim() })
      .then(() => {
        this.setData({ submitting: false, content: '', contact: '' })
        util.toast('反馈已提交，感谢你的建议', 'success')
      })
      .catch((err) => {
        this.setData({ submitting: false })
        util.toast(err.message)
      })
  },
})
