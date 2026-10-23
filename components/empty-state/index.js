Component({
  options: { addGlobalClass: true },
  properties: {
    text: { type: String, value: '暂无数据' },
    tip: { type: String, value: '' },
    btnText: { type: String, value: '' },
  },
  methods: {
    onAction() {
      this.triggerEvent('action')
    },
  },
})
