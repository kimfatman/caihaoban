const api = require('../../utils/api')
const dict = require('../../utils/dict')
const util = require('../../utils/util')

Page({
  data: {
    tab: 'notice',
    types: dict.messageTypes,
    type: 'all',
    list: [],
    unread: { all: 0, notice: 0, chat: 0 },
    chats: [],
    loading: true,
    /** 推荐入口副文案：由推荐摘要接口下发，失败时保留默认文案 */
    recommendHint: '按你的服务能力与地区匹配任务',
  },

  onShow() {
    const tab = (getApp().globalData.messageTab || 'notice') === 'chat' ? 'chat' : 'notice'
    getApp().globalData.messageTab = 'notice'
    this.setData({ tab })
    this.loadList()
    this.loadChats()
    this.loadRecommendHint()
  },

  onPullDownRefresh() {
    Promise.all([this.loadList(), this.loadChats(), this.loadRecommendHint()]).then(() =>
      wx.stopPullDownRefresh()
    )
  },

  /** 只取推荐摘要文案，任务列表仍由 /pages/hall/recommend 调 getRecommendedTasks 获取 */
  loadRecommendHint() {
    return api
      .getRecommendSummary()
      .then((res) => this.setData({ recommendHint: res.hint }))
      .catch(() => {})
  },

  goRecommend() {
    wx.navigateTo({ url: '/pages/hall/recommend' })
  },

  syncBadge(total) {
    if (total > 0) {
      wx.setTabBarBadge({ index: 2, text: String(total > 99 ? '99+' : total) })
    } else {
      wx.removeTabBarBadge({ index: 2 })
    }
  },

  loadList() {
    return api
      .getMessages(this.data.type)
      .then((res) => {
        const unread = { all: res.unread.notice + this.data.unread.chat, notice: res.unread.notice, chat: this.data.unread.chat }
        this.setData({ list: res.list, unread, loading: false })
        this.syncBadge(unread.all)
      })
      .catch((err) => {
        this.setData({ loading: false })
        util.toast(err.message)
      })
  },

  loadChats() {
    return api
      .getChatList()
      .then((res) => {
        const unread = { all: this.data.unread.notice + res.unread, notice: this.data.unread.notice, chat: res.unread }
        this.setData({ chats: res.list, unread })
        this.syncBadge(unread.all)
      })
      .catch((err) => util.toast(err.message))
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.value
    if (tab === this.data.tab) return
    this.setData({ tab })
  },

  onTypeTap(e) {
    this.setData({ type: e.currentTarget.dataset.value })
    this.loadList()
  },

  markAllRead() {
    if (!this.data.unread.notice) return
    api.readAllMessages(this.data.type).then(() => {
      util.toast('已全部标为已读', 'success')
      this.loadList()
    })
  },

  markAllChatRead() {
    if (!this.data.unread.chat) return
    api.readAllChats().then(() => {
      util.toast('私聊已全部标为已读', 'success')
      this.loadChats()
    })
  },

  onMessageTap(e) {
    const message = this.data.list[e.currentTarget.dataset.index]
    api.readMessage(message.id).then(() => this.loadList())
    const routes = {
      task: `/pages/hall/task-detail?id=${message.bizId}`,
      order: `/pages/order/order-detail?id=${message.bizId}`,
      topic: `/pages/community/topic-detail?id=${message.bizId}`,
      org: `/pages/mine/org-detail?id=${message.bizId}`,
      quote: `/pages/hall/quote-detail?id=${message.bizId}`,
      notice: `/pages/hall/notice-detail?id=${message.bizId}`,
    }
    const url = routes[message.bizType]
    if (url) wx.navigateTo({ url })
  },

  onChatTap(e) {
    wx.navigateTo({ url: `/pages/message/chat?id=${e.currentTarget.dataset.id}` })
  },
})
