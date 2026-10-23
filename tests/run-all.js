/**
 * 一键运行全部用例。
 * 运行：node tests/run-all.js
 *
 * 说明：Windows 的 PowerShell 不会展开通配符，直接执行 `node tests/*.test.js` 会报找不到模块，
 * 因此用本脚本依次执行 tests/ 下所有 *.test.js，任一失败则以非 0 退出。
 */
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const dir = __dirname
const files = fs
  .readdirSync(dir)
  .filter((name) => name.endsWith('.test.js'))
  .sort()

let total = 0
let failedCount = 0

files.forEach((name) => {
  const result = spawnSync(process.execPath, [path.join(dir, name)], { stdio: 'inherit' })
  if (result.status !== 0) failedCount += 1
  total += 1
})

console.log(`\n================ 共 ${total} 个测试文件，失败 ${failedCount} 个 ================`)
if (failedCount) process.exit(1)
