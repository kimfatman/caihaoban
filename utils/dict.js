/** 业务字典：集中维护枚举文案，避免各页面散落硬编码 */

/**
 * 业务类型：任务发布、接单人服务档案、订单快照共用同一份枚举。
 * 新增项只做追加，历史任务的 serviceType 值保持不变。
 */
const serviceTypes = [
  { value: 'registration', label: '工商注册' },
  { value: 'accounting', label: '代理记账' },
  { value: 'bookkeeping', label: '乱账清理' },
  { value: 'tax', label: '税务申报' },
  { value: 'compliance', label: '财税合规' },
  { value: 'audit', label: '审计验资' },
  { value: 'audit_assist', label: '审计协助' },
  { value: 'license', label: '资质许可' },
  { value: 'annual', label: '年报公示' },
  { value: 'liquidation', label: '注销清算' },
  { value: 'hard_liquidation', label: '疑难注销' },
  { value: 'outsourcing', label: '财务外包' },
  { value: 'other', label: '其他服务' },
]

/**
 * 全国行政区划（省 / 市两级）。
 * short 为省份简称，用于两级选择器的窄列展示；
 * 直辖市与特别行政区首项保留省级同名条目，代表「全市」范围，
 * 与历史 task.region（如 北京市/北京市/朝阳区）保持可匹配。
 */
