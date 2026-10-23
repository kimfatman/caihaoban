const api = require('../../utils/api')
const dict = require('../../utils/dict')
const util = require('../../utils/util')

const provinces = dict.regions.map((item) => item.name)
const ALL_CITY = '全省 / 全市服务'
const MUNICIPALITIES = ['北京市', '上海市', '天津市', '重庆市', '香港特别行政区', '澳门特别行政区']

function citiesOf(provinceName) {
  const hit = dict.regions.find((item) => item.name === provinceName)
  return hit ? hit.cities : []
}

/** 统一生成可点击 chip 列表，避免在 WXML 里调用方法 */
function chipOptions(list, selected) {
  const picked = selected || []
  return list.map((item) => ({
    value: item.value,
    label: item.label,
    active: picked.indexOf(item.value) >= 0,
  }))
}

function areaLabel(area) {
  if (!area) return ''
  if (area.city) return `${area.province} · ${area.city}`
  const scope = MUNICIPALITIES.indexOf(area.province) >= 0 ? '全市' : '全省'
  return `${area.province} · ${scope}服务`
}

function areaLabels(areas) {
  return (areas || []).map((area) => areaLabel(area))
}

Page({
  data: {
    loading: true,
    saving: false,
    profileId: '',
    completeness: 0,
    updatedAtText: '未填写',
    businessChips: [],
    qualificationChips: [],
    modeOptions: [],
    statusOptions: [],
    capacityOptions: [],
    quoteOptions: [],
    areas: [],
    areaTexts: [],
    years: '',
    intro: '',
    regionVisible: false,
    provinces,
    provinceIndex: 0,
    provinceName: '',
    cityOptions: [],
    cityIndex: 0,
    cityName: '',
    allCityLabel: ALL_CITY,
  },

  onLoad() {
    this.loadProfile()
  },

  loadProfile() {
    api
      .getServiceProfile()
      .then((profile) => {
        const areas = profile.areas || []
        const firstProvince = areas.length ? areas[0].province : provinces[0]
        this.setData({
          loading: false,
          profileId: profile.id || '',
          completeness: profile.completenessPercent,
          updatedAtText: profile.updatedAtText,
          businessChips: chipOptions(dict.serviceTypes, profile.businessTypes),
          qualificationChips: chipOptions(dict.qualifications, profile.qualifications),
          modeOptions: chipOptions(dict.serviceModes, profile.serviceMode ? [profile.serviceMode] : []),
          statusOptions: chipOptions(dict.providerStatus, profile.orderStatus ? [profile.orderStatus] : []),
          capacityOptions: chipOptions(dict.monthlyCapacity, profile.monthlyCapacity ? [profile.monthlyCapacity] : []),
          quoteOptions: chipOptions(dict.quoteModes, profile.quoteMode ? [profile.quoteMode] : []),
          areas,
          areaTexts: areaLabels(areas),
          years: profile.yearsOfExperience ? String(profile.yearsOfExperience) : '',
          intro: profile.intro || '',
        })
        this.syncProvince(firstProvince)
      })
      .catch((err) => {
        this.setData({ loading: false })
        util.toast(err.message)
      })
  },

  /** 取出某个 chip 组当前选中的值 */
  selected(key) {
    return this.data[key].filter((item) => item.active).map((item) => item.value)
  },

  /** 与后端一致的完整度估算，用于实时进度条 */
  refreshCompleteness() {
    const required = [
      this.selected('businessChips').length > 0,
      this.data.areas.length > 0,
      this.selected('modeOptions').length > 0,
      this.selected('statusOptions').length > 0,
      this.selected('capacityOptions').length > 0,
      this.selected('quoteOptions').length > 0,
    ].filter(Boolean).length
    const optional = [
      this.selected('qualificationChips').length > 0,
      Number(this.data.years) > 0,
      !!String(this.data.intro || '').trim(),
    ].filter(Boolean).length
    const value = (required / 6) * 0.7 + (optional / 3) * 0.3
    this.setData({ completeness: Math.round(value * 100) })
  },

  toggleChip(key, value) {
    const chips = this.data[key].map((item) =>
      item.value === value ? Object.assign({}, item, { active: !item.active }) : item
    )
    this.setData({ [key]: chips })
    this.refreshCompleteness()
  },

  selectOne(key, value) {
    const chips = this.data[key].map((item) => Object.assign({}, item, { active: item.value === value }))
    this.setData({ [key]: chips })
    this.refreshCompleteness()
  },

  onBusinessTap(e) {
    this.toggleChip('businessChips', e.currentTarget.dataset.value)
  },

  onQualificationTap(e) {
    this.toggleChip('qualificationChips', e.currentTarget.dataset.value)
  },

  onModeTap(e) {
    this.selectOne('modeOptions', e.currentTarget.dataset.value)
  },

  onStatusTap(e) {
    this.selectOne('statusOptions', e.currentTarget.dataset.value)
  },

  onCapacityTap(e) {
    this.selectOne('capacityOptions', e.currentTarget.dataset.value)
  },

  onQuoteTap(e) {
    this.selectOne('quoteOptions', e.currentTarget.dataset.value)
  },

  onYearsInput(e) {
    this.setData({ years: e.detail.value })
    this.refreshCompleteness()
  },

  onIntroInput(e) {
    this.setData({ intro: e.detail.value })
    this.refreshCompleteness()
  },

  /* ---------------- 可服务地区 ---------------- */

  openRegion() {
    this.syncProvince(this.data.provinceName || provinces[0])
    this.setData({ regionVisible: true })
  },

  closeRegion() {
    this.setData({ regionVisible: false })
  },

  syncProvince(name) {
    const index = Math.max(0, provinces.indexOf(name))
    const provinceName = provinces[index]
    const cityOptions = [ALL_CITY].concat(citiesOf(provinceName))
    const cityIndex = Math.max(0, cityOptions.indexOf(this.data.cityName))
    this.setData({
      provinceIndex: index,
      provinceName,
      cityOptions,
      cityIndex,
      cityName: cityOptions[cityIndex],
    })
  },

  onProvinceChange(e) {
    const index = Number(e.detail.value)
    const provinceName = provinces[index]
    const cityOptions = [ALL_CITY].concat(citiesOf(provinceName))
    this.setData({
      provinceIndex: index,
      provinceName,
      cityOptions,
      cityIndex: 0,
      cityName: cityOptions[0],
    })
  },

  onCityChange(e) {
    const index = Number(e.detail.value)
    this.setData({ cityIndex: index, cityName: this.data.cityOptions[index] })
  },

  addArea() {
    const { provinceName, cityName, areas } = this.data
    const city = cityName === ALL_CITY ? '' : cityName
    if (areas.some((item) => item.province === provinceName && item.city === city)) {
      util.toast('该地区已添加')
      return
    }
    if (areas.length >= 20) {
      util.toast('最多添加 20 个地区')
      return
    }
    const next = areas.concat({ province: provinceName, city })
    this.setData({ areas: next, areaTexts: areaLabels(next), regionVisible: false })
    this.refreshCompleteness()
  },

  removeArea(e) {
    const index = Number(e.currentTarget.dataset.index)
    const next = this.data.areas.slice()
    next.splice(index, 1)
    this.setData({ areas: next, areaTexts: areaLabels(next) })
    this.refreshCompleteness()
  },

  /* ---------------- 保存 ---------------- */

  buildPayload() {
    return {
      id: this.data.profileId,
      businessTypes: this.selected('businessChips'),
      areas: this.data.areas,
      serviceMode: this.selected('modeOptions')[0] || '',
      orderStatus: this.selected('statusOptions')[0] || '',
      monthlyCapacity: this.selected('capacityOptions')[0] || '',
      quoteMode: this.selected('quoteOptions')[0] || '',
      qualifications: this.selected('qualificationChips'),
      yearsOfExperience: Number(this.data.years) || 0,
      intro: String(this.data.intro || '').trim(),
    }
  },

  onSave() {
    if (this.data.saving) return
    const payload = this.buildPayload()
    if (!payload.businessTypes.length) return util.toast('请至少选择 1 项擅长业务')
    if (!payload.areas.length) return util.toast('请至少添加 1 个可服务地区')
    if (!payload.serviceMode) return util.toast('请选择服务方式')
    if (!payload.orderStatus) return util.toast('请选择接单状态')
    if (!payload.monthlyCapacity) return util.toast('请选择月度接单能力')
    if (!payload.quoteMode) return util.toast('请选择报价方式')

    this.setData({ saving: true })
    api
      .saveServiceProfile(payload)
      .then((profile) => {
        this.setData({
          saving: false,
          profileId: profile.id,
          completeness: profile.completenessPercent,
          updatedAtText: profile.updatedAtText,
        })
        util.toast('服务能力已保存', 'success')
      })
      .catch((err) => {
        this.setData({ saving: false })
        util.toast(err.message)
      })
  },

  goRecommend() {
    wx.navigateTo({ url: '/pages/hall/recommend' })
  },

  noop() {},
})
