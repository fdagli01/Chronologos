import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import './visual.css'
import './library/archive-dialogs.css'
import './library/note-editor.css'
import './library/archive-feedback.css'
import './i18n/i18n.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
