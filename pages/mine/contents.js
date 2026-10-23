const api = require('../../utils/api')
const util = require('../../utils/util')

const tabs = [
  { value: 'topic', label: '我的话题' },
  { value: 'comment', label: '我的评论' },
  { value: 'favorite', label: '我的收藏' },
]

Page({
  data: {
    tabs,
    tab: 'topic',
    list: [],
    loading: true,
  },

  onShow() {
    this.loadList()
  },

  loadList() {
    this.setData({ loading: true })
    api
      .getMyContents(this.data.tab)
      .then((list) => this.setData({ list, loading: false }))
      .catch((err) => {
        this.setData({ loading: false })
        util.toast(err.message)
      })
  },

  onTabTap(e) {
    this.setData({ tab: e.currentTarget.dataset.value })
    this.loadList()
  },

  onTopicTap(e) {
    wx.navigateTo({ url: `/pages/community/topic-detail?id=${e.detail.id}` })
  },

  onCommentTap(e) {
    wx.navigateTo({ url: `/pages/community/topic-detail?id=${e.currentTarget.dataset.topic}` })
  },

  goCommunity() {
    wx.switchTab({ url: '/pages/community/community' })
  },
})
