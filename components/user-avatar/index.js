/**
 * 统一头像：始终为圆形；已上传头像显示图片，否则回退为「首字 + 稳定底色」。
 * tags 为 QQ 头像式的角标标签（实名 ✓ / 机构 企 / 店 / 未认证 !），叠在头像角落。
 */
Component({
  options: { addGlobalClass: true },
  properties: {
    view: {
      type: Object,
      value: { type: 'text', src: '', text: '企', tone: 'tone-a' },
    },
    /** 边长，单位 rpx */
    size: { type: Number, value: 80 },
    /** QQ 式角标：{ key, text, type } */
    tags: { type: Array, value: [] },
    /** 角标位置：br 右下（默认） / tr 右上 / bl 左下 / tl 左上 */
    place: { type: String, value: 'br' },
    /** 我的消息气泡等场景可关闭角标 */
    showTags: { type: Boolean, value: true },
  },

  data: {
    fontSize: 32,
    tagSize: 28,
    tagFont: 18,
    radius: 40,
  },

  observers: {
    size: function (size) {
      const px = Math.max(40, Number(size) || 80)
      const tagSize = Math.max(24, Math.round(px * 0.36))
      this.setData({
        fontSize: Math.round(px * 0.4),
        radius: Math.round(px / 2),
        tagSize,
        tagFont: Math.round(tagSize * 0.62),
      })
    },
  },
})
