/**
 * 私聊域（占位）。
 *
 * 接入方式：在此导出与 action 第二段同名的方法（list / detail / send / read 等）。
 * 客户端用数据库 watch 监听 conversations 集合实现实时刷新，关键节点由本域发订阅消息。
 */
module.exports = {}
