"use client";

import { useSyncExternalStore, useMemo } from "react";
import Hero from "@/components/Hero/Hero";
import MovieCarousel from "@/components/MovieCarousel/MovieCarousel";
import RecentWatchedSection from "@/components/RecentWatchedSection/RecentWatchedSectionLazy";
import { buildCategoryBuckets } from "@/lib/movieCategories";
import {
  subscribeCatalog,
  getCatalogMoviesSnapshot,
  getServerCatalogSnapshot,
} from "@/lib/clientCatalog";

export default function HomeContent({
  initialFeaturedMovie,
  initialTrendingMovies = [],
  initialCategoryBuckets = [],
}) {
  const cachedAllMovies = useSyncExternalStore(
    subscribeCatalog,
    getCatalogMoviesSnapshot,
    getServerCatalogSnapshot
  );

  const clientData = useMemo(() => {
    if (!cachedAllMovies || !Array.isArray(cachedAllMovies) || cachedAllMovies.length === 0) {
      return null;
    }

    const categoryBuckets = buildCategoryBuckets(cachedAllMovies);
    const haNhanBucket = categoryBuckets.find((cat) => cat.slug === "ha-nhan");
    const featuredMovie = haNhanBucket?.movies?.[0] || cachedAllMovies[0] || null;
    const trendingMovies = cachedAllMovies.slice(0, 15);
    const homeCategories = categoryBuckets.filter((cat) => cat.movies && cat.movies.length > 0);

    return {
      featuredMovie,
      trendingMovies,
      homeCategories,
    };
  }, [cachedAllMovies]);

  const featuredMovie = clientData ? clientData.featuredMovie : initialFeaturedMovie;
  const trendingMovies = clientData ? clientData.trendingMovies : initialTrendingMovies;
  const homeCategories = clientData ? clientData.homeCategories : initialCategoryBuckets;

  return (
    <>
      <Hero featuredMovie={featuredMovie} />

      <RecentWatchedSection />

      {trendingMovies.length > 0 && (
        <MovieCarousel title="🔥 Mới cập nhật" movies={trendingMovies} />
      )}

      {homeCategories.map((category) => (
        <div key={category.slug}>
          <MovieCarousel
            title={`🏷️ ${category.tag}`}
            movies={category.movies.slice(0, 20)}
            viewAllHref={`/category/${category.slug}`}
          />
        </div>
      ))}
    </>
  );
}
