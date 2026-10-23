const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    list: [],
    loading: true,
  },

  onShow() {
    this.loadList()
  },

  loadList() {
    api
      .getMyQuotes()
      .then((list) => this.setData({ list, loading: false }))
      .catch((err) => {
        this.setData({ loading: false })
        util.toast(err.message)
      })
  },

  onQuoteTap(e) {
    wx.navigateTo({ url: `/pages/hall/quote-detail?id=${e.currentTarget.dataset.id}` })
  },

  onTaskTap(e) {
    wx.navigateTo({ url: `/pages/hall/task-detail?id=${e.currentTarget.dataset.task}` })
  },

  goHall() {
    wx.switchTab({ url: '/pages/hall/hall' })
  },
})
