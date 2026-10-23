import { redirect } from "next/navigation";

export default async function WatchPopoutPage({ params }) {
  const resolvedParams = await params;
  const movieId = typeof resolvedParams?.id === "string" ? resolvedParams.id : "";
  redirect("/watch/" + movieId);
}
