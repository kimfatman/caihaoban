const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    topicId: '',
    topic: null,
    commentText: '',
    commentPlaceholder: '友善交流，请勿发布客户敏感信息',
    replyTarget: null,
    focusInput: false,
    submitting: false,
  },

  onLoad(options) {
    this.setData({ topicId: options.id })
  },

  onShow() {
    this.loadDetail()
  },

  loadDetail() {
    return api
      .getTopicDetail(this.data.topicId)
      .then((topic) => this.setData({ topic }))
      .catch((err) => util.toast(err.message))
  },

  onLike() {
    api
      .toggleTopicLike(this.data.topicId)
      .then((res) => {
        this.setData({ 'topic.liked': res.liked, 'topic.likeCount': res.likeCount })
      })
      .catch((err) => util.toast(err.message))
  },

  onFavorite() {
    api
      .toggleTopicFavorite(this.data.topicId)
      .then((res) => {
        this.setData({ 'topic.favorited': res.favorited })
        util.toast(res.favorited ? '已收藏' : '已取消收藏')
      })
      .catch((err) => util.toast(err.message))
  },

  focusComment() {
    this.setData({ focusInput: true })
    setTimeout(() => this.setData({ focusInput: false }), 300)
  },

  onCommentInput(e) {
    this.setData({ commentText: e.detail.value })
  },

  replyComment(e) {
    const { id, name } = e.currentTarget.dataset
    this.setData({
      replyTarget: { commentId: id, replyTo: name },
      commentPlaceholder: `回复 ${name}`,
      focusInput: true,
    })
    setTimeout(() => this.setData({ focusInput: false }), 300)
  },

  cancelReply() {
    this.setData({ replyTarget: null, commentPlaceholder: '友善交流，请勿发布客户敏感信息' })
  },

  submitComment() {
    const { commentText, replyTarget, topicId, submitting } = this.data
    if (submitting) return
    if (!commentText.trim()) {
      util.toast('请输入评论内容')
      return
    }
    this.setData({ submitting: true })
    api
      .addComment(topicId, {
        content: commentText.trim(),
        parentId: replyTarget ? replyTarget.commentId : null,
        replyTo: replyTarget ? replyTarget.replyTo : '',
      })
      .then((topic) => {
        this.setData({
          submitting: false,
          topic,
          commentText: '',
          replyTarget: null,
          commentPlaceholder: '友善交流，请勿发布客户敏感信息',
        })
        util.toast('评论已发布', 'success')
      })
      .catch((err) => {
        this.setData({ submitting: false })
        util.toast(err.message)
      })
  },

  likeComment(e) {
    const { id, reply } = e.currentTarget.dataset
    api
      .toggleCommentLike(this.data.topicId, id, reply || '')
      .then(() => this.loadDetail())
      .catch((err) => util.toast(err.message))
  },

  goReport() {
    const { topic } = this.data
    wx.navigateTo({
      url: `/pages/community/report?targetType=topic&targetId=${topic.id}&title=${encodeURIComponent(topic.title)}`,
    })
  },

  previewAttachment(e) {
    const file = e.currentTarget.dataset.file
    util.toast(`${file.name}：示例环境暂不支持在线预览`)
  },
})
