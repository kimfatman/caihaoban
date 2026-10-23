Component({
  options: { addGlobalClass: true },
  properties: {
    /** 由 api.getRecommendedProviders 返回的推荐项 */
    item: { type: Object, value: {} },
  },
  methods: {
    onProfile() {
      this.triggerEvent('profile', { userId: this.data.item.userId })
    },
    onInvite() {
      const item = this.data.item
      if (!item.canInvite) return
      this.triggerEvent('invite', { userId: item.userId, nickname: item.nickname })
    },
  },
})
