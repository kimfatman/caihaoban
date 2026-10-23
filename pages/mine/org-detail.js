const api = require('../../utils/api')
const util = require('../../utils/util')

const roleOptions = [
  { value: 'admin', label: '管理员' },
  { value: 'member', label: '成员' },
]

Page({
  data: {
    orgId: '',
    org: null,
    permissionLabels: [],
    roleOptions,
    roleIndex: 0,
    showAdd: false,
    addName: '',
    addPhone: '',
    addRoleIndex: 0,
    addRoleLabel: '管理员',
    submitting: false,
  },

  onLoad(options) {
    this.setData({ orgId: options.id })
  },

  onShow() {
    this.loadOrg()
  },

  loadOrg() {
    api
      .getOrgDetail(this.data.orgId)
      .then((org) => {
        const permissionLabels = Object.keys(org.permissions)
          .filter((key) => org.myPermissions.includes(key))
          .map((key) => org.permissions[key])
        this.setData({ org, permissionLabels })
      })
      .catch((err) => util.toast(err.message))
  },

  openAdd() {
    this.setData({
      showAdd: true,
      addName: '',
      addPhone: '',
      addRoleIndex: 0,
      addRoleLabel: roleOptions[0].label,
    })
  },

  closeAdd() {
    this.setData({ showAdd: false })
  },

  noop() {},

  onAddInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value })
  },

  onAddRoleChange(e) {
    const index = Number(e.detail.value)
    this.setData({ addRoleIndex: index, addRoleLabel: roleOptions[index].label })
  },

  submitAdd() {
    const { addName, addPhone, addRoleIndex, orgId, submitting } = this.data
    if (submitting) return
    if (!addName.trim()) {
      util.toast('请填写成员姓名')
      return
    }
    if (!/^1\d{10}$/.test(addPhone)) {
      util.toast('请填写正确的手机号')
      return
    }
    this.setData({ submitting: true })
    api
      .addOrgMember(orgId, {
        name: addName.trim(),
        phone: addPhone,
        role: roleOptions[addRoleIndex].value,
      })
      .then(() => {
        this.setData({ submitting: false, showAdd: false })
        util.toast('成员已添加', 'success')
        this.loadOrg()
      })
      .catch((err) => {
        this.setData({ submitting: false })
        util.toast(err.message)
      })
  },

  changeRole(e) {
    const { id, role } = e.currentTarget.dataset
    if (role === 'owner') {
      util.toast('负责人角色不可变更')
      return
    }
    wx.showActionSheet({
      itemList: roleOptions.map((item) => item.label),
      success: (res) => {
        api
          .updateOrgMember(this.data.orgId, id, roleOptions[res.tapIndex].value)
          .then(() => {
            util.toast('角色已更新', 'success')
            this.loadOrg()
          })
          .catch((err) => util.toast(err.message))
      },
    })
  },

  removeMember(e) {
    const { id, name } = e.currentTarget.dataset
    wx.showModal({
      title: '移除成员',
      content: `确认将「${name}」移出本机构？移除后该成员将无法查看机构任务与订单。`,
      confirmColor: '#e54545',
      success: (res) => {
        if (!res.confirm) return
        api
          .removeOrgMember(this.data.orgId, id)
          .then(() => {
            util.toast('成员已移除', 'success')
            this.loadOrg()
          })
          .catch((err) => util.toast(err.message))
      },
    })
  },
})
