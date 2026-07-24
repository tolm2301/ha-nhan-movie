'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    // 30 minutes in milliseconds
    const REFRESH_INTERVAL = 30 * 60 * 1000;
    
    const intervalId = setInterval(() => {
      // router.refresh() will do a soft refresh, fetching new Server Component payloads 
      // without losing client-side React state.
      router.refresh();
    }, REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, [router]);

  return null; // This component doesn't render anything
}