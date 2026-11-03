"use client";

import { useSyncExternalStore, useMemo, useState } from "react";
import Hero from "@/components/Hero/Hero";
import MovieCarousel from "@/components/MovieCarousel/MovieCarousel";
import RecentWatchedSection from "@/components/RecentWatchedSection/RecentWatchedSectionLazy";
import { buildCategoryBuckets } from "@/lib/movieCategories";
import { hasRenderableThumbnail } from "@/lib/thumbnailFilters";
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
  const [unavailableIds, setUnavailableIds] = useState([]);

  const cachedAllMovies = useSyncExternalStore(
    subscribeCatalog,
    getCatalogMoviesSnapshot,
    getServerCatalogSnapshot
  );

  const clientData = useMemo(() => {
    if (!cachedAllMovies || !Array.isArray(cachedAllMovies) || cachedAllMovies.length === 0) {
      return null;
    }

    const validMovies = cachedAllMovies.filter(
      (movie) => hasRenderableThumbnail(movie) && !unavailableIds.includes(movie.id)
    );
    const categoryBuckets = buildCategoryBuckets(validMovies);
    const haNhanBucket = categoryBuckets.find((cat) => cat.slug === "ha-nhan");
    const featuredMovie = haNhanBucket?.movies?.[0] || validMovies[0] || null;
    const trendingMovies = validMovies.slice(0, 15);
    const homeCategories = categoryBuckets.filter((cat) => cat.movies && cat.movies.length > 0);

    return {
      featuredMovie,
      trendingMovies,
      homeCategories,
    };
  }, [cachedAllMovies, unavailableIds]);

  const fallbackFeatured =
    initialFeaturedMovie &&
    hasRenderableThumbnail(initialFeaturedMovie) &&
    !unavailableIds.includes(initialFeaturedMovie.id)
      ? initialFeaturedMovie
      : initialTrendingMovies.find(
          (movie) => hasRenderableThumbnail(movie) && !unavailableIds.includes(movie.id)
        ) || null;

  const featuredMovie = clientData ? clientData.featuredMovie : fallbackFeatured;
  const trendingMovies = clientData ? clientData.trendingMovies : initialTrendingMovies;
  const homeCategories = clientData ? clientData.homeCategories : initialCategoryBuckets;

  const handleMovieUnavailable = (movieId) => {
    if (!movieId) return;
    setUnavailableIds((prev) => (prev.includes(movieId) ? prev : [...prev, movieId]));
  };

  return (
    <>
      <Hero featuredMovie={featuredMovie} onMovieUnavailable={handleMovieUnavailable} />

      <RecentWatchedSection />

      {trendingMovies.length > 0 && (
        <MovieCarousel title="Mới Cập Nhật" movies={trendingMovies} />
      )}

      {homeCategories.map((category) => (
        <div key={category.slug}>
          <MovieCarousel
            title={category.tag}
            movies={category.movies.slice(0, 20)}
            viewAllHref={`/category/${category.slug}`}
          />
        </div>
      ))}
    </>
  );
}