package task

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// Store 任务存储接口
type Store interface {
	Create(task *Task) error
	Get(id string) (*Task, error)
	List() ([]*Task, error)
	Update(task *Task) error
	Delete(id string) error
	Close() error
}

// SQLiteStore SQLite 实现
type SQLiteStore struct {
	db *sql.DB
}

// NewSQLiteStore 创建 SQLite 存储
func NewSQLiteStore(path string) (*SQLiteStore, error) {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS tasks (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'DRAFT',
		source TEXT NOT NULL,
		target TEXT NOT NULL,
		filter TEXT,
		mode TEXT NOT NULL DEFAULT 'full',
		chunk_size INTEGER DEFAULT 50000,
		parallel INTEGER DEFAULT 4,
		progress TEXT DEFAULT '{}',
		error_msg TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)
	if err != nil {
		return nil, fmt.Errorf("create table: %w", err)
	}

	return &SQLiteStore{db: db}, nil
}

func (s *SQLiteStore) Create(task *Task) error {
	now := time.Now()
	task.CreatedAt = now
	task.UpdatedAt = now

	sourceJSON, _ := json.Marshal(task.Source)
	targetJSON, _ := json.Marshal(task.Target)
	filterJSON, _ := json.Marshal(task.Filter)
	progressJSON, _ := json.Marshal(task.Progress)

	_, err := s.db.Exec(
		`INSERT INTO tasks (id, name, status, source, target, filter, mode, chunk_size, parallel, progress, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		task.ID, task.Name, task.Status, sourceJSON, targetJSON, filterJSON,
		task.Mode, task.ChunkSize, task.Parallel, progressJSON, task.CreatedAt, task.UpdatedAt,
	)
	return err
}

func (s *SQLiteStore) Get(id string) (*Task, error) {
	var (
		t                    Task
		sourceJSON, targetJSON, filterJSON, progressJSON string
	)

	err := s.db.QueryRow(
		`SELECT id, name, status, source, target, filter, mode, chunk_size, parallel, progress, error_msg, created_at, updated_at
		 FROM tasks WHERE id = ?`, id,
	).Scan(&t.ID, &t.Name, &t.Status, &sourceJSON, &targetJSON, &filterJSON,
		&t.Mode, &t.ChunkSize, &t.Parallel, &progressJSON, &t.Error, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}

	json.Unmarshal([]byte(sourceJSON), &t.Source)
	json.Unmarshal([]byte(targetJSON), &t.Target)
	json.Unmarshal([]byte(filterJSON), &t.Filter)
	json.Unmarshal([]byte(progressJSON), &t.Progress)

	return &t, nil
}

func (s *SQLiteStore) List() ([]*Task, error) {
	rows, err := s.db.Query(`SELECT id, name, status, source, target, filter, mode, chunk_size, parallel, progress, error_msg, created_at, updated_at FROM tasks ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*Task
	for rows.Next() {
		var t Task
		var sourceJSON, targetJSON, filterJSON, progressJSON string
		err := rows.Scan(&t.ID, &t.Name, &t.Status, &sourceJSON, &targetJSON, &filterJSON,
			&t.Mode, &t.ChunkSize, &t.Parallel, &progressJSON, &t.Error, &t.CreatedAt, &t.UpdatedAt)
		if err != nil {
			return nil, err
		}
		json.Unmarshal([]byte(sourceJSON), &t.Source)
		json.Unmarshal([]byte(targetJSON), &t.Target)
		json.Unmarshal([]byte(filterJSON), &t.Filter)
		json.Unmarshal([]byte(progressJSON), &t.Progress)
		tasks = append(tasks, &t)
	}
	return tasks, nil
}

func (s *SQLiteStore) Update(task *Task) error {
	task.UpdatedAt = time.Now()
	sourceJSON, _ := json.Marshal(task.Source)
	targetJSON, _ := json.Marshal(task.Target)
	filterJSON, _ := json.Marshal(task.Filter)
	progressJSON, _ := json.Marshal(task.Progress)

	_, err := s.db.Exec(
		`UPDATE tasks SET name=?, status=?, source=?, target=?, filter=?, mode=?, chunk_size=?, parallel=?, progress=?, error_msg=?, updated_at=? WHERE id=?`,
		task.Name, task.Status, sourceJSON, targetJSON, filterJSON,
		task.Mode, task.ChunkSize, task.Parallel, progressJSON, task.Error, task.UpdatedAt, task.ID,
	)
	return err
}

func (s *SQLiteStore) Delete(id string) error {
	_, err := s.db.Exec(`DELETE FROM tasks WHERE id = ?`, id)
	return err
}

func (s *SQLiteStore) Close() error {
	return s.db.Close()
}
