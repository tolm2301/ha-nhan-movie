import Hero from '@/components/Hero/Hero';
import MovieCarousel from '@/components/MovieCarousel/MovieCarousel';
import RecentWatchedSection from '@/components/RecentWatchedSection/RecentWatchedSectionLazy';
import AdSlot from '@/components/Adsense/AdSlot';
import { getMovieCatalog } from '@/lib/data';
import { getRenderableThumbnail } from '@/lib/thumbnailFilters';
import { buildMetadata, buildWebsiteJsonLd, toJsonLd } from '@/lib/seo';

export const revalidate = 3600;

export async function generateMetadata() {
  const catalog = await getMovieCatalog();
  const featuredTitle = catalog.featuredMovie?.displayTitle || catalog.featuredMovie?.title || 'phim mới cập nhật';

  return buildMetadata({
    title: 'Hanhan Movie / Hà Nhân | Xem phim mới cập nhật',
    description: `Hanhan Movie / Hà Nhân cập nhật ${featuredTitle} và các phim theo đúng danh mục hiện có.`,
    pathname: '/',
    image: catalog.featuredMovie ? getRenderableThumbnail(catalog.featuredMovie) : undefined,
  });
}

export default async function Home() {
  const catalog = await getMovieCatalog();
  const featuredMovie = catalog.featuredMovie;
  const homeCategories = catalog.categoryBuckets.filter(category => category.movies.length > 0);
  const websiteJsonLd = buildWebsiteJsonLd();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(websiteJsonLd) }} />
      <Hero featuredMovie={featuredMovie} />

      <RecentWatchedSection />
      
      {catalog.homeTrendingMovies.length > 0 && (
        <MovieCarousel title="🔥 Mới cập nhật" movies={catalog.homeTrendingMovies} />
      )}

      {homeCategories.map(category => {
        return (
          <div key={category.slug}>
            <MovieCarousel
              title={`🏷️ ${category.tag}`}
              movies={category.movies.slice(0, 20)}
              viewAllHref={`/category/${category.slug}`}
            />
          </div>
        );
      })}

      <footer style={{ 
        textAlign: 'center', 
        padding: '60px 20px', 
        background: '#0b0b10',
        borderTop: '1px solid #262638'
      }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '10px' }}>HÀ NHÂN <span className="comic-text-yellow">MOVIE</span></h2>
        <p style={{ color: '#888', maxWidth: '600px', margin: '0 auto', fontSize: '1rem', lineHeight: '1.6' }}>
          Nền tảng xem phim hoạt hình, tu tiên, xuyên không và trọng sinh chọn lọc chất lượng cao. Cập nhật liên tục các tập phim mới nhất.
        </p>
        <p style={{ marginTop: '30px', fontSize: '0.85rem', color: '#555' }}>
          © 2026 Hanhan Movie.
        </p>
      </footer>
    </>
  );
}
