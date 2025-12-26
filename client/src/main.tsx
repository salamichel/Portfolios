import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AdminThemes } from './pages/AdminThemes.tsx'
import { BookList } from './pages/BookList.tsx'
import { BookEditor } from './pages/BookEditor.tsx'
import { TemplateEditor } from './pages/TemplateEditor.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/admin/themes" element={<AdminThemes />} />
        <Route path="/books" element={<BookList />} />
        <Route path="/books/:id" element={<BookEditor />} />
        <Route path="/templates" element={<TemplateEditor />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
