"use client";
import { useEffect, useRef } from 'react';
import styles from './AdSlot.module.css';
import { getAdsenseClientId, getAdsenseSlotId, isAdsensePlacementEnabled } from '@/lib/adsense';

export default function AdSlot({ placement, label = 'Quảng cáo', minHeight = 250, className = '' }) {
  const adRef = useRef(null);
  const pushedRef = useRef(false);
  const clientId = getAdsenseClientId();
  const slotId = getAdsenseSlotId(placement);
  const isEnabled = isAdsensePlacementEnabled(placement);

  useEffect(() => {
    if (!isEnabled || pushedRef.current || !adRef.current || typeof window === 'undefined') {
      return;
    }

    window.adsbygoogle = window.adsbygoogle || [];

    try {
      window.adsbygoogle.push({});
      pushedRef.current = true;
    } catch {
      // Keep the slot harmless if AdSense is unavailable.
    }
  }, [isEnabled]);

  if (!isEnabled) return null;

  return (
    <aside
      className={`${styles.slot} ${className}`.trim()}
      aria-label={label}
      role="complementary"
      style={{ '--ad-min-height': `${minHeight}px` }}
    >
      <div className={styles.card}>
        <div className={styles.labelRow}>
          <span className={styles.label}>{label}</span>
        </div>

        <div className={styles.frame}>
          <ins
            ref={adRef}
            className={`adsbygoogle ${styles.ins}`}
            style={{ display: 'block' }}
            data-ad-client={clientId}
            data-ad-slot={slotId}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      </div>
    </aside>
  )
}
