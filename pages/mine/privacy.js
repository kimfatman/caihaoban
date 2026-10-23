const util = require('../../utils/util')

Page({
  data: {
    settings: {
      inApp: true,
      subscribe: false,
      profileVisible: true,
      marketing: false,
    },
  },

  onToggle(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ [`settings.${key}`]: e.detail.value })
    if (key === 'subscribe' && e.detail.value) {
      util.toast('订阅消息需经微信平台审核并按实际配置下发')
    }
  },

  onDeleteAccount() {
    wx.showModal({
      title: '注销账号',
      content: '注销后将无法查看历史任务、订单与社区内容。存在进行中订单时需先完成或取消订单。',
      confirmColor: '#e54545',
      success: (res) => {
        if (res.confirm) util.toast('示例环境未实际提交注销申请')
      },
    })
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后需重新登录才能查看任务与订单信息。',
      confirmColor: '#e54545',
      success: (res) => {
        if (res.confirm) util.toast('示例环境已模拟退出登录')
      },
    })
  },

  showStatement() {
    wx.showModal({
      title: '隐私说明',
      content:
        '我们仅收集完成协作交易所必要的信息：账号与实名信息、机构资料、任务与订单记录、社区内容。证件与证件号码按最小必要原则存储，运营后台访问需授权并留存审计日志。除法律法规要求外，不会向交易双方以外的第三方提供你的资料。',
      showCancel: false,
      confirmText: '我知道了',
      confirmColor: '#1b6ef3',
    })
  },
})
