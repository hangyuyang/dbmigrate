const BASE_URL = '/api/v1';

async function request(url, options = {}) {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// Health
export function healthCheck() {
  return request('/health');
}

// Plugins
export function listPlugins() {
  return request('/plugins');
}

// Tasks
export function listTasks() {
  return request('/tasks');
}

export function getTask(id) {
  return request(`/tasks/${id}`);
}

export function createTask(data) {
  return request('/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteTask(id) {
  return request(`/tasks/${id}`, { method: 'DELETE' });
}

export function startTask(id) {
  return request(`/tasks/${id}/start`, { method: 'POST' });
}

export function pauseTask(id) {
  return request(`/tasks/${id}/pause`, { method: 'POST' });
}

export function resumeTask(id) {
  return request(`/tasks/${id}/resume`, { method: 'POST' });
}

export function stopTask(id) {
  return request(`/tasks/${id}/stop`, { method: 'POST' });
}

// Data sources
export function testConnection(config) {
  return request('/datasources/test', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

// Schema
export function previewSchema(data) {
  return request('/schema/preview', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
