import { NextResponse } from "next/server";
import { getMovieCatalog } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const catalog = await getMovieCatalog();
    return NextResponse.json(
      {
        movies: catalog.allMovies,
        categoryMenu: catalog.categoryMenu,
        trendingMovies: catalog.trendingMovies,
        featuredMovie: catalog.featuredMovie,
        total: catalog.allMovies.length,
        syncedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
