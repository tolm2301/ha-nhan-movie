import { runCrawl, serializeError } from '../../../../lib/crawl.server.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizeToken(value = '') {
  return String(value).trim();
}

export function isVercelCronRequest(request) {
  return request.headers.get('x-vercel-cron') === '1';
}

export function getRequestMode(request) {
  if (isVercelCronRequest(request)) {
    return {
      ok: true,
      trigger: 'vercel-cron',
    };
  }

  const secret = normalizeToken(process.env.CRON_SECRET);
  if (!secret) {
    return {
      ok: false,
      status: 401,
      body: {
        ok: false,
        error: 'Set CRON_SECRET for manual access, or call through Vercel Cron.',
      },
    };
  }

  const provided = normalizeToken(
    request.headers.get('x-cron-secret')
    || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    || request.nextUrl.searchParams.get('secret')
  );

  if (provided !== secret) {
    return {
      ok: false,
      status: 403,
      body: {
        ok: false,
        error: 'Forbidden',
      },
    };
  }

  return {
    ok: true,
    trigger: 'manual',
  };
}

async function handleRequest(request) {
  const access = getRequestMode(request);
  if (!access.ok) {
    return Response.json(access.body, { status: access.status });
  }

  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1' || request.nextUrl.searchParams.get('dryRun') === 'true';

  try {
    const result = await runCrawl({ dryRun, strictMode: true });
    return Response.json({
      ok: true,
      trigger: access.trigger,
      newVideos: result.newVideos,
      fetchedCount: result.fetchedCount,
      persistedCatalogTotal: result.persistedCatalogTotal,
      ...result,
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] cron_crawl_failed ${JSON.stringify({
      trigger: access.trigger,
      dryRun,
      error: serializeError(error),
    })}`);

    return Response.json({
      ok: false,
      trigger: access.trigger,
      dryRun,
      error: 'Crawl failed',
      details: serializeError(error),
    }, { status: 500 });
  }
}

export async function GET(request) {
  return handleRequest(request);
}

export async function POST(request) {
  return handleRequest(request);
}
