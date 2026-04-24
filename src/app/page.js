import Hero from '@/components/Hero/Hero';
import MovieCarousel from '@/components/MovieCarousel/MovieCarousel';
import RecentWatchedSection from '@/components/RecentWatchedSection/RecentWatchedSection';
import { getMovieCatalog } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const catalog = await getMovieCatalog();
  const featuredMovie = catalog.featuredMovie;
  const homeCategories = catalog.categoryMenu.slice(0, 4);

  return (
    <>
      <Hero featuredMovie={featuredMovie} />

      <RecentWatchedSection />
      
      {catalog.trendingMovies.length > 0 && (
        <MovieCarousel title="🔥 Mới cập nhật" movies={catalog.trendingMovies} />
      )}

      {homeCategories.map(category => {
        const categoryData = catalog.getCategoryBySlug(category.slug);
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
          Xem phim, tóm tắt phim tu tiên, xuyên không chất lượng cao.
          Không xem thì thôi, xem là nghiện. Đừng chửi AD, hãy chửi thằng làm phim!
        </p>
        <p style={{ marginTop: '40px', fontSize: '0.9rem', color: '#555' }}>
          © 2026 Nền tảng xem phim Meme số 1 Việt Nam.
        </p>
      </footer>
    </>
  );
}
