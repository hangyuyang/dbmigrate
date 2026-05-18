package plugin

import (
	"fmt"
	"sync"
)

// Registry 插件注册中心
type Registry struct {
	mu      sync.RWMutex
	sources map[string]SourcePlugin
	targets map[string]TargetPlugin
}

// NewRegistry 创建注册中心
func NewRegistry() *Registry {
	return &Registry{
		sources: make(map[string]SourcePlugin),
		targets: make(map[string]TargetPlugin),
	}
}

// RegisterSource 注册源端插件
func (r *Registry) RegisterSource(p SourcePlugin) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.sources[p.Name()] = p
}

// RegisterTarget 注册目标端插件
func (r *Registry) RegisterTarget(p TargetPlugin) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.targets[p.Name()] = p
}

// GetSource 获取源端插件
func (r *Registry) GetSource(name string) (SourcePlugin, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.sources[name]
	if !ok {
		return nil, fmt.Errorf("source plugin %q not found", name)
	}
	return p, nil
}

// GetTarget 获取目标端插件
func (r *Registry) GetTarget(name string) (TargetPlugin, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.targets[name]
	if !ok {
		return nil, fmt.Errorf("target plugin %q not found", name)
	}
	return p, nil
}

// ListSources 列出所有源端插件
func (r *Registry) ListSources() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	names := make([]string, 0, len(r.sources))
	for n := range r.sources {
		names = append(names, n)
	}
	return names
}

// ListTargets 列出所有目标端插件
func (r *Registry) ListTargets() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	names := make([]string, 0, len(r.targets))
	for n := range r.targets {
		names = append(names, n)
	}
	return names
}
