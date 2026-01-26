import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Register Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[SW] Service worker registered:', registration.scope);
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // Check every hour
      })
      .catch((error) => {
        console.warn('[SW] Service worker registration failed:', error);
      });
  });
}

// Request notification permission
async function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    try {
      const permission = await Notification.requestPermission();
      console.log('[Notification] Permission:', permission);
    } catch (error) {
      console.warn('[Notification] Error requesting permission:', error);
    }
  }
}

// Request permission after user interaction
document.addEventListener('click', () => {
  requestNotificationPermission();
}, { once: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
