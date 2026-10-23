const api = require('../../utils/api')
const dict = require('../../utils/dict')
const util = require('../../utils/util')

const categories = [{ value: '', label: '全部' }].concat(
  dict.noticeCategories.map((item) => ({ value: item.value, label: item.label }))
)

const EMPTY_STATES = {
  search: {
    text: '没有找到相关公告',
    tip: '换个关键词，或切换到其他分类看看',
    btnText: '清空筛选',
    action: 'resetFilter',
  },
  mine: {
    text: '你还没有发布公告',
    tip: '发布合作需求、服务推广或资源对接信息，审核通过后展示',
    btnText: '发布公告',
    action: 'goPublish',
  },
  all: {
    text: '暂无公告',
    tip: '成为第一个发布公告的同行，把合作需求说清楚会更容易被联系',
    btnText: '发布公告',
    action: 'goPublish',
  },
}

Page({
  data: {
    keyword: '',
    category: '',
    categories,
    mine: false,
    list: [],
    total: 0,
    page: 1,
    pageSize: 10,
    hasMore: false,
    loading: true,
    loadingMore: false,
    empty: EMPTY_STATES.all,
  },

  onLoad() {
    this.load(true)
  },

  onShow() {
    // 从发布页返回时刷新，保证「我的发布」能看到刚提交的待审核公告
    if (this.loaded) this.load(true)
    this.loaded = true
  },

  onPullDownRefresh() {
    this.load(true).then(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading && !this.data.loadingMore) this.load(false)
  },

  load(reset) {
    const page = reset ? 1 : this.data.page + 1
    this.setData(reset ? { loading: true } : { loadingMore: true })
    return api
      .getNoticeList({
        keyword: this.data.keyword,
        category: this.data.category,
        mine: this.data.mine,
        page,
        pageSize: this.data.pageSize,
      })
      .then((res) => {
        const list = reset ? res.list : this.data.list.concat(res.list)
        this.setData({
          list,
          total: res.total,
          page,
          hasMore: res.hasMore,
          loading: false,
          loadingMore: false,
          empty: this.emptyStateOf(res.total),
        })
      })
      .catch((err) => {
        this.setData({ loading: false, loadingMore: false })
        util.toast(err.message)
      })
  },

  emptyStateOf(total) {
    if (total > 0) return EMPTY_STATES.all
    if (this.data.mine) return EMPTY_STATES.mine
    if (this.data.keyword.trim() || this.data.category) return EMPTY_STATES.search
    return EMPTY_STATES.all
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  onSearch() {
    this.load(true)
  },

  onCategoryTap(e) {
    this.setData({ category: e.currentTarget.dataset.value })
    this.load(true)
  },

  onModeTap(e) {
    const mine = e.currentTarget.dataset.mine === true || e.currentTarget.dataset.mine === 'true'
    if (mine === this.data.mine) return
    this.setData({ mine, category: '' })
    this.load(true)
  },

  resetFilter() {
    this.setData({ keyword: '', category: '' })
    this.load(true)
  },

  onEmptyAction(e) {
    const action = this.data.empty.action
    if (action === 'resetFilter') this.resetFilter()
    else this.goPublish()
  },

  onNoticeTap(e) {
    wx.navigateTo({ url: `/pages/hall/notice-detail?id=${e.currentTarget.dataset.id}` })
  },

  goPublish() {
    wx.navigateTo({ url: '/pages/hall/notice-publish' })
  },
})
