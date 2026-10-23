import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
  return handleRevalidate(request);
}

export async function POST(request) {
  return handleRevalidate(request);
}

async function handleRevalidate(request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET || "hanhan-crawl-2026-secret";

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: "Sai secret token xác thực" }, { status: 401 });
  }

  try {
    // Xóa toàn bộ cache tĩnh của Next.js App Router trên Vercel Edge CDN
    revalidatePath("/", "layout");

    return NextResponse.json({
      success: true,
      message: "Đã làm mới toàn bộ bộ đệm Vercel Edge CDN thành công!",
      revalidatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Lỗi làm mới cache: " + error.message },
      { status: 500 }
    );
  }
}
