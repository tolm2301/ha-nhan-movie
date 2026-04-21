import Hero from '@/components/Hero/Hero';
import MovieCarousel from '@/components/MovieCarousel/MovieCarousel';
import { trendingMovies, newReleases } from '@/lib/data';

export default function Home() {
  return (
    <>
      <Hero />
      <MovieCarousel title="Thịnh Hành Gần Đây" movies={trendingMovies} />
      <MovieCarousel title="Hoạt Hình 3D Mới Cập Nhật" movies={newReleases} />

      {/* Footer minimal padding */}
      <footer style={{ textAlign: 'center', padding: '60px 20px', color: '#A0A0A5', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <p>© 2026 Hà Nhân Movie. Nền tảng xem phim tu tiên đỉnh cao.</p>
      </footer>
    </>
  );
}
