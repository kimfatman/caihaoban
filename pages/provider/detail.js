const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    userId: '',
    taskId: '',
    provider: null,
    loading: true,
    inviting: false,
  },

  onLoad(options) {
    this.setData({ userId: options.userId || '', taskId: options.taskId || '' })
  },

  onShow() {
    if (this.data.userId) this.load()
  },

  load() {
    this.setData({ loading: true })
    api
      .getProviderProfile(this.data.userId)
      .then((provider) => {
        this.setData({ provider, loading: false })
        wx.setNavigationBarTitle({ title: provider.nickname || '服务者主页' })
      })
      .catch((err) => {
        this.setData({ loading: false })
        util.toast(err.message)
      })
  },

  onChat() {
    const { provider, taskId } = this.data
    if (!provider || provider.isSelf) return
    wx.navigateTo({
      url: `/pages/message/chat?userId=${provider.userId}${taskId ? `&bizType=task&bizId=${taskId}` : ''}`,
    })
  },

  onInvite() {
    const { provider, taskId, inviting } = this.data
    if (!provider || inviting) return
    if (!taskId) {
      util.toast('请从任务详情页发起邀请')
      return
    }
    this.setData({ inviting: true })
    api
      .inviteProvider(taskId, provider.userId)
      .then((res) => {
        this.setData({ inviting: false })
        util.toast(res.invited ? '已发送协作邀请' : '此前已邀请过该服务者', 'success')
      })
      .catch((err) => {
        this.setData({ inviting: false })
        util.toast(err.message)
      })
  },
})
