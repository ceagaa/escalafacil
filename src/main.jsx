import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './assets/css/uicons.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { EventProvider } from './context/EventContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <EventProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </EventProvider>
  </StrictMode>,
)
