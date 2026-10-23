const api = require('../../utils/api')
const dict = require('../../utils/dict')
const util = require('../../utils/util')

const regions = ['不选择地区'].concat(dict.regions.map((item) => item.name))

Page({
  data: {
    categories: dict.topicCategories,
    category: '',
    regions,
    regionIndex: 0,
    region: '',
    title: '',
    content: '',
    images: [],
    attachments: [],
    submitting: false,
  },

  onCategoryTap(e) {
    this.setData({ category: e.currentTarget.dataset.value })
  },

  onRegionChange(e) {
    const index = Number(e.detail.value)
    this.setData({ regionIndex: index, region: index === 0 ? '' : regions[index] })
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value })
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value })
  },

  addImages() {
    util.chooseMedia(6).then((paths) => {
      if (!paths.length) return
      this.setData({ images: this.data.images.concat(paths) })
    })
  },

  removeImage(e) {
    const images = this.data.images.slice()
    images.splice(Number(e.currentTarget.dataset.index), 1)
    this.setData({ images })
  },

  addAttachment() {
    util.chooseMedia(3).then((paths) => {
      if (!paths.length) return
      const attachments = this.data.attachments.concat(
        paths.map((path, index) => ({
          name: `话题附件_${this.data.attachments.length + index + 1}.jpg`,
          size: '图片',
          path,
        }))
      )
      this.setData({ attachments })
    })
  },

  removeAttachment(e) {
    const attachments = this.data.attachments.slice()
    attachments.splice(Number(e.currentTarget.dataset.index), 1)
    this.setData({ attachments })
  },

  onSubmit() {
    const { title, content, category, region, images, attachments, submitting } = this.data
    if (submitting) return
    if (!category) {
      util.toast('请选择话题分类')
      return
    }
    if (title.trim().length < 6) {
      util.toast('标题至少 6 个字')
      return
    }
    if (content.trim().length < 20) {
      util.toast('正文至少 20 个字')
      return
    }
    this.setData({ submitting: true })
    api
      .createTopic({
        title: title.trim(),
        content: content.trim(),
        category,
        region,
        images,
        attachments: attachments.map((item) => ({ name: item.name, size: item.size })),
      })
      .then(() => {
        this.setData({ submitting: false })
        util.toast('话题已发布', 'success')
        setTimeout(() => wx.navigateBack(), 600)
      })
      .catch((err) => {
        this.setData({ submitting: false })
        util.toast(err.message)
      })
  },
})
