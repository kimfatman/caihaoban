const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    profile: null,
    nickname: '',
    title: '',
    phone: '',
    saving: false,
    uploading: false,
  },

  onLoad() {
    this.loadProfile()
  },

  loadProfile() {
    return api
      .getProfile()
      .then((profile) => {
        this.setData({
          profile,
          nickname: profile.nickname,
          title: profile.title || '',
          phone: profile.phone,
        })
      })
      .catch((err) => util.toast(err.message))
  },

  onInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value })
  },

  /** 微信头像填写能力：授权后返回头像临时文件路径 */
  onWechatAvatar(e) {
    const avatarUrl = (e.detail && e.detail.avatarUrl) || ''
    if (!avatarUrl) {
      util.toast('未获取到微信头像，请重试')
      return
    }
    this.saveAvatar({ source: 'wechat', avatar: avatarUrl }, '已使用微信头像')
  },

  onPickAvatar() {
    if (this.data.uploading) return
    util.chooseMedia(1).then((files) => {
      if (!files.length) return
      this.saveAvatar({ source: 'album', avatar: files[0] }, '头像已更新')
    })
  },

  saveAvatar(payload, okText) {
    if (this.data.uploading) return
    this.setData({ uploading: true })
    util.loading('保存中')
    return api
      .updateAvatar(payload)
      .then((profile) => {
        util.hideLoading()
        this.setData({ profile, uploading: false })
        util.toast(okText, 'success')
      })
      .catch((err) => {
        util.hideLoading()
        this.setData({ uploading: false })
        util.toast(err.message)
      })
  },

  onResetAvatar() {
    util.confirm('恢复为默认头像？').then((ok) => {
      if (!ok) return
      api
        .resetAvatar()
        .then((profile) => {
          this.setData({ profile })
          util.toast('已恢复默认头像', 'success')
        })
        .catch((err) => util.toast(err.message))
    })
  },

  onSave() {
    const { nickname, title, phone, saving } = this.data
    if (saving) return
    this.setData({ saving: true })
    api
      .updateProfile({ nickname, title, phone })
      .then(() => {
        this.setData({ saving: false })
        util.toast('资料已保存', 'success')
        setTimeout(() => wx.navigateBack(), 600)
      })
      .catch((err) => {
        this.setData({ saving: false })
        util.toast(err.message)
      })
  },
})
