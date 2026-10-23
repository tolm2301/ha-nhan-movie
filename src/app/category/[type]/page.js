import { notFound } from "next/navigation";
import { getCategoryBySlug, getCategoryMenu } from "@/lib/data";
import { getRenderableThumbnail } from "@/lib/thumbnailFilters";
import CategoryContent from "./CategoryContent";
import styles from "./Category.module.css";
import { buildBreadcrumbJsonLd, buildItemListJsonLd, buildMetadata, buildAbsoluteUrl, toJsonLd } from "@/lib/seo";

export const revalidate = 3600; // Bộ nhớ đệm Edge CDN 1 tiếng, kết hợp LocalStorage 5 tiếng

const PAGE_SIZE = 24;

export async function generateStaticParams() {
  const categoryMenu = await getCategoryMenu();
  return categoryMenu.map(category => ({ type: category.slug }));
}

export async function generateMetadata({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const categoryType = resolvedParams?.type || "";
  const category = await getCategoryBySlug(categoryType);

  if (!category) {
    return buildMetadata({
      title: "Hanhan Movie / Hà Nhân | Danh mục không tồn tại",
      description: "Danh mục không tồn tại trên Hanhan Movie / Hà Nhân.",
      pathname: `/category/${categoryType}`,
    });
  }

  const requestedPage = Number.parseInt(resolvedSearchParams?.page || "1", 10);
  const totalPages = Math.max(1, Math.ceil(category.movies.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(Number.isNaN(requestedPage) ? 1 : requestedPage, 1), totalPages);
  const pagePath = currentPage > 1 ? `/category/${category.slug}?page=${currentPage}` : `/category/${category.slug}`;
  const pageMovies = category.movies.slice((currentPage - 1) * PAGE_SIZE, (currentPage - 1) * PAGE_SIZE + PAGE_SIZE);
  const movieCountText = `${category.count} video`;

  return buildMetadata({
    title: `Hanhan Movie / Hà Nhân | ${category.tag} - Xem phim`,
    description: `Khám phá ${movieCountText} ${category.tag.toLowerCase()} đang có trên Hanhan Movie / Hà Nhân${currentPage > 1 ? `, trang ${currentPage}/${totalPages}` : ""}.`,
    pathname: pagePath,
    image: pageMovies[0] ? getRenderableThumbnail(pageMovies[0]) : undefined,
  });
}

export default async function CategoryPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const categoryType = resolvedParams?.type || "";
  const category = await getCategoryBySlug(categoryType);

  if (!category) {
    notFound();
  }

  const requestedPage = Number.parseInt(resolvedSearchParams?.page || "1", 10);
  const totalPages = Math.max(1, Math.ceil(category.movies.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(Number.isNaN(requestedPage) ? 1 : requestedPage, 1), totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageMovies = category.movies.slice(startIndex, startIndex + PAGE_SIZE);
  const pageBaseHref = `/category/${category.slug}`;
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Trang chủ", url: buildAbsoluteUrl("/") },
    { name: category.tag, url: buildAbsoluteUrl(currentPage > 1 ? `${pageBaseHref}?page=${currentPage}` : pageBaseHref) },
  ]);
  const itemListJsonLd = buildItemListJsonLd(pageMovies.map(movie => ({
    name: movie.displayTitle || movie.title,
    url: buildAbsoluteUrl(`/watch/${movie.id}`),
  })));

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(itemListJsonLd) }} />
      <CategoryContent
        categorySlug={category.slug}
        initialCategory={{ tag: category.tag, count: category.count }}
        initialMovies={pageMovies}
        currentPage={currentPage}
        totalPages={totalPages}
        pageBaseHref={pageBaseHref}
      />
    </main>
  );
}
