package task

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
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

// JSONStore JSON 文件存储
type JSONStore struct {
	mu   sync.RWMutex
	dir  string
}

// NewJSONStore 创建 JSON 文件存储
func NewJSONStore(dir string) (*JSONStore, error) {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}
	return &JSONStore{dir: dir}, nil
}

func taskPath(dir, id string) string {
	return filepath.Join(dir, id+".json")
}

func (s *JSONStore) Create(task *Task) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	task.CreatedAt = now
	task.UpdatedAt = now
	task.Progress = Progress{}

	data, err := json.MarshalIndent(task, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(taskPath(s.dir, task.ID), data, 0644)
}

func (s *JSONStore) Get(id string) (*Task, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data, err := os.ReadFile(taskPath(s.dir, id))
	if err != nil {
		return nil, fmt.Errorf("task not found: %s", id)
	}
	return FromJSON(data)
}

func (s *JSONStore) List() ([]*Task, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	entries, err := os.ReadDir(s.dir)
	if err != nil {
		return nil, err
	}

	var tasks []*Task
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(s.dir, e.Name()))
		if err != nil {
			continue
		}
		task, err := FromJSON(data)
		if err != nil {
			continue
		}
		tasks = append(tasks, task)
	}
	return tasks, nil
}

func (s *JSONStore) Update(task *Task) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	task.UpdatedAt = time.Now()
	data, err := json.MarshalIndent(task, "", "  ")
	if err != nil {
		return err
	}

	path := taskPath(s.dir, task.ID)
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return fmt.Errorf("task not found: %s", task.ID)
	}

	return os.WriteFile(path, data, 0644)
}

func (s *JSONStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	path := taskPath(s.dir, id)
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return fmt.Errorf("task not found: %s", id)
	}
	return os.Remove(path)
}

func (s *JSONStore) Close() error {
	return nil
}