const regions = [
  { name: '北京市', short: '北京', cities: ['北京市', '朝阳区', '海淀区', '东城区', '西城区', '丰台区', '通州区', '昌平区', '大兴区', '顺义区', '石景山区', '房山区', '门头沟区', '平谷区', '怀柔区'] },
  { name: '天津市', short: '天津', cities: ['天津市', '滨海新区', '和平区', '河西区', '南开区', '河东区', '河北区', '红桥区', '西青区', '津南区', '北辰区', '武清区', '宝坻区', '静海区', '宁河区', '蓟州区'] },
  { name: '上海市', short: '上海', cities: ['上海市', '浦东新区', '黄浦区', '徐汇区', '静安区', '长宁区', '普陀区', '虹口区', '杨浦区', '闵行区', '宝山区', '嘉定区', '松江区', '青浦区', '奉贤区', '金山区'] },
  { name: '重庆市', short: '重庆', cities: ['重庆市', '两江新区', '渝中区', '江北区', '南岸区', '九龙坡区', '沙坪坝区', '渝北区', '大渡口区', '北碚区', '巴南区', '涪陵区', '永川区', '万州区'] },
  { name: '河北省', short: '河北', cities: ['石家庄市', '唐山市', '保定市', '邯郸市', '秦皇岛市', '廊坊市', '沧州市', '邢台市', '张家口市', '承德市', '衡水市', '雄安新区'] },
  { name: '山西省', short: '山西', cities: ['太原市', '大同市', '临汾市', '运城市', '长治市', '晋中市', '阳泉市', '朔州市', '晋城市', '忻州市', '吕梁市'] },
  { name: '内蒙古自治区', short: '内蒙古', cities: ['呼和浩特市', '包头市', '鄂尔多斯市', '赤峰市', '通辽市', '乌海市', '呼伦贝尔市', '巴彦淖尔市', '乌兰察布市', '锡林郭勒盟'] },
  { name: '辽宁省', short: '辽宁', cities: ['沈阳市', '大连市', '鞍山市', '抚顺市', '本溪市', '锦州市', '营口市', '盘锦市', '葫芦岛市', '丹东市', '辽阳市', '朝阳市', '阜新市', '铁岭市'] },
  { name: '吉林省', short: '吉林', cities: ['长春市', '吉林市', '四平市', '通化市', '白山市', '松原市', '白城市', '辽源市', '延吉市'] },
  { name: '黑龙江省', short: '黑龙江', cities: ['哈尔滨市', '大庆市', '齐齐哈尔市', '牡丹江市', '佳木斯市', '绥化市', '鸡西市', '伊春市', '双鸭山市', '七台河市', '鹤岗市', '黑河市'] },
  { name: '江苏省', short: '江苏', cities: ['南京市', '苏州市', '无锡市', '常州市', '南通市', '徐州市', '扬州市', '盐城市', '泰州市', '镇江市', '淮安市', '连云港市', '宿迁市'] },
  { name: '浙江省', short: '浙江', cities: ['杭州市', '宁波市', '温州市', '嘉兴市', '金华市', '绍兴市', '台州市', '湖州市', '衢州市', '丽水市', '舟山市'] },
  { name: '安徽省', short: '安徽', cities: ['合肥市', '芜湖市', '蚌埠市', '马鞍山市', '安庆市', '阜阳市', '六安市', '滁州市', '宿州市', '铜陵市', '淮南市', '淮北市', '黄山市'] },
  { name: '福建省', short: '福建', cities: ['福州市', '厦门市', '泉州市', '漳州市', '莆田市', '宁德市', '三明市', '龙岩市', '南平市'] },
  { name: '江西省', short: '江西', cities: ['南昌市', '赣州市', '九江市', '上饶市', '宜春市', '吉安市', '抚州市', '景德镇市', '萍乡市', '新余市', '鹰潭市'] },
  { name: '山东省', short: '山东', cities: ['济南市', '青岛市', '烟台市', '潍坊市', '淄博市', '济宁市', '临沂市', '泰安市', '威海市', '东营市', '枣庄市', '日照市', '德州市', '聊城市', '滨州市', '菏泽市'] },
  { name: '河南省', short: '河南', cities: ['郑州市', '洛阳市', '开封市', '南阳市', '新乡市', '许昌市', '焦作市', '安阳市', '商丘市', '信阳市', '周口市', '驻马店市', '平顶山市', '濮阳市', '漯河市', '三门峡市'] },
  { name: '湖北省', short: '湖北', cities: ['武汉市', '宜昌市', '襄阳市', '荆州市', '黄石市', '十堰市', '孝感市', '荆门市', '黄冈市', '咸宁市', '随州市', '鄂州市'] },
  { name: '湖南省', short: '湖南', cities: ['长沙市', '株洲市', '湘潭市', '衡阳市', '岳阳市', '常德市', '郴州市', '邵阳市', '益阳市', '永州市', '怀化市', '娄底市', '张家界市'] },
  { name: '广东省', short: '广东', cities: ['广州市', '深圳市', '东莞市', '佛山市', '珠海市', '中山市', '惠州市', '汕头市', '江门市', '湛江市', '茂名市', '清远市', '肇庆市', '梅州市', '揭阳市', '潮州市'] },
  { name: '广西壮族自治区', short: '广西', cities: ['南宁市', '桂林市', '柳州市', '北海市', '玉林市', '钦州市', '梧州市', '防城港市', '贵港市', '百色市', '河池市', '来宾市', '崇左市'] },
  { name: '海南省', short: '海南', cities: ['海口市', '三亚市', '儋州市', '琼海市', '文昌市', '万宁市', '东方市', '澄迈县'] },
  { name: '四川省', short: '四川', cities: ['成都市', '绵阳市', '德阳市', '宜宾市', '南充市', '泸州市', '达州市', '乐山市', '自贡市', '遂宁市', '内江市', '攀枝花市', '广元市', '眉山市', '资阳市', '广安市'] },
  { name: '贵州省', short: '贵州', cities: ['贵阳市', '遵义市', '六盘水市', '安顺市', '毕节市', '铜仁市', '凯里市', '都匀市', '兴义市'] },
  { name: '云南省', short: '云南', cities: ['昆明市', '曲靖市', '玉溪市', '大理市', '丽江市', '楚雄市', '蒙自市', '文山市', '昭通市', '普洱市', '西双版纳'] },
  { name: '西藏自治区', short: '西藏', cities: ['拉萨市', '日喀则市', '林芝市', '昌都市', '山南市', '那曲市'] },
  { name: '陕西省', short: '陕西', cities: ['西安市', '宝鸡市', '咸阳市', '渭南市', '汉中市', '榆林市', '延安市', '铜川市', '安康市', '商洛市'] },
  { name: '甘肃省', short: '甘肃', cities: ['兰州市', '天水市', '白银市', '金昌市', '酒泉市', '张掖市', '庆阳市', '平凉市', '武威市', '定西市', '陇南市'] },
  { name: '青海省', short: '青海', cities: ['西宁市', '海东市', '格尔木市', '玉树市', '德令哈市'] },
  { name: '宁夏回族自治区', short: '宁夏', cities: ['银川市', '石嘴山市', '吴忠市', '固原市', '中卫市'] },
  { name: '新疆维吾尔自治区', short: '新疆', cities: ['乌鲁木齐市', '克拉玛依市', '喀什市', '伊宁市', '昌吉市', '阿克苏市', '哈密市', '库尔勒市', '石河子市', '吐鲁番市'] },
  { name: '台湾省', short: '台湾', cities: ['台北市', '新北市', '高雄市', '台中市', '台南市', '桃园市', '新竹市', '基隆市'] },
  { name: '香港特别行政区', short: '香港', cities: ['香港特别行政区', '香港岛', '九龙', '新界'] },
  { name: '澳门特别行政区', short: '澳门', cities: ['澳门特别行政区', '澳门半岛', '氹仔', '路环'] },
]

