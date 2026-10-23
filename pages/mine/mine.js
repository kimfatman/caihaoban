const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    profile: null,
    memberships: [],
    currentOrg: null,
    unread: 0,
    chatUnread: 0,
    roleLabel: '',
    serviceProfile: null,
    serviceProfileHint: '待完善',
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    Promise.all([api.getProfile(), api.getSession(), api.getChatList(), api.getServiceProfile()])
      .then(([profile, session, chat, serviceProfile]) => {
        const currentOrg = session.currentOrg
        this.setData({
          profile,
          memberships: session.memberships,
          currentOrg,
          unread: session.unread,
          chatUnread: chat.unread,
          serviceProfile,
          serviceProfileHint: serviceProfile.hasProfile
            ? `${serviceProfile.completenessPercent}% 已完善`
            : '待完善',
          roleLabel: currentOrg
            ? currentOrg.role === 'owner'
              ? '负责人'
              : currentOrg.role === 'admin'
              ? '管理员'
              : '成员'
            : '',
        })
        if (session.unread > 0) {
          wx.setTabBarBadge({ index: 2, text: String(session.unread > 99 ? '99+' : session.unread) })
        } else {
          wx.removeTabBarBadge({ index: 2 })
        }
      })
      .catch((err) => util.toast(err.message))
  },

  switchOrg() {
    const { memberships } = this.data
    if (memberships.length <= 1) return
    wx.showActionSheet({
      itemList: memberships.map((item) => item.orgName),
      success: (res) => {
        const target = memberships[res.tapIndex]
        api
          .switchOrg(target.orgId)
          .then(() => {
            util.toast(`已切换至 ${target.orgName}`, 'success')
            this.loadData()
          })
          .catch((err) => util.toast(err.message))
      },
    })
  },

  go(e) {
    const url = e.currentTarget.dataset.url
    if (url) wx.navigateTo({ url })
  },

  goMessage() {
    wx.switchTab({ url: '/pages/message/message' })
  },

  goChat() {
    getApp().globalData.messageTab = 'chat'
    wx.switchTab({ url: '/pages/message/message' })
  },

  goOrders(e) {
    const role = e.currentTarget.dataset.role || 'all'
    wx.navigateTo({ url: `/pages/order/order-list?role=${role}` })
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后需重新登录才能查看任务与订单信息。',
      confirmColor: '#e54545',
      success: (res) => {
        if (res.confirm) util.toast('示例环境已模拟退出登录')
      },
    })
  },
})
