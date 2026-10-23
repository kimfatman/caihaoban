const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    list: [],
    loading: true,
  },

  onShow() {
    api
      .getOrgList()
      .then((list) => this.setData({ list, loading: false }))
      .catch((err) => {
        this.setData({ loading: false })
        util.toast(err.message)
      })
  },

  onOrgTap(e) {
    wx.navigateTo({ url: `/pages/mine/org-detail?id=${e.currentTarget.dataset.id}` })
  },
})