/** 大厅地区筛选的快捷入口 */
const hotCities = [
  '北京市',
  '上海市',
  '广州市',
  '深圳市',
  '杭州市',
  '成都市',
  '南京市',
  '武汉市',
  '苏州市',
  '重庆市',
]

/** 任务状态：open 报价中 / dealing 已成交 / closed 已关闭 / cancelled 已取消 / expired 已过期 */
const taskStatus = [
  { value: 'open', label: '报价中', tag: 'tag-primary' },
  { value: 'dealing', label: '已成交', tag: 'tag-success' },
  { value: 'closed', label: '已关闭', tag: 'tag-plain' },
  { value: 'cancelled', label: '已取消', tag: 'tag-plain' },
  { value: 'expired', label: '已过期', tag: 'tag-warn' },
]

const orderStatus = [
  { value: 'pending_start', label: '待开始', tag: 'tag-primary' },
  { value: 'in_progress', label: '进行中', tag: 'tag-primary' },
  { value: 'pending_acceptance', label: '待验收', tag: 'tag-warn' },
  { value: 'completed', label: '已完成', tag: 'tag-success' },
  { value: 'cancelled', label: '已取消', tag: 'tag-plain' },
  { value: 'disputing', label: '争议中', tag: 'tag-danger' },
]

const quoteStatus = [
  { value: 'pending', label: '待处理', tag: 'tag-primary' },
  { value: 'accepted', label: '已成交', tag: 'tag-success' },
  { value: 'invalid', label: '已失效', tag: 'tag-plain' },
  { value: 'withdrawn', label: '已撤回', tag: 'tag-plain' },
]

const topicCategories = [
  { value: 'business', label: '业务经验' },
  { value: 'help', label: '疑难求助' },
  { value: 'local', label: '地方办事经验' },
  { value: 'operation', label: '机构经营' },
  { value: 'cooperation', label: '同行合作' },
]

const messageTypes = [
  { value: 'all', label: '全部' },
  { value: 'quote', label: '报价' },
  { value: 'order', label: '订单' },
  { value: 'fee', label: '费用' },
  { value: 'community', label: '社区' },
  { value: 'system', label: '系统' },
]

const reportReasons = [
  '包含客户敏感信息（名称/证件/财务资料）',
  '广告推广或引流内容',
  '虚假或误导性信息',
  '人身攻击、辱骂',
  '侵犯他人权益',
  '其他违规内容',
]

const memberRoles = [
  { value: 'owner', label: '负责人' },
  { value: 'admin', label: '管理员' },
  { value: 'member', label: '成员' },
]

/* ---------------- 接单人服务能力档案 ---------------- */

/** 服务方式；online 不能无条件替代现场办理，匹配逻辑见 utils/recommend.js */
const serviceModes = [
  { value: 'online', label: '线上服务' },
  { value: 'onsite', label: '线下服务' },
  { value: 'both', label: '线上线下均可' },
]

