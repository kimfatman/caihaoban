/**
 * 权限矩阵（云函数版本，与 utils/auth.js 同源）。
 *
 * 这里只保留「不依赖成员数据」的纯部分：权限清单、角色 → 权限映射、角色是否允许某权限。
 * 依赖 members 集合的判断（can / memberships / orgIdsOf / isVerified / displayName 等）
 * 由 modules/org.js 在读取数据库后基于本文件的矩阵重新实现，不得在本文件里伪造数据，
 * 也不得信任客户端传入的角色与权限字段。
 */
const PERMISSIONS = {
  'task:publish': '发布/编辑任务',
  'task:manage': '管理任务（编辑、取消）',
  'quote:create': '提交报价',
  'quote:manage': '管理本机构报价',
  'quote:accept': '确认成交（接受报价）',
  'order:manage': '订单进度与凭证维护',
  'order:accept': '订单验收',
  'fee:change': '申请费用变更',
  'fee:declare': '收付款申报',
  'fee:confirm': '确认费用变更/收付款',
  'dispute:apply': '发起争议',
  'member:manage': '成员管理',
}

const ROLE_PERMISSIONS = {
  owner: Object.keys(PERMISSIONS),
  admin: [
    'task:publish',
    'task:manage',
    'quote:create',
    'quote:manage',
    'quote:accept',
    'order:manage',
    'order:accept',
    'fee:change',
    'fee:declare',
    'fee:confirm',
    'dispute:apply',
  ],
  member: ['task:publish', 'quote:create', 'order:manage', 'fee:declare', 'dispute:apply'],
}

/** 角色是否具备某项权限：集合接入后，先在数据库里确认成员身份，再调用本函数 */
function roleAllows(role, permission) {
  return (ROLE_PERMISSIONS[role] || []).includes(permission)
}

function permissionsOf(role) {
  return ROLE_PERMISSIONS[role] || []
}

module.exports = { PERMISSIONS, ROLE_PERMISSIONS, roleAllows, permissionsOf }
