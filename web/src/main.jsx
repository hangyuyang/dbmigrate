import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import TaskList from './pages/TaskList'
import TaskCreate from './pages/TaskCreate'
import TaskDetail from './pages/TaskDetail'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<TaskList />} />
          <Route path="create" element={<TaskCreate />} />
          <Route path="tasks/:id" element={<TaskDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