/** 接单状态：paused 会被推荐硬条件直接排除 */
const providerStatus = [
  { value: 'accepting', label: '正常接单' },
  { value: 'paused', label: '暂不接单' },
]

/** 月度接单能力；max 为该档位上限，用于计算在途订单负载 */
const monthlyCapacity = [
  { value: '1-4', label: '1—4 单', max: 4 },
  { value: '5-10', label: '5—10 单', max: 10 },
  { value: '10+', label: '10 单以上', max: 30 },
]

/** 报价方式 */
const quoteModes = [
  { value: 'negotiable', label: '面议' },
  { value: 'project', label: '按项目报价' },
  { value: 'fixed', label: '固定报价' },
]

/** 服务资质：任务 requiredQualifications 与档案 qualifications 共用 */
const qualifications = [
  { value: 'agency', label: '代理记账许可' },
  { value: 'cpa', label: '会计师事务所执业资质' },
  { value: 'taa', label: '税务师事务所资质' },
  { value: 'law', label: '法律服务资质' },
]

/** 「为我推荐」排序方式 */
const recommendSorts = [
  { value: 'best', label: '最匹配' },
  { value: 'latest', label: '最新发布' },
  { value: 'budget', label: '预算优先' },
]

/* ---------------- 公告牌 ---------------- */

/** 公告分类：业务合作 / 服务推广 / 资源对接 */
const noticeCategories = [
  { value: 'cooperation', label: '业务合作' },
  { value: 'promotion', label: '服务推广' },
  { value: 'resource', label: '资源对接' },
]

/**
 * 公告状态机：
 *   pending（待审核）→ approved（已通过）→ expired（已过期）
 *                    ↘ rejected（已拒绝）
 *   approved / pending → offline（已下架）
 * 只有 approved 且在展示期内才进入公开列表。
 */
const noticeStatus = [
  { value: 'pending', label: '待审核', tag: 'tag-warn' },
  { value: 'approved', label: '展示中', tag: 'tag-success' },
  { value: 'rejected', label: '未通过', tag: 'tag-danger' },
  { value: 'offline', label: '已下架', tag: 'tag-plain' },
  { value: 'expired', label: '已过期', tag: 'tag-plain' },
]

/**
 * 公告套餐：价格与有效期的唯一配置源（api / 页面均从此处读取，禁止另写常量）。
 * priority 越大排序越靠前；free 不参与付费优先。
 * demoOnly=true 表示当前仅演示下单流程，未接入真实支付。
 */
const noticePackages = [
  {
    value: 'free',
    label: '普通公告',
    description: '按发布时间展示，不参与付费优先排序',
    price: 0,
    days: 7,
    priority: 0,
    badge: '',
  },
  {
    value: 'top',
    label: '置顶公告',
    description: '展示期内固定在列表顶部',
    price: 9.9,
    days: 7,
    priority: 2,
    badge: '置顶',
    tag: 'tag-warn',
  },
  {
    value: 'featured',
    label: '精选推广',
    description: '在置顶之后优先展示，并带推广标识',
    price: 29.9,
    days: 7,
    priority: 1,
    badge: '推广',
    tag: 'tag-primary',
  },
]

/** 公告默认展示天数（普通公告） */
const noticeFreeDays = 7

/** 待审核 / 拒绝 / 下架的公告不进入公开列表 */
const noticePublicStatus = 'approved'

const labelOf = (list, value, fallback = '-') => {
  const hit = list.find((item) => item.value === value)
  return hit ? hit.label : fallback
}

const tagOf = (list, value) => {
  const hit = list.find((item) => item.value === value)
  return hit ? hit.tag : 'tag-plain'
}

module.exports = {
  serviceTypes,
  regions,
  hotCities,
  taskStatus,
  orderStatus,
  quoteStatus,
  topicCategories,
  messageTypes,
  reportReasons,
  memberRoles,
  serviceModes,
  providerStatus,
  monthlyCapacity,
  quoteModes,
  qualifications,
  recommendSorts,
  noticeCategories,
  noticeStatus,
  noticePackages,
  noticeFreeDays,
  noticePublicStatus,
  labelOf,
  tagOf,
}
