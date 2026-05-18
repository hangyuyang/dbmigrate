package fullsync

import "log"

// Engine 全量同步引擎
type Engine struct{}

// NewEngine 创建全量同步引擎
func NewEngine(store interface{}) *Engine {
	return &Engine{}
}

// Stop 停止引擎
func (e *Engine) Stop() {
	log.Println("[FullSync Engine] stopped")
}
