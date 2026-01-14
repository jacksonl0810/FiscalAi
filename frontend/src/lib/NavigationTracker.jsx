import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { pagesConfig } from '@/pages.config';

export default function NavigationTracker() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { Pages, mainPage } = pagesConfig;
  const mainPageKey = mainPage ?? Object.keys(Pages)[0];

  // Track page navigation for analytics (can be implemented with your backend)
  useEffect(() => {
    // Extract page name from pathname
    const pathname = location.pathname;
    let pageName;

    if (pathname === '/' || pathname === '') {
      pageName = mainPageKey;
    } else {
      // Remove leading slash and get the first segment
      const pathSegment = pathname.replace(/^\//, '').split('/')[0];

      // Try case-insensitive lookup in Pages config
      const pageKeys = Object.keys(Pages);
      const matchedKey = pageKeys.find(
        key => key.toLowerCase() === pathSegment.toLowerCase()
      );

      pageName = matchedKey || null;
    }

    // Log page view (can be sent to your analytics backend)
    if (isAuthenticated && pageName) {
      // You can implement your own analytics tracking here
      // Example: analyticsService.trackPageView(pageName);
      console.debug(`[Navigation] Page viewed: ${pageName}`);
    }
  }, [location, isAuthenticated, Pages, mainPageKey]);

  return null;
}
