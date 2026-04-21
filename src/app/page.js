import Hero from '@/components/Hero/Hero';
import MovieCarousel from '@/components/MovieCarousel/MovieCarousel';
import { 
  allMovies,
  haNhanMovies,
  trendingMovies, 
  categoryMenu,
  getCategoryBySlug,
} from '@/lib/data';

export default function Home() {
  const featuredMovie = haNhanMovies[0] || allMovies[0] || null;
  const homeCategories = categoryMenu.slice(0, 4);

  return (
    <>
      <Hero featuredMovie={featuredMovie} />
      
      {trendingMovies.length > 0 && (
        <MovieCarousel title="🔥 Mới cập nhật" movies={trendingMovies} />
      )}

      {homeCategories.map(category => {
        const categoryData = getCategoryBySlug(category.slug);
        if (!categoryData || categoryData.movies.length === 0) return null;

        return (
          <MovieCarousel
            key={category.slug}
            title={`🏷️ ${category.tag}`}
            movies={categoryData.movies.slice(0, 20)}
          />
        );
      })}

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
