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
        
        // Handle service worker updates without automatic reload
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker is ready but waiting
                // Don't automatically reload - let user decide when to refresh
                console.log('[SW] New version available. Refresh the page to update.');
              }
            });
          }
        });
        
        // Check for updates periodically (every 6 hours)
        setInterval(() => {
          registration.update();
        }, 6 * 60 * 60 * 1000);
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
