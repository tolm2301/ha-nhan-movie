"use client";
import { useEffect, useState } from 'react';
import { cleanupWatchedHistory } from '@/lib/watchHistory';

export default function RecentWatchedSectionLazy() {
  const [Section, setSection] = useState(null);

  useEffect(() => {
    const cleanedHistory = cleanupWatchedHistory();
    if (cleanedHistory.length === 0) {
      return undefined;
    }

    let active = true;

    import('./RecentWatchedSection').then(module => {
      if (active) {
        setSection(() => module.default);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  if (!Section) return null;

  return <Section />;
}
