const api = require('../../utils/api')
const dict = require('../../utils/dict')
const util = require('../../utils/util')

const categories = [{ value: '', label: '全部分类' }].concat(
  dict.topicCategories.map((item) => ({ value: item.value, label: item.label }))
)
const regions = ['全部地区'].concat(dict.regions.map((item) => item.name))

Page({
  data: {
    keyword: '',
    category: '',
    categories,
    regionIndex: 0,
    regions,
    region: '',
    sort: 'latest',
    list: [],
    loading: true,
    total: 0,
  },

  onShow() {
    this.loadList()
  },

  onPullDownRefresh() {
    this.loadList().then(() => wx.stopPullDownRefresh())
  },

  loadList() {
    this.setData({ loading: true })
    return api
      .getTopicList({
        keyword: this.data.keyword,
        category: this.data.category,
        region: this.data.region,
        sort: this.data.sort,
      })
      .then((list) => this.setData({ list, total: list.length, loading: false }))
      .catch((err) => {
        this.setData({ loading: false })
        util.toast(err.message)
      })
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  onSearch() {
    this.loadList()
  },

  onCategoryTap(e) {
    this.setData({ category: e.currentTarget.dataset.value })
    this.loadList()
  },

  onRegionChange(e) {
    const index = Number(e.detail.value)
    this.setData({ regionIndex: index, region: index === 0 ? '' : this.data.regions[index] })
    this.loadList()
  },

  onSortTap(e) {
    if (this.data.sort === e.currentTarget.dataset.value) return
    this.setData({ sort: e.currentTarget.dataset.value })
    this.loadList()
  },

  onTopicTap(e) {
    wx.navigateTo({ url: `/pages/community/topic-detail?id=${e.detail.id}` })
  },

  goPublish() {
    wx.navigateTo({ url: '/pages/community/topic-publish' })
  },
})
