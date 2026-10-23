Component({
  options: { addGlobalClass: true },
  properties: {
    task: { type: Object, value: {} },
    /** 推荐场景下传入的匹配原因，普通列表不传则不渲染 */
    reasons: { type: Array, value: [] },
    /** 是否展示「去报价」入口，仅接单人视角的列表需要开启 */
    quotable: { type: Boolean, value: false },
  },
  methods: {
    onTap() {
      this.triggerEvent('tasktap', { id: this.data.task.id })
    },
    onQuote() {
      this.triggerEvent('quote', { id: this.data.task.id })
    },
  },
})
