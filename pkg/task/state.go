package task

import (
	"encoding/json"
	"time"

	"github.com/hangyuyang/dbmigrate/pkg/plugin"
)

// Status 任务状态
type Status string

const (
	StatusDraft    Status = "DRAFT"
	StatusInit     Status = "INIT"
	StatusSchema   Status = "SCHEMA_MIGRATE"
	StatusFullSync Status = "FULL_SYNC"
	StatusCDCSync  Status = "CDC_SYNC"
	StatusVerifying Status = "VERIFYING"
	StatusPaused   Status = "PAUSED"
	StatusCompleted Status = "COMPLETED"
	StatusError    Status = "ERROR"
)

// Task 迁移任务定义
type Task struct {
	ID          string              `json:"id"`
	Name        string              `json:"name"`
	Status      Status              `json:"status"`
	Source      plugin.ConnectionConfig `json:"source"`
	Target      plugin.ConnectionConfig `json:"target"`
	Filter      plugin.TableFilter  `json:"filter"`
	Mode        string              `json:"mode"` // full, full+cdc, cdc-only, schema-only
	ChunkSize   int64               `json:"chunk_size"`
	Parallel    int                 `json:"parallel"`
	Progress    Progress            `json:"progress"`
	Error       string              `json:"error,omitempty"`
	CreatedAt   time.Time           `json:"created_at"`
	UpdatedAt   time.Time           `json:"updated_at"`
}

// Progress 任务进度
type Progress struct {
	TotalTables   int   `json:"total_tables"`
	DoneTables    int   `json:"done_tables"`
	TotalRows     int64 `json:"total_rows"`
	DoneRows      int64 `json:"done_rows"`
	TotalBytes    int64 `json:"total_bytes"`
	DoneBytes     int64 `json:"done_bytes"`
	CDCInserted   int64 `json:"cdc_inserted"`
	CDCUpdated    int64 `json:"cdc_updated"`
	CDCDeleted    int64 `json:"cdc_deleted"`
	CDCLagSeconds int   `json:"cdc_lag_seconds"`
}

// ToJSON 序列化为 JSON
func (t *Task) ToJSON() ([]byte, error) {
	return json.Marshal(t)
}

// FromJSON 从 JSON 反序列化
func FromJSON(data []byte) (*Task, error) {
	var t Task
	if err := json.Unmarshal(data, &t); err != nil {
		return nil, err
	}
	return &t, nil
}
