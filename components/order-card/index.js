Component({
  options: { addGlobalClass: true },
  properties: {
    order: { type: Object, value: {} },
  },
  methods: {
    onTap() {
      this.triggerEvent('ordertap', { id: this.data.order.id })
    },
  },
})
