-- ============================================================
-- 001 接单人智能推荐 · 结构变更（UP）
-- 目标库：PostgreSQL 12+
--
-- 背景：当前小程序为纯前端 Mock，数据存放在 utils/store.js 的内存数组，
--       utils/api.js 充当接口层。本脚本面向「接入真实数据库」时的
--       一次性结构变更，字段与 utils/recommend.js / utils/api.js 完全对应。
--
-- 执行步骤：
--   1) 备份：pg_dump -t tasks -t users <db> > backup_tasks_users.sql
--   2) 执行：psql -h <host> -U <user> -d <db> -v ON_ERROR_STOP=1 -f migrations/001_service_profile.up.sql
--   3) 校验：\d+ service_profiles  与  \d+ recommend_events
--   4) 回滚：psql -h <host> -U <user> -d <db> -v ON_ERROR_STOP=1 -f migrations/001_service_profile.down.sql
--
-- 影响面：
--   - 仅新增 2 张表 + 给 tasks 增加 2 个可空/带默认值的列；
--   - 不修改、不删除任何既有任务、报价、订单、会话数据；
--   - tasks 新增列均可为空，旧数据无需回填，线上读逻辑对 NULL 已做兼容。
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. 接单人服务能力档案（与 users 一对一）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_profiles (
  id                  VARCHAR(32)  PRIMARY KEY,
  user_id             VARCHAR(32)  NOT NULL,
  -- 擅长业务：storage 中为业务枚举值数组，取值见 utils/dict.js serviceTypes
  business_types      JSONB        NOT NULL DEFAULT '[]'::jsonb,
  -- 可服务地区：[{ "province": "北京市", "city": "" }]，city 为空串表示全省/全市
  areas               JSONB        NOT NULL DEFAULT '[]'::jsonb,
  service_mode        VARCHAR(16)  NOT NULL,
  order_status        VARCHAR(16)  NOT NULL DEFAULT 'accepting',
  monthly_capacity    VARCHAR(16)  NOT NULL,
  quote_mode          VARCHAR(16)  NOT NULL,
  qualifications      JSONB        NOT NULL DEFAULT '[]'::jsonb,
  years_of_experience SMALLINT     NOT NULL DEFAULT 0,
  intro               VARCHAR(300) NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- 一个用户只能有一份档案，接口层也据此做「只能改自己」的校验
  CONSTRAINT uq_service_profiles_user UNIQUE (user_id),

  -- 与 utils/dict.js 枚举保持一致，避免前后端枚举漂移写入脏数据
  CONSTRAINT ck_service_profiles_mode
    CHECK (service_mode IN ('online', 'onsite', 'both')),
  CONSTRAINT ck_service_profiles_status
    CHECK (order_status IN ('accepting', 'paused')),
  CONSTRAINT ck_service_profiles_capacity
    CHECK (monthly_capacity IN ('1-4', '5-10', '10+')),
  CONSTRAINT ck_service_profiles_quote
    CHECK (quote_mode IN ('negotiable', 'project', 'fixed')),

  CONSTRAINT ck_service_profiles_years
    CHECK (years_of_experience BETWEEN 0 AND 50),
  CONSTRAINT ck_service_profiles_intro_len
    CHECK (char_length(intro) <= 300),
  CONSTRAINT ck_service_profiles_business_types
    CHECK (jsonb_typeof(business_types) = 'array'
       AND jsonb_array_length(business_types) BETWEEN 1 AND 13),
  CONSTRAINT ck_service_profiles_areas
    CHECK (jsonb_typeof(areas) = 'array'
       AND jsonb_array_length(areas) BETWEEN 1 AND 20)
);

-- 若 users 表存在，建议补上外键（账号注销时级联清理档案）
-- ALTER TABLE service_profiles
--   ADD CONSTRAINT fk_service_profiles_user
--   FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

-- 推荐只查询「正常接单」的档案，用部分索引减少扫描
CREATE INDEX IF NOT EXISTS idx_service_profiles_accepting
  ON service_profiles (order_status)
  WHERE order_status = 'accepting';

-- 按擅长业务做包含查询（business_types @> '["accounting"]'）
CREATE INDEX IF NOT EXISTS idx_service_profiles_business_types
  ON service_profiles USING gin (business_types);

CREATE INDEX IF NOT EXISTS idx_service_profiles_areas
  ON service_profiles USING gin (areas);


-- ------------------------------------------------------------
-- 2. 推荐行为统计
--    记录真实发生的曝光 / 点击 / 邀请 / 报价 / 成交，
--    用于后续计算曝光点击率与转化率，不预置任何数据。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recommend_events (
  id             BIGSERIAL    PRIMARY KEY,
  kind           VARCHAR(16)  NOT NULL,
  scene          VARCHAR(16)  NOT NULL,
  task_id        VARCHAR(32),
  target_user_id VARCHAR(32),
  viewer_id      VARCHAR(32)  NOT NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT ck_recommend_events_kind
    CHECK (kind IN ('expose', 'click', 'invite', 'quote', 'order')),
  CONSTRAINT ck_recommend_events_scene
    CHECK (scene IN ('provider', 'task')),
  -- provider 场景必须有被推荐的接单人
  CONSTRAINT ck_recommend_events_target
    CHECK (scene <> 'provider' OR target_user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_recommend_events_created
  ON recommend_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recommend_events_task
  ON recommend_events (task_id, target_user_id, kind);

-- 同一任务对同一接单人的邀请只落一条，配合接口层的幂等实现
CREATE UNIQUE INDEX IF NOT EXISTS uq_recommend_events_invite
  ON recommend_events (task_id, target_user_id)
  WHERE kind = 'invite';


-- ------------------------------------------------------------
-- 3. 任务侧补充字段
-- ------------------------------------------------------------
-- 是否必须现场办理：NULL 表示未显式声明，由关键词推断（utils/recommend.js）
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS onsite_required BOOLEAN NULL;

-- 必要资质：服务者必须全部具备才可进入推荐名单
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS required_qualifications JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tasks_required_qualifications
  ON tasks USING gin (required_qualifications);

COMMIT;
