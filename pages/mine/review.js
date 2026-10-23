const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    tab: 'pending',
    pending: [],
    done: [],
    stars: [1, 2, 3, 4, 5],
    loading: true,
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    api
      .getMyReviews()
      .then((res) => this.setData({ pending: res.pending, done: res.done, loading: false }))
      .catch((err) => {
        this.setData({ loading: false })
        util.toast(err.message)
      })
  },

  onTabTap(e) {
    this.setData({ tab: e.currentTarget.dataset.value })
  },

  goReview(e) {
    wx.navigateTo({ url: `/pages/order/order-detail?id=${e.currentTarget.dataset.id}` })
  },

  goOrders() {
    wx.navigateTo({ url: '/pages/order/order-list?role=demand' })
  },
})
