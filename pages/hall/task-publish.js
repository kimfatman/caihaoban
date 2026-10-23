const api = require('../../utils/api')
const dict = require('../../utils/dict')
const util = require('../../utils/util')
const recommend = require('../../utils/recommend')

const provinces = dict.regions.map((item) => item.name)

function chipOptions(list, selected) {
  const picked = selected || []
  return list.map((item) => ({
    value: item.value,
    label: item.label,
    active: picked.indexOf(item.value) >= 0,
  }))
}

function citiesOf(province) {
  const hit = dict.regions.find((item) => item.name === province)
  return hit ? hit.cities : []
}

Page({
  data: {
    taskId: '',
    editing: false,
    submitting: false,
    serviceTypes: dict.serviceTypes,
    serviceIndex: 0,
    serviceLabel: dict.serviceTypes[0].label,
    provinces,
    cities: [],
    provinceIndex: 0,
    provinceLabel: '',
    cityIndex: 0,
    cityLabel: '',
    orgs: [],
    orgIndex: 0,
    orgName: '',
    form: {
      title: '',
      description: '',
      address: '',
      expectedDate: '',
      expectedTime: '18:00',
      referencePrice: '',
      quoteDate: '',
      quoteTime: '18:00',
      requirements: [],
      attachments: [],
      onsiteRequired: false,
      requiredQualifications: [],
    },
    /** 是否已手动切换「需现场办理」，未切换时按说明文字自动推断 */
    onsiteTouched: false,
    qualificationOptions: chipOptions(dict.qualifications, []),
    requirementInput: '',
    previewVisible: false,
    preview: null,
    today: util.formatDate(Date.now()),
  },

  onLoad(options) {
    getApp()
      .ensureSession()
      .then((session) => {
        const orgs = session.memberships.map((item) => ({ id: item.orgId, name: item.orgName, role: item.role }))
        this.setData({ orgs, orgName: orgs.length ? orgs[0].name : '' })
        if (options.id) {
          this.setData({ taskId: options.id, editing: true })
          wx.setNavigationBarTitle({ title: '编辑任务' })
          this.loadTask(options.id)
        }
      })
  },

  loadTask(taskId) {
    api
      .getTaskDetail(taskId)
      .then((task) => {
        const parts = (task.region || '').split('/')
        const province = parts[0] || ''
        const city = parts[1] || ''
        const serviceIndex = Math.max(
          0,
          dict.serviceTypes.findIndex((item) => item.value === task.serviceType)
        )
        const quote = new Date(task.quoteDeadline)
        const expected = task.expectedFinishAt ? new Date(task.expectedFinishAt) : null
        const orgIndex = Math.max(0, this.data.orgs.findIndex((item) => item.id === task.publisherOrgId))
        this.setData({
          serviceIndex,
          serviceLabel: dict.serviceTypes[serviceIndex].label,
          provinces,
          cities: citiesOf(province),
          provinceLabel: province,
          provinceIndex: Math.max(0, provinces.indexOf(province)),
          cityLabel: city,
          cityIndex: Math.max(0, citiesOf(province).indexOf(city)),
          orgIndex,
          orgName: (this.data.orgs[orgIndex] || {}).name || '',
          form: {
            title: task.title,
            description: task.description,
            address: task.address || '',
            expectedDate: expected ? util.formatDate(expected) : '',
            expectedTime: expected
              ? `${String(expected.getHours()).padStart(2, '0')}:${String(expected.getMinutes()).padStart(2, '0')}`
              : '18:00',
            referencePrice: task.referencePrice ? String(task.referencePrice) : '',
            quoteDate: util.formatDate(quote),
            quoteTime: `${String(quote.getHours()).padStart(2, '0')}:${String(quote.getMinutes()).padStart(2, '0')}`,
            requirements: task.requirements || [],
            attachments: task.attachments || [],
            onsiteRequired: recommend.deriveOnsiteRequired(task),
            requiredQualifications: task.requiredQualifications || [],
          },
          onsiteTouched: true,
          qualificationOptions: chipOptions(dict.qualifications, task.requiredQualifications || []),
        })
      })
      .catch((err) => util.toast(err.message))
  },

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
    // 说明或地址变化时同步「需现场办理」的智能默认值，手动切换过则以用户为准
    if (!this.data.onsiteTouched && (field === 'description' || field === 'address')) {
      this.setData({
        'form.onsiteRequired': recommend.deriveOnsiteRequired({
          description: this.data.form.description,
          address: this.data.form.address,
        }),
      })
    }
  },

  onOnsiteChange(e) {
    this.setData({ 'form.onsiteRequired': !!e.detail.value, onsiteTouched: true })
  },

  onQualificationTap(e) {
    const value = e.currentTarget.dataset.value
    const options = this.data.qualificationOptions.map((item) =>
      item.value === value ? Object.assign({}, item, { active: !item.active }) : item
    )
    this.setData({
      qualificationOptions: options,
      'form.requiredQualifications': options.filter((item) => item.active).map((item) => item.value),
    })
  },

  onServiceChange(e) {
    const index = Number(e.detail.value)
    this.setData({ serviceIndex: index, serviceLabel: dict.serviceTypes[index].label })
  },

  onOrgChange(e) {
    const index = Number(e.detail.value)
    this.setData({ orgIndex: index, orgName: this.data.orgs[index].name })
  },

  onProvinceChange(e) {
    const index = Number(e.detail.value)
    const province = provinces[index]
    const cities = citiesOf(province)
    this.setData({
      provinceIndex: index,
      provinceLabel: province,
      cities,
      cityIndex: 0,
      cityLabel: cities[0] || '',
    })
  },

  onCityChange(e) {
    const index = Number(e.detail.value)
    this.setData({ cityIndex: index, cityLabel: this.data.cities[index] })
  },

  onDateChange(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  onRequirementInput(e) {
    this.setData({ requirementInput: e.detail.value })
  },

  addRequirement() {
    const value = this.data.requirementInput.trim()
    if (!value) return
    if (this.data.form.requirements.includes(value)) {
      util.toast('该要求已添加')
      return
    }
    this.setData({
      'form.requirements': this.data.form.requirements.concat(value),
      requirementInput: '',
    })
  },

  removeRequirement(e) {
    const index = Number(e.currentTarget.dataset.index)
    const list = this.data.form.requirements.slice()
    list.splice(index, 1)
    this.setData({ 'form.requirements': list })
  },

  chooseAttachment() {
    util.chooseMedia(3).then((paths) => {
      if (!paths.length) return
      const attachments = this.data.form.attachments.concat(
        paths.map((path, index) => ({
          name: `附件图片_${this.data.form.attachments.length + index + 1}.jpg`,
          size: '图片',
          path,
        }))
      )
      this.setData({ 'form.attachments': attachments })
    })
  },

  removeAttachment(e) {
    const index = Number(e.currentTarget.dataset.index)
    const list = this.data.form.attachments.slice()
    list.splice(index, 1)
    this.setData({ 'form.attachments': list })
  },

  buildPayload() {
    const { form, serviceTypes, serviceIndex, cityLabel, provinceLabel } = this.data
    return {
      title: form.title.trim(),
      serviceType: serviceTypes[serviceIndex].value,
      description: form.description.trim(),
      region: `${provinceLabel}/${cityLabel}`,
      address: form.address.trim(),
      expectedFinishAt: util.toTimestamp(form.expectedDate, form.expectedTime),
      quoteDeadline: util.toTimestamp(form.quoteDate, form.quoteTime),
      referencePrice: form.referencePrice ? Number(form.referencePrice) : null,
      requirements: form.requirements,
      attachments: form.attachments.map((item) => ({ name: item.name, size: item.size })),
      onsiteRequired: !!form.onsiteRequired,
      requiredQualifications: form.requiredQualifications,
      orgId: (this.data.orgs[this.data.orgIndex] || {}).id,
    }
  },

  validate(payload) {
    if (!payload.title || payload.title.length < 5) return '任务标题至少 5 个字'
    if (!payload.description || payload.description.length < 20) return '详细说明至少 20 个字'
    if (!this.data.provinceLabel || !this.data.cityLabel) return '请选择服务区域'
    if (!payload.quoteDeadline) return '请选择报价截止时间'
    if (payload.quoteDeadline <= Date.now()) return '报价截止时间需晚于当前时间'
    if (!payload.expectedFinishAt) return '请选择期望完成时间'
    if (payload.expectedFinishAt <= payload.quoteDeadline) return '期望完成时间需晚于报价截止时间'
    if (payload.referencePrice !== null && payload.referencePrice <= 0) return '参考价需大于 0'
    return ''
  },

  onPreview() {
    const payload = this.buildPayload()
    const error = this.validate(payload)
    if (error) {
      util.toast(error)
      return
    }
    this.setData({
      previewVisible: true,
      preview: {
        ...payload,
        serviceTypeLabel: dict.labelOf(dict.serviceTypes, payload.serviceType),
        regionText: payload.region.split('/').filter(Boolean).join(' · '),
        expectedFinishText: util.formatDate(payload.expectedFinishAt),
        quoteDeadlineText: util.formatDate(payload.quoteDeadline, true),
        referencePriceText: payload.referencePrice ? `¥${util.money(payload.referencePrice)}` : '面议',
        onsiteText: payload.onsiteRequired ? '需现场办理' : '可远程办理',
        qualificationLabels: payload.requiredQualifications.map((item) => dict.labelOf(dict.qualifications, item)),
      },
    })
  },

  closePreview() {
    this.setData({ previewVisible: false })
  },

  noop() {},

  onSubmit() {
    if (this.data.submitting) return
    const payload = this.buildPayload()
    const error = this.validate(payload)
    if (error) {
      util.toast(error)
      return
    }
    this.setData({ submitting: true })
    api
      .saveTask(payload, this.data.editing ? this.data.taskId : '')
      .then((task) => {
        this.setData({ submitting: false, previewVisible: false })
        util.toast(this.data.editing ? '任务已更新' : '任务已发布', 'success')
        if (this.data.editing) {
          setTimeout(() => wx.navigateBack(), 600)
        } else {
          setTimeout(() => wx.redirectTo({ url: `/pages/hall/task-detail?id=${task.id}` }), 600)
        }
      })
      .catch((err) => {
        this.setData({ submitting: false })
        util.toast(err.message)
      })
  },
})
