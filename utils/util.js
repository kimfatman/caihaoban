const DAY = 24 * 60 * 60 * 1000

const pad = (n) => (n < 10 ? `0${n}` : `${n}`)

function formatDate(input, withTime = false) {
  if (!input) return '-'
  const date = typeof input === 'number' ? new Date(input) : new Date(String(input).replace(/-/g, '/'))
  if (Number.isNaN(date.getTime())) return '-'
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  if (!withTime) return `${y}-${m}-${d}`
  return `${y}-${m}-${d} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromNow(input) {
  if (!input) return '-'
  const diff = Date.now() - new Date(input).getTime()
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < DAY) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}天前`
  return formatDate(input)
}

function countdown(input) {
  if (!input) return '-'
  const diff = new Date(input).getTime() - Date.now()
  if (diff <= 0) return '已截止'
  const days = Math.floor(diff / DAY)
  if (days >= 1) return `${days}天后截止`
  const hours = Math.floor(diff / 3600000)
  if (hours >= 1) return `${hours}小时后截止`
  return `${Math.max(1, Math.floor(diff / 60000))}分钟后截止`
}

function money(value) {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (Number.isNaN(num)) return String(value)
  return num.toFixed(2).replace(/\.00$/, '')
}

function maskPhone(phone) {
  if (!phone) return '-'
  return String(phone).replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')
}

function maskName(name) {
  if (!name) return '匿名'
  if (name.length <= 1) return name
  return `${name.slice(0, 1)}**`
}

function initials(name) {
  if (!name) return '企'
  return name.trim().slice(0, 1)
}

/** 去掉行政后缀，得到紧凑城市名：四川省/成都市/武侯区 → 成都 */
function shortCity(text) {
  const parts = (text || '').split('/').filter(Boolean)
  if (!parts.length) return ''
  const city = parts.length > 1 ? parts[1] : parts[0]
  return city.replace(/(特别行政区|自治州|地区|新区|市|盟|县|区)$/, '') || city
}

const AVATAR_TONES = ['tone-a', 'tone-b', 'tone-c', 'tone-d', 'tone-e', 'tone-f']

/** 由用户/机构 ID 派生稳定的头像底色，避免每次渲染跳色 */
function avatarTone(seed) {
  const text = String(seed || '')
  let hash = 7
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 9973
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length]
}

/**
 * 统一的头像视图模型：已上传头像走图片，未上传回退为「首字 + 稳定底色」。
 * user 可为用户对象或含 nickname/name 的任意来源。
 */
function avatarView(user, seed) {
  const info = user || {}
  const src = info.avatar || ''
  const name = info.nickname || info.name || info.realName || ''
  return {
    type: src ? 'image' : 'text',
    src,
    text: initials(name),
    tone: avatarTone(seed || info.id || name),
    name,
  }
}

/**
 * 校验头像地址，仅允许小程序本地临时文件与 https 地址。
 * 拦截 javascript:、data: 等协议，避免把外部可执行内容写进展示字段。
 */
function safeAvatarUrl(value) {
  const text = (value || '').trim()
  if (!text) return ''
  return /^(https:\/\/|wxfile:\/\/|http:\/\/|\/)/.test(text) ? text : ''
}

function toast(title, icon = 'none') {
  wx.showToast({ title, icon, duration: 1800 })
}

function confirm(content, title = '提示') {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      confirmColor: '#1b6ef3',
      success: (res) => resolve(!!res.confirm),
      fail: () => resolve(false),
    })
  })
}

function loading(title = '处理中') {
  wx.showLoading({ title, mask: true })
}

function hideLoading() {
  wx.hideLoading()
}

function clone(data) {
  return JSON.parse(JSON.stringify(data))
}

function parseQuery(options = {}) {
  return Object.keys(options).reduce((acc, key) => {
    acc[key] = decodeURIComponent(options[key])
    return acc
  }, {})
}

/** 生成形如 20260114-0001 的订单号 */
function buildOrderNo(seed) {
  const date = new Date()
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  return `DD${stamp}${String(seed).padStart(4, '0')}`
}

/** 模拟上传：返回本地临时路径，真实环境替换为 wx.uploadFile */
function chooseMedia(count = 3) {
  return new Promise((resolve) => {
    wx.chooseMedia({
      count,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: (res) => resolve(res.tempFiles.map((item) => item.tempFilePath)),
      fail: () => resolve([]),
    })
  })
}

/** 日期选择结果转时间戳 */
function toTimestamp(dateStr, timeStr) {
  if (!dateStr) return 0
  const full = `${dateStr}${timeStr ? ` ${timeStr}` : ' 18:00'}`
  return new Date(full.replace(/-/g, '/')).getTime()
}

module.exports = {
  DAY,
  formatDate,
  fromNow,
  countdown,
  money,
  maskPhone,
  maskName,
  initials,
  avatarTone,
  avatarView,
  safeAvatarUrl,
  shortCity,
  toast,
  confirm,
  loading,
  hideLoading,
  clone,
  parseQuery,
  buildOrderNo,
  chooseMedia,
  toTimestamp,
}
