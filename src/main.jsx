import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
//import App from './adminapp.jsx'

import './index.css'

// Mock globals voor lokale ontwikkeling als ze niet bestaan
if (typeof window.__firebase_config === 'undefined') {
  window.__firebase_config = JSON.stringify({
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_ID",
    appId: "YOUR_APP_ID"
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
