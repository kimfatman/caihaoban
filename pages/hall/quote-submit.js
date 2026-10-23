const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    taskId: '',
    quoteId: '',
    task: null,
    quote: null,
    editing: false,
    submitting: false,
    form: {
      amount: '',
      remark: '',
      expectDate: '',
      feeInclude: '',
      advanceFee: '',
      attachments: [],
    },
    today: util.formatDate(Date.now()),
  },

  onLoad(options) {
    if (options.quoteId) {
      this.setData({ quoteId: options.quoteId, editing: true })
      wx.setNavigationBarTitle({ title: '修改报价' })
      this.loadQuote(options.quoteId)
    } else if (options.taskId) {
      this.setData({ taskId: options.taskId })
      this.loadTask(options.taskId)
    }
  },

  loadTask(taskId) {
    api
      .getTaskDetail(taskId)
      .then((task) => {
        this.setData({ task })
      })
      .catch((err) => util.toast(err.message))
  },

  loadQuote(quoteId) {
    api
      .getQuoteDetail(quoteId)
      .then((quote) => {
        const expect = new Date(quote.expectFinishAt)
        this.setData({
          task: quote.task,
          taskId: quote.taskId,
          quote,
          form: {
            amount: String(quote.amount),
            remark: quote.remark,
            expectDate: util.formatDate(expect),
            feeInclude: quote.feeInclude || '',
            advanceFee: quote.advanceFee || '',
            attachments: quote.attachments || [],
          },
        })
      })
      .catch((err) => util.toast(err.message))
  },

  onFieldInput(e) {
    this.setData({ [`form.${e.currentTarget.dataset.field}`]: e.detail.value })
  },

  onDateChange(e) {
    this.setData({ 'form.expectDate': e.detail.value })
  },

  chooseAttachment() {
    util.chooseMedia(3).then((paths) => {
      if (!paths.length) return
      const attachments = this.data.form.attachments.concat(
        paths.map((path, index) => ({
          name: `报价附件_${this.data.form.attachments.length + index + 1}.jpg`,
          size: '图片',
          path,
        }))
      )
      this.setData({ 'form.attachments': attachments })
    })
  },

  removeAttachment(e) {
    const list = this.data.form.attachments.slice()
    list.splice(Number(e.currentTarget.dataset.index), 1)
    this.setData({ 'form.attachments': list })
  },

  onSubmit() {
    if (this.data.submitting) return
    const { form, quoteId } = this.data
    const amount = Number(form.amount)
    if (!amount || amount <= 0) {
      util.toast('请填写有效的报价金额')
      return
    }
    if (!form.remark.trim() || form.remark.trim().length < 5) {
      util.toast('请填写报价说明（至少 5 个字）')
      return
    }
    if (!form.expectDate) {
      util.toast('请选择预计完成时间')
      return
    }
    this.setData({ submitting: true })
    api
      .saveQuote(
        {
          taskId: this.data.taskId,
          amount,
          remark: form.remark.trim(),
          expectFinishAt: util.toTimestamp(form.expectDate),
          feeInclude: form.feeInclude.trim(),
          advanceFee: form.advanceFee.trim(),
          attachments: form.attachments.map((item) => ({ name: item.name, size: item.size })),
        },
        quoteId
      )
      .then(() => {
        this.setData({ submitting: false })
        util.toast(quoteId ? '报价已更新' : '报价已提交', 'success')
        setTimeout(() => wx.navigateBack(), 600)
      })
      .catch((err) => {
        this.setData({ submitting: false })
        util.toast(err.message)
      })
  },

  onWithdraw() {
    wx.showModal({
      title: '撤回报价',
      content: '撤回后报价立即失效，可在报价截止前重新提交。',
      editable: true,
      placeholderText: '撤回原因（选填）',
      confirmColor: '#e54545',
      success: (res) => {
        if (!res.confirm) return
        api
          .withdrawQuote(this.data.quoteId, res.content)
          .then(() => {
            util.toast('已撤回报价', 'success')
            setTimeout(() => wx.navigateBack(), 600)
          })
          .catch((err) => util.toast(err.message))
      },
    })
  },
})
