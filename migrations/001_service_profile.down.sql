-- ============================================================
-- 001 接单人智能推荐 · 结构变更（DOWN / 回滚）
-- 目标库：PostgreSQL 12+
--
-- 回滚影响：
--   - 删除 service_profiles、recommend_events 两张新增表及其全部数据；
--   - 删除 tasks.onsite_required 与 tasks.required_qualifications；
--   - 既有任务、报价、订单、会话数据不受影响。
--
-- 执行：psql -h <host> -U <user> -d <db> -v ON_ERROR_STOP=1 -f migrations/001_service_profile.down.sql
--
-- 注意：回滚会丢失用户已填写的服务能力档案与推荐行为统计，
--       执行前请先导出：
--       pg_dump -t service_profiles -t recommend_events <db> > backup_recommend.sql
-- ============================================================

BEGIN;

-- 先删索引所属的补充列，再删新增表，保证依赖顺序
DROP INDEX IF EXISTS idx_tasks_required_qualifications;
ALTER TABLE tasks DROP COLUMN IF EXISTS required_qualifications;
ALTER TABLE tasks DROP COLUMN IF EXISTS onsite_required;

DROP INDEX IF EXISTS uq_recommend_events_invite;
DROP INDEX IF EXISTS idx_recommend_events_task;
DROP INDEX IF EXISTS idx_recommend_events_created;
DROP TABLE IF EXISTS recommend_events;

DROP INDEX IF EXISTS idx_service_profiles_areas;
DROP INDEX IF EXISTS idx_service_profiles_business_types;
DROP INDEX IF EXISTS idx_service_profiles_accepting;
DROP TABLE IF EXISTS service_profiles;

COMMIT;
