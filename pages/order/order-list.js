const api = require('../../utils/api')
const dict = require('../../utils/dict')
const util = require('../../utils/util')

const roles = [
  { value: 'all', label: '全部' },
  { value: 'demand', label: '我发布的' },
  { value: 'supply', label: '我承接的' },
]

const statusList = [{ value: '', label: '全部状态' }].concat(
  dict.orderStatus.map((item) => ({ value: item.value, label: item.label }))
)

Page({
  data: {
    roles,
    role: 'all',
    statusList,
    status: '',
    list: [],
    loading: true,
    total: 0,
  },

  onLoad(options) {
    if (options.role === 'demand' || options.role === 'supply') {
      this.setData({ role: options.role })
    }
    if (options.status) this.setData({ status: options.status })
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
      .getOrderList({ role: this.data.role, status: this.data.status })
      .then((list) => this.setData({ list, total: list.length, loading: false }))
      .catch((err) => {
        this.setData({ loading: false })
        util.toast(err.message)
      })
  },

  onRoleTap(e) {
    this.setData({ role: e.currentTarget.dataset.value })
    this.loadList()
  },

  onStatusTap(e) {
    this.setData({ status: e.currentTarget.dataset.value })
    this.loadList()
  },

  onOrderTap(e) {
    wx.navigateTo({ url: `/pages/order/order-detail?id=${e.detail.id}` })
  },

  goHall() {
    wx.switchTab({ url: '/pages/hall/hall' })
  },
})
