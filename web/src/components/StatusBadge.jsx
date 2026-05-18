const STATUS_MAP = {
  DRAFT: '未启动',
  INIT: '初始化中',
  SCHEMA_MIGRATE: 'Schema 迁移中',
  FULL_SYNC: '全量同步中',
  CDC_SYNC: '增量同步中',
  VERIFYING: '校验中',
  PAUSED: '已暂停',
  COMPLETED: '已完成',
  ERROR: '错误',
}

export default function StatusBadge({ status }) {
  const cls = `badge badge-${status.toLowerCase()}`
  return <span className={cls}>{STATUS_MAP[status] || status}</span>
}
