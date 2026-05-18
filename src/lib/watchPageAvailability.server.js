const WATCH_PAGE_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'accept-language': 'en-US,en;q=0.9,vi;q=0.8',
};

const WATCH_PAGE_TIMEOUT_MS = 15000;

function extractBalancedJson(text = '', startIndex = 0) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}

export function extractWatchPagePlayerResponse(playerResponseOrHtml = '') {
  if (playerResponseOrHtml && typeof playerResponseOrHtml === 'object') {
    return playerResponseOrHtml;
  }

  const html = String(playerResponseOrHtml || '');
  const playerResponseIndex = html.indexOf('ytInitialPlayerResponse');
  if (playerResponseIndex === -1) {
    return null;
  }

  const jsonStart = html.indexOf('{', playerResponseIndex);
  if (jsonStart === -1) {
    return null;
  }

  const jsonText = extractBalancedJson(html, jsonStart);
  if (!jsonText) {
    return null;
  }

  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

export function explainWatchPageAvailability(playerResponseOrHtml = '') {
  const playerResponse = extractWatchPagePlayerResponse(playerResponseOrHtml);

  if (!playerResponse) {
    return { keep: false, reason: 'missing watch page metadata' };
  }

  const status = String(playerResponse?.playabilityStatus?.status || '').trim().toUpperCase();
  if (!status || status !== 'OK') {
    const reason = String(
      playerResponse?.playabilityStatus?.reason
      || playerResponse?.playabilityStatus?.errorScreen?.playerErrorMessageRenderer?.reason?.simpleText
      || playerResponse?.playabilityStatus?.messages?.[0]?.simpleText
      || playerResponse?.playabilityStatus?.messages?.[0]
      || status
      || 'unavailable',
    ).trim();

    return { keep: false, reason: `watch page unavailable (${reason})` };
  }

  return { keep: true, reason: 'accepted' };
}

function isTransientWatchPageError(error) {
  const code = error?.code ?? error?.cause?.code ?? null;
  const statusCode = error?.statusCode ?? error?.response?.status ?? error?.status ?? error?.cause?.statusCode ?? null;
  const message = String(error?.message || '').toLowerCase();

  if (statusCode && Number(statusCode) >= 500 && Number(statusCode) < 600) {
    return true;
  }

  if (['ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'EPIPE', 'ABORT_ERR'].includes(code)) {
    return true;
  }

  return message.includes('socket hang up') || message.includes('timeout') || message.includes('network error');
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function checkWatchPageAvailability(videoId, { retries = 2, timeoutMs = WATCH_PAGE_TIMEOUT_MS } = {}) {
  const normalizedVideoId = String(videoId || '').trim();
  if (!normalizedVideoId) {
    return { ok: false, available: null, reason: 'missing video id' };
  }

  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(normalizedVideoId)}&hl=en&gl=US`;
  let lastError = null;

  for (let attempt = 1; attempt <= Math.max(1, retries + 1); attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(watchUrl, {
        signal: controller.signal,
        headers: WATCH_PAGE_HEADERS,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${watchUrl}`);
      }

      const html = await response.text();
      const availability = explainWatchPageAvailability(html);

      return {
        ok: true,
        available: availability.keep,
        reason: availability.reason,
        watchUrl,
      };
    } catch (error) {
      lastError = error;
      const transient = isTransientWatchPageError(error);
      if (!transient || attempt > retries) {
        break;
      }

      await wait(250 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    ok: false,
    available: null,
    reason: lastError instanceof Error ? lastError.message : String(lastError || 'unknown watch page error'),
    watchUrl,
  };
}
