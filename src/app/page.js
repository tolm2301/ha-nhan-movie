import Hero from '@/components/Hero/Hero';
import MovieCarousel from '@/components/MovieCarousel/MovieCarousel';
import { 
  allMovies,
  trendingMovies, 
  tienHiepMovies, 
  tauHaiMovies, 
  xuyenKhongMovies, 
  heThongMovies 
} from '@/lib/data';

export default function Home() {
  const featuredMovie = allMovies[0] || null;

  return (
    <>
      <Hero featuredMovie={featuredMovie} />
      
      {trendingMovies.length > 0 && (
        <MovieCarousel title="🔥 Trending Tấu Hài" movies={trendingMovies} />
      )}
      
      {tienHiepMovies.length > 0 && (
        <MovieCarousel title="🎬 Tiên Hiệp 3D" movies={tienHiepMovies} />
      )}
      
      {xuyenKhongMovies.length > 0 && (
        <MovieCarousel title="⚡ Xuyên Không Kỳ Truyện" movies={xuyenKhongMovies} />
      )}
      
      {tauHaiMovies.length > 0 && (
        <MovieCarousel title="🐼 Gấu Bựa Tấu Hài" movies={tauHaiMovies} />
      )}

      {heThongMovies.length > 0 && (
        <MovieCarousel title="🎮 Hệ Thống Vô Đối" movies={heThongMovies} />
      )}

      <footer style={{ 
        textAlign: 'center', 
        padding: '80px 20px', 
        background: '#000',
        borderTop: '5px solid #FFDE00'
      }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '10px' }}>HÀ NHÂN <span className="comic-text-yellow">MOVIE</span></h2>
        <p style={{ color: '#888', maxWidth: '600px', margin: '0 auto', fontSize: '1.1rem' }}>
          Xem phim bựa, tóm tắt phim tu tiên, xuyên không chất lượng cao. 
          Không xem thì thôi, xem là nghiện. Đừng chửi AD, hãy chửi thằng làm phim!
        </p>
        <p style={{ marginTop: '40px', fontSize: '0.9rem', color: '#555' }}>
          © 2026 Nền tảng xem phim Meme số 1 Việt Nam.
        </p>
      </footer>
    </>
  );
}
