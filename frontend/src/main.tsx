import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="bottom-left"
      toastOptions={{
        style: {
          background: '#1a1e2a',
          color: '#f0f4ff',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '10px',
          fontSize: '13px',
        },
        success: { iconTheme: { primary: '#34d399', secondary: '#1a1e2a' } },
        error: { iconTheme: { primary: '#f87171', secondary: '#1a1e2a' } },
      }}
    />
  </React.StrictMode>
)
