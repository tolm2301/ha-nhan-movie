import { NextResponse } from 'next/server';
import { getMovieCatalog } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const catalog = await getMovieCatalog();
  return NextResponse.json({
    movies: catalog.allMovies,
    categoryMenu: catalog.categoryMenu,
  });
}
