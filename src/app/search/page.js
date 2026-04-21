import { Suspense } from 'react';
import SearchContent from './SearchContent';

export default function SearchPage() {
  return (
    <Suspense fallback={
      <main style={{ padding: '100px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>Đang tìm kiếm...</p>
      </main>
    }>
      <SearchContent />
    </Suspense>
  );
}
