Component({
  options: { addGlobalClass: true },
  properties: {
    topic: { type: Object, value: {} },
    showStatus: { type: Boolean, value: false },
  },
  methods: {
    onTap() {
      this.triggerEvent('topictap', { id: this.data.topic.id })
    },
  },
})
