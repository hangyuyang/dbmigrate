import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import TaskList from './pages/TaskList'
import TaskCreate from './pages/TaskCreate'
import TaskDetail from './pages/TaskDetail'
import DataVerify from './pages/DataVerify'
import DataSources from './pages/DataSources'
import Monitor from './pages/Monitor'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route index element={<TaskList />} />
          <Route path="create" element={<TaskCreate />} />
          <Route path="tasks/:id" element={<TaskDetail />} />
          <Route path="verify" element={<DataVerify />} />
          <Route path="datasources" element={<DataSources />} />
          <Route path="monitor" element={<Monitor />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
