/**
 * 权限模型（前端镜像）。
 * 真实环境中以下判断全部在服务端执行，前端仅用于隐藏不可用入口，不作为安全边界。
 */
const store = require('./store')

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

function membership(userId, orgId) {
  return store.members.find((item) => item.userId === userId && item.orgId === orgId && item.status === 'active')
}

function permissionsIn(userId, orgId) {
  const member = membership(userId, orgId)
  if (!member) return []
  return ROLE_PERMISSIONS[member.role] || []
}

function can(orgId, userId, permission) {
  return permissionsIn(userId, orgId).includes(permission)
}

function canAnywhere(userId, permission) {
  return memberships(userId).some((item) => item.permissions.includes(permission))
}

function orgIdsOf(userId) {
  return store.members.filter((item) => item.userId === userId && item.status === 'active').map((item) => item.orgId)
}

function memberships(userId) {
  return store.members
    .filter((item) => item.userId === userId && item.status === 'active')
    .map((member) => {
      const org = store.orgs.find((item) => item.id === member.orgId)
      return {
        orgId: member.orgId,
        orgName: org ? org.name : '未知机构',
        orgShortName: org ? org.shortName : '',
        orgType: org ? org.type : 'enterprise',
        orgStatus: org ? org.status : 'pending',
        role: member.role,
        permissions: ROLE_PERMISSIONS[member.role] || [],
        memberId: member.id,
      }
    })
}

function isMember(userId, orgId) {
  return !!membership(userId, orgId)
}

function isVerified(userId) {
  const user = store.users.find((item) => item.id === userId)
  return !!(user && user.idVerified)
}

function displayName(userId) {
  const user = store.users.find((item) => item.id === userId)
  return user ? user.nickname : '未知用户'
}

function orgName(orgId) {
  const org = store.orgs.find((item) => item.id === orgId)
  return org ? org.name : ''
}

function visibleMembers(userId) {
  return memberships(userId).map((item) => {
    const list = store.members
      .filter((member) => member.orgId === item.orgId && member.status === 'active')
      .map((member) => {
        const user = store.users.find((u) => u.id === member.userId) || {}
        return {
          memberId: member.id,
          userId: member.userId,
          name: user.nickname || '成员',
          phone: user.phone || '',
          title: user.title || '',
          role: member.role,
          roleLabel: item.role === 'owner' ? '负责人' : item.role === 'admin' ? '管理员' : '成员',
          joinedAt: member.joinedAt,
          isSelf: member.userId === userId,
        }
      })
    return { ...item, members: list }
  })
}

module.exports = {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  membership,
  permissionsIn,
  can,
  canAnywhere,
  orgIdsOf,
  memberships,
  isMember,
  isVerified,
  displayName,
  orgName,
  visibleMembers,
}
