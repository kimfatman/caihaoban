const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    orderId: '',
    order: null,
    loading: true,
    submitting: false,
    showAccept: false,
    acceptResult: 'accept',
    acceptRemark: '',
    showCancel: false,
    cancelReason: '',
    showReview: false,
    rating: 5,
    stars: [1, 2, 3, 4, 5],
    reviewTags: [],
    tagOptions: ['响应及时', '专业规范', '交付完整', '沟通顺畅', '进度透明'].map((label) => ({
      label,
      selected: false,
    })),
    reviewContent: '',
  },

  onLoad(options) {
    this.setData({ orderId: options.id })
  },

  onShow() {
    this.loadDetail()
  },

  loadDetail() {
    api
      .getOrderDetail(this.data.orderId)
      .then((order) => this.setData({ order, loading: false }))
      .catch((err) => {
        this.setData({ loading: false })
        util.toast(err.message)
      })
  },

  noop() {},

  goRecord(e) {
    const type = e.currentTarget.dataset.type || 'progress'
    wx.navigateTo({ url: `/pages/order/record?orderId=${this.data.orderId}&type=${type}` })
  },

  goFeeRecords() {
    wx.navigateTo({ url: `/pages/order/fee-records?orderId=${this.data.orderId}` })
  },

  goFeeChange() {
    wx.navigateTo({ url: `/pages/order/fee-change?orderId=${this.data.orderId}` })
  },

  goPayment() {
    wx.navigateTo({ url: `/pages/order/payment-declare?orderId=${this.data.orderId}` })
  },

  goDispute() {
    wx.navigateTo({ url: `/pages/order/dispute?orderId=${this.data.orderId}` })
  },

  goTask() {
    wx.navigateTo({ url: `/pages/hall/task-detail?id=${this.data.order.taskId}` })
  },

  callCounterpart() {
    const { order } = this.data
    if (!order || !order.counterpart) return
    wx.makePhoneCall({ phoneNumber: order.counterpart.phone, fail: () => {} })
  },

  chatCounterpart() {
    const { order } = this.data
    if (!order || !order.counterpart) return
    wx.navigateTo({
      url: `/pages/message/chat?userId=${order.counterpart.userId}&bizType=order&bizId=${order.id}`,
    })
  },

  copyNo() {
    wx.setClipboardData({ data: this.data.order.no })
  },

  openAccept() {
    this.setData({ showAccept: true, acceptResult: 'accept', acceptRemark: '' })
  },

  openReject() {
    this.setData({ showAccept: true, acceptResult: 'reject', acceptRemark: '' })
  },

  closeAccept() {
    this.setData({ showAccept: false })
  },

  onAcceptRemark(e) {
    this.setData({ acceptRemark: e.detail.value })
  },

  submitAccept() {
    const { acceptResult, acceptRemark, orderId, submitting } = this.data
    if (submitting) return
    if (acceptResult === 'reject' && !acceptRemark.trim()) {
      util.toast('请填写退回补充说明')
      return
    }
    this.setData({ submitting: true })
    api
      .acceptDelivery(orderId, { result: acceptResult, remark: acceptRemark })
      .then(() => {
        this.setData({ submitting: false, showAccept: false })
        util.toast(acceptResult === 'accept' ? '验收通过' : '已退回补充', 'success')
        this.loadDetail()
      })
      .catch((err) => {
        this.setData({ submitting: false })
        util.toast(err.message)
      })
  },

  openCancel() {
    this.setData({ showCancel: true, cancelReason: '' })
  },

  closeCancel() {
    this.setData({ showCancel: false })
  },

  onCancelReason(e) {
    this.setData({ cancelReason: e.detail.value })
  },

  submitCancel() {
    const { cancelReason, orderId, submitting } = this.data
    if (submitting) return
    if (cancelReason.trim().length < 5) {
      util.toast('请填写取消原因（至少 5 个字）')
      return
    }
    this.setData({ submitting: true })
    api
      .requestCancelOrder(orderId, cancelReason)
      .then(() => {
        this.setData({ submitting: false, showCancel: false })
        util.toast('取消申请已提交，等待对方确认', 'success')
        this.loadDetail()
      })
      .catch((err) => {
        this.setData({ submitting: false })
        util.toast(err.message)
      })
  },

  respondCancel(e) {
    const agree = e.currentTarget.dataset.agree === '1'
    wx.showModal({
      title: agree ? '同意取消订单' : '拒绝取消订单',
      content: agree ? '取消后订单关闭，任务同步关闭且不会自动重新开放。' : '拒绝后订单继续履约，双方可协商或申请争议处理。',
      confirmColor: agree ? '#e54545' : '#1b6ef3',
      success: (res) => {
        if (!res.confirm) return
        api
          .respondCancelOrder(this.data.orderId, agree)
          .then(() => {
            util.toast(agree ? '订单已取消' : '已拒绝取消申请', 'success')
            this.loadDetail()
          })
          .catch((err) => util.toast(err.message))
      },
    })
  },

  confirmFee(e) {
    const changeId = e.currentTarget.dataset.id
    const agree = e.currentTarget.dataset.agree === '1'
    api
      .confirmFeeChange(this.data.orderId, changeId, agree)
      .then(() => {
        util.toast(agree ? '已确认费用变更' : '已拒绝费用变更', 'success')
        this.loadDetail()
      })
      .catch((err) => util.toast(err.message))
  },

  confirmPayment(e) {
    const paymentId = e.currentTarget.dataset.id
    const agree = e.currentTarget.dataset.agree === '1'
    api
      .confirmPayment(this.data.orderId, paymentId, agree)
      .then(() => {
        util.toast(agree ? '已确认' : '已否认该申报', 'success')
        this.loadDetail()
      })
      .catch((err) => util.toast(err.message))
  },

  openReview() {
    this.setData({
      showReview: true,
      rating: 5,
      reviewTags: [],
      reviewContent: '',
      tagOptions: this.data.tagOptions.map((item) => ({ ...item, selected: false })),
    })
  },

  closeReview() {
    this.setData({ showReview: false })
  },

  setRating(e) {
    this.setData({ rating: Number(e.currentTarget.dataset.value) })
  },

  toggleTag(e) {
    const tag = e.currentTarget.dataset.tag
    const tags = this.data.reviewTags.slice()
    const options = this.data.tagOptions.map((item) => {
      if (item.label !== tag) return item
      return { ...item, selected: !item.selected }
    })
    const index = tags.indexOf(tag)
    if (index >= 0) tags.splice(index, 1)
    else tags.push(tag)
    this.setData({ reviewTags: tags, tagOptions: options })
  },

  onReviewInput(e) {
    this.setData({ reviewContent: e.detail.value })
  },

  submitReview() {
    const { rating, reviewTags, reviewContent, orderId, submitting } = this.data
    if (submitting) return
    this.setData({ submitting: true })
    api
      .reviewOrder(orderId, { rating, tags: reviewTags, content: reviewContent })
      .then(() => {
        this.setData({ submitting: false, showReview: false })
        util.toast('评价已提交', 'success')
        this.loadDetail()
      })
      .catch((err) => {
        this.setData({ submitting: false })
        util.toast(err.message)
      })
  },
})
