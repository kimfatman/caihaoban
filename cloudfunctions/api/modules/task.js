/**
 * 任务域（占位）。
 *
 * 接入方式：在此导出与 action 第二段同名的方法，例如
 *   async function list(params, ctx) {}
 *   async function publish(params, ctx) {}
 * index.js 的路由会自动分发。在此之前，客户端仍走 utils/api.js 里的内存 Mock。
 */
module.exports = {}
