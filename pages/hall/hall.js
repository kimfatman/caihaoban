const api = require('../../utils/api')
const dict = require('../../utils/dict')

const regionTree = dict.regions
const serviceOptions = ['全部业务'].concat(dict.serviceTypes.map((item) => item.label))
const statusList = [{ value: '', label: '全部' }].concat(
  dict.taskStatus.map((item) => ({ value: item.value, label: item.label }))
)

Page({
  data: {
    keyword: '',
    city: '',
    regionLabel: '全部地区',
    regionTree,
    hotCities: dict.hotCities,
    regionVisible: false,
    activeProvince: regionTree[0].name,
    activeProvinceIndex: 0,
    activeCities: regionTree[0].cities,
    serviceIndex: 0,
    serviceOptions,
    serviceLabel: '全部业务',
    serviceTypes: dict.serviceTypes,
    status: '',
    statusList,
    list: [],
    total: 0,
    loading: true,
    hasFilter: false,
  },

  onShow() {
    this.loadList()
  },

  onPullDownRefresh() {
    this.loadList().then(() => wx.stopPullDownRefresh())
  },

  /**
   * 大厅展示顺序：可参与（报价中且非本机构发布）的任务优先，其余保持接口返回的发布时间倒序。
   * 只调整顺序，不改动 getTaskList 的筛选条件与状态规则。
   */
  sortForHall(list) {
    const quotable = []
    const others = []
    list.forEach((item) => (item.canQuote ? quotable : others).push(item))
    return quotable.concat(others)
  },

  loadList() {
    const { keyword, city, serviceTypes, serviceIndex, status } = this.data
    this.setData({ loading: true })
    return api
      .getTaskList({
        keyword,
        city,
        serviceType: serviceIndex > 0 ? serviceTypes[serviceIndex - 1].value : '',
        status,
      })
      .then((list) => {
        this.setData({
          list: this.sortForHall(list),
          total: list.length,
          loading: false,
          hasFilter: !!(keyword || city || serviceIndex > 0 || status),
        })
      })
      .catch((err) => {
        this.setData({ loading: false })
        wx.showToast({ title: err.message, icon: 'none' })
      })
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  onSearch() {
    this.loadList()
  },

  /* ---------------- 地区：省 / 市两级折叠选择 ---------------- */

  openRegion() {
    this.setData({ regionVisible: true })
  },

  closeRegion() {
    this.setData({ regionVisible: false })
  },

  /** 左侧选省：切换右侧城市列表（折叠展开效果） */
  onProvinceTap(e) {
    const name = e.currentTarget.dataset.name
    const index = this.data.regionTree.findIndex((item) => item.name === name)
    if (index < 0) return
    this.setData({
      activeProvince: name,
      activeProvinceIndex: index,
      activeCities: this.data.regionTree[index].cities,
    })
  },

  onCityTap(e) {
    this.applyRegion(e.currentTarget.dataset.city)
  },

  onHotCityTap(e) {
    this.applyRegion(e.currentTarget.dataset.city)
  },

  /** 选中城市：反查所属省份并同步高亮，随后刷新列表 */
  applyRegion(city) {
    if (!city) return
    const tree = this.data.regionTree
    const index = tree.findIndex((item) => item.cities.includes(city))
    if (index < 0) return
    const province = tree[index]
    this.setData({
      city,
      regionLabel: `${province.short} · ${city}`,
      activeProvince: province.name,
      activeProvinceIndex: index,
      activeCities: province.cities,
      regionVisible: false,
    })
    this.loadList()
  },

  clearRegion() {
    this.setData({ city: '', regionLabel: '全部地区', regionVisible: false })
    this.loadList()
  },

  onServiceChange(e) {
    const index = Number(e.detail.value)
    this.setData({ serviceIndex: index, serviceLabel: serviceOptions[index] })
    this.loadList()
  },

  onStatusTap(e) {
    this.setData({ status: e.currentTarget.dataset.value })
    this.loadList()
  },

  resetFilter() {
    this.setData({
      keyword: '',
      city: '',
      regionLabel: '全部地区',
      serviceIndex: 0,
      status: '',
      serviceLabel: '全部业务',
    })
    this.loadList()
  },

  onTaskTap(e) {
    wx.navigateTo({ url: `/pages/hall/task-detail?id=${e.detail.id}` })
  },

  /** 列表内直接去报价：已报过价则进入修改，避免重复提交报错 */
  onQuoteTap(e) {
    const id = e.detail && e.detail.id
    if (!id) return
    const task = this.data.list.find((item) => item.id === id)
    if (!task) return
    const quoteId = task.myQuoteId || task.orgQuoteId
    wx.navigateTo({
      url: quoteId ? `/pages/hall/quote-submit?quoteId=${quoteId}` : `/pages/hall/quote-submit?taskId=${id}`,
    })
  },

  goPublish() {
    wx.navigateTo({ url: '/pages/hall/task-publish' })
  },

  /** 公告牌入口 */
  goNotice() {
    wx.navigateTo({ url: '/pages/hall/notice' })
  },

  noop() {},
})
