const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    id: '',
    notice: null,
    loading: true,
    error: '',
    contactShown: false,
    packages: [],
    demoTip: '演示流程，暂未开通真实支付',
    buying: false,
  },

  onLoad(options) {
    this.setData({ id: options.id || '' })
  },

  onShow() {
    if (this.data.id) this.load()
  },

  load() {
    this.setData({ loading: true, error: '' })
    return api
      .getNoticeDetail(this.data.id)
      .then((notice) => {
        this.setData({ notice, loading: false })
        if (notice.isOwner) this.loadPackages()
      })
      .catch((err) => {
        this.setData({ loading: false, error: err.message || '公告加载失败' })
        util.toast(err.message)
      })
  },

  loadPackages() {
    api
      .getNoticePackages()
      .then((res) =>
        this.setData({
          packages: res.list.filter((item) => item.paid),
          demoTip: res.tip,
        })
      )
      .catch(() => {})
  },

  onToggleContact() {
    this.setData({ contactShown: !this.data.contactShown })
  },

  /** 复用现有私聊：真实创建会话后才跳转，失败直接提示，不伪造成功 */
  onContact() {
    const { notice } = this.data
    if (!notice) return
    api
      .contactNoticePublisher(notice.id)
      .then((res) => wx.navigateTo({ url: `/pages/message/chat?userId=${res.peerId}` }))
      .catch((err) => util.toast(err.message))
  },

  onBuy(e) {
    const plan = e.currentTarget.dataset.plan
    const pkg = this.data.packages.find((item) => item.value === plan)
    if (!pkg || this.data.buying) return
    wx.showModal({
      title: pkg.label,
      content: `${pkg.priceText} / ${pkg.daysText}\n\n演示流程，暂未开通真实支付。确认后仅生成一条演示订单，不会产生任何真实扣款，也不会跳过内容审核。`,
      confirmText: '生成演示订单',
      confirmColor: '#1b6ef3',
      success: (res) => {
        if (!res.confirm) return
        this.setData({ buying: true })
        api
          .createNoticeOrder({ noticeId: this.data.notice.id, plan })
          .then((result) => {
            this.setData({ buying: false })
            util.toast(result.message, 'success')
            this.load()
          })
          .catch((err) => {
            this.setData({ buying: false })
            util.toast(err.message)
          })
      },
    })
  },
})
