const api = require('../../utils/api')
const dict = require('../../utils/dict')
const util = require('../../utils/util')

const statusList = [{ value: '', label: '全部' }].concat(
  dict.taskStatus.map((item) => ({ value: item.value, label: item.label }))
)

Page({
  data: {
    statusList,
    status: '',
    list: [],
    loading: true,
  },

  onShow() {
    this.loadList()
  },

  loadList() {
    this.setData({ loading: true })
    return api
      .getTaskList({ mine: true, status: this.data.status })
      .then((list) => this.setData({ list, loading: false }))
      .catch((err) => {
        this.setData({ loading: false })
        util.toast(err.message)
      })
  },

  onStatusTap(e) {
    this.setData({ status: e.currentTarget.dataset.value })
    this.loadList()
  },

  onTaskTap(e) {
    wx.navigateTo({ url: `/pages/hall/task-detail?id=${e.detail.id}` })
  },

  goPublish() {
    wx.navigateTo({ url: '/pages/hall/task-publish' })
  },
})
