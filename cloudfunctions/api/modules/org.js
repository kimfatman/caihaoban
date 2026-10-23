/**
 * 机构与成员域（占位）。
 *
 * 接入方式：在此导出与 action 第二段同名的方法（list / detail / addMember / updateMember /
 * removeMember 等）。权限二次校验放在这里：读取 members 集合后用 _shared/auth.js 的矩阵重新判定，
 * 不信任客户端传入的任何角色与权限字段。
 */
module.exports = {}
