const api = require('../../utils/api')
const dict = require('../../utils/dict')
const util = require('../../utils/util')
const noticeApi = require('../../utils/notice')

const categories = dict.noticeCategories.map((item) => ({ value: item.value, label: item.label }))
const regions = ['不限地区'].concat(dict.regions.map((item) => item.name))

// 套餐文案全部由 dict.noticePackages 派生，页面不写死价格与天数
const freePkg = dict.noticePackages.find((item) => !item.price)
const paidPkgs = dict.noticePackages.filter((item) => item.price > 0)
const freeText = `${freePkg.label} 免费 · 展示 ${freePkg.days} 天`
const paidTip = paidPkgs.map((item) => `${item.label} ¥${item.price.toFixed(2)} / ${item.days} 天`).join('、')

Page({
  data: {
    title: '',
    content: '',
    category: categories[0].value,
    categories,
    regions,
    regionIndex: 0,
    regionLabel: '不限地区',
    contact: '',
    submitting: false,
    demoTip: '演示流程，暂未开通真实支付',
    freeText,
    paidTip,
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value })
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value })
  },

  onContactInput(e) {
    this.setData({ contact: e.detail.value })
  },

  onCategoryTap(e) {
    this.setData({ category: e.currentTarget.dataset.value })
  },

  onRegionChange(e) {
    const index = Number(e.detail.value)
    this.setData({ regionIndex: index, regionLabel: regions[index] })
  },

  buildPayload() {
    return {
      title: this.data.title.trim(),
      content: this.data.content.trim(),
      category: this.data.category,
      region: this.data.regionIndex === 0 ? '' : this.data.regionLabel,
      contact: this.data.contact.trim(),
    }
  },

  onSubmit() {
    if (this.data.submitting) return
    const payload = this.buildPayload()
    // 与服务端同一套校验规则，避免只在页面上做提示
    const error = noticeApi.validateNotice(payload)
    if (error) {
      util.toast(error)
      return
    }
    this.setData({ submitting: true })
    api
      .saveNotice(payload)
      .then((notice) => {
        this.setData({ submitting: false })
        util.toast('已提交审核', 'success')
        setTimeout(() => wx.redirectTo({ url: `/pages/hall/notice-detail?id=${notice.id}` }), 600)
      })
      .catch((err) => {
        this.setData({ submitting: false })
        util.toast(err.message)
      })
  },
})
