const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    profile: null,
    realName: '',
    idNumber: '',
    submitting: false,
  },

  onLoad() {
    this.loadProfile()
  },

  loadProfile() {
    api
      .getProfile()
      .then((profile) => this.setData({ profile, realName: profile.realName || '' }))
      .catch((err) => util.toast(err.message))
  },

  onInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value })
  },

  onSubmit() {
    const { realName, idNumber, submitting } = this.data
    if (submitting) return
    if (!realName.trim()) {
      util.toast('请填写真实姓名')
      return
    }
    if (!/^\d{17}[\dXx]$/.test(idNumber)) {
      util.toast('请填写正确的身份证号')
      return
    }
    this.setData({ submitting: true })
    api
      .submitVerify({ realName: realName.trim(), idNumber })
      .then(() => {
        this.setData({ submitting: false })
        util.toast('实名认证已提交', 'success')
        this.loadProfile()
      })
      .catch((err) => {
        this.setData({ submitting: false })
        util.toast(err.message)
      })
  },
})
