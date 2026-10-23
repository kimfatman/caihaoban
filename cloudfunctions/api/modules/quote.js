/**
 * 报价域（占位）。
 *
 * 接入方式：在此导出与 action 第二段同名的方法（create / list / withdraw / accept 等），
 * index.js 的路由会自动分发。accept 需用唯一索引 + db.runTransaction 保证同一任务只有一个订单。
 */
module.exports = {}
