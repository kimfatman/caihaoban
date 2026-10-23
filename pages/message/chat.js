const api = require('../../utils/api')
const util = require('../../utils/util')

const QUICK_REPLIES = [
  '你好，方便电话沟通一下细节吗？',
  '这个需求我们有同类项目经验，可以先聊聊。',
  '麻烦补充一下具体的材料清单。',
  '好的，我这边确认后回复你。',
]

const BIZ_ROUTES = {
  task: (id) => `/pages/hall/task-detail?id=${id}`,
  quote: (id) => `/pages/hall/quote-detail?id=${id}`,
  order: (id) => `/pages/order/order-detail?id=${id}`,
}

Page({
  data: {
    conversationId: '',
    pendingUserId: '',
    pendingBizType: 'none',
    pendingBizId: '',
    chat: null,
    messages: [],
    input: '',
    quickReplies: QUICK_REPLIES,
    scrollInto: '',
    loading: true,
    sending: false,
  },

  /** 只接收 id 或 userId + bizType/bizId，会话标题由接口侧按业务对象生成 */
  onLoad(options) {
    const query = options || {}
    this.setData({
      conversationId: query.id || '',
      pendingUserId: query.userId || '',
      pendingBizType: query.bizType || 'none',
      pendingBizId: query.bizId || '',
    })
  },

  onShow() {
    const { conversationId, pendingUserId } = this.data
    if (conversationId) {
      this.loadDetail()
    } else if (pendingUserId) {
      this.resolveChat()
    } else {
      this.setData({ loading: false })
      util.toast('会话不存在')
    }
  },

  /** 通过联系人 + 业务对象打开（或创建）会话 */
  resolveChat() {
    const { pendingUserId, pendingBizType, pendingBizId } = this.data
    this.setData({ loading: true })
    api
      .startChat({
        userId: pendingUserId,
        bizType: pendingBizType,
        bizId: pendingBizId,
      })
      .then((res) => {
        this.setData({ conversationId: res.id })
        return this.loadDetail()
      })
      .catch((err) => {
        this.setData({ loading: false })
        util.toast(err.message)
      })
  },

  loadDetail() {
    return api
      .getChatDetail(this.data.conversationId)
      .then((chat) => {
        this.setData({ chat, messages: chat.messages || [], loading: false })
        wx.setNavigationBarTitle({ title: chat.peerName || '私聊' })
        this.scrollToBottom()
      })
      .catch((err) => {
        this.setData({ loading: false })
        util.toast(err.message)
      })
  },

  scrollToBottom() {
    this.setData({ scrollInto: '' })
    setTimeout(() => this.setData({ scrollInto: 'anchor' }), 80)
  },

  onInput(e) {
    this.setData({ input: e.detail.value })
  },

  onQuickTap(e) {
    this.setData({ input: e.currentTarget.dataset.text })
  },

  onSend() {
    const content = this.data.input.trim()
    if (!content || this.data.sending) return
    this.send({ type: 'text', content })
  },

  onChooseImage() {
    if (this.data.sending) return
    util.chooseMedia(1).then((files) => {
      if (!files.length) return
      this.send({ type: 'image', content: files[0] })
    })
  },

  send(payload) {
    this.setData({ sending: true })
    return api
      .sendChatMessage(this.data.conversationId, payload)
      .then(() => {
        this.setData({ input: '', sending: false })
        return this.loadDetail()
      })
      .catch((err) => {
        this.setData({ sending: false })
        util.toast(err.message)
      })
  },

  previewImage(e) {
    wx.previewImage({ urls: [e.currentTarget.dataset.src] })
  },

  goBiz() {
    const { chat } = this.data
    if (!chat || !chat.bizId) return
    const build = BIZ_ROUTES[chat.bizType]
    if (build) wx.navigateTo({ url: build(chat.bizId) })
  },
})
