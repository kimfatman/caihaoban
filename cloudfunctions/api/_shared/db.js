/**
 * 数据库访问封装（云函数侧共用）。
 *
 * 各域模块统一通过 collection() 取集合句柄，不再各自 require('wx-server-sdk') 与 cloud.database()；
 * 时间戳统一走 now()，避免各模块混用 Date.now() 与 db.serverDate() 导致口径不一致。
 */
const cloud = require('wx-server-sdk')

let db = null

/** 取数据库句柄（懒加载并缓存：云函数实例复用期间只取一次） */
function getDb() {
  if (!db) db = cloud.database()
  return db
}

/** 取集合句柄 */
function collection(name) {
  return getDb().collection(name)
}

/**
 * 服务端时间戳（毫秒）。
 * 云函数运行在服务端，取本机时间即可，不受客户端时间影响。
 */
function now() {
  return Date.now()
}

/**
 * 唯一索引冲突判定。
 *
 * 云开发以 errCode=-502005 抛出重复键错误，不同基础库/版本下也可能只带 E11000 文案，
 * 这里两种都认：避免并发建档时漏判，把正常的并发请求当成失败抛给客户端。
 */
function isDuplicateError(err) {
  if (!err) return false
  if (err.errCode === -502005) return true
  const text = `${err.errMsg || ''} ${err.message || ''}`
  return /E11000|duplicate/i.test(text)
}

module.exports = { getDb, collection, now, isDuplicateError }
