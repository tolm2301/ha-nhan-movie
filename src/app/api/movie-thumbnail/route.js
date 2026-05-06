import { NextResponse } from 'next/server';

function hashString(value = '') {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function escapeXml(value = '') {
  return String(value || '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&apos;',
    '"': '&quot;',
  }[char] || char));
}

function buildPalette(seed = '') {
  const hash = hashString(seed);
  const hue = hash % 360;
  const accentHue = (hue + 38) % 360;
  const base = `hsl(${hue} 72% 22%)`;
  const accent = `hsl(${accentHue} 82% 50%)`;
  const glow = `hsl(${(hue + 180) % 360} 70% 38%)`;

  return { base, accent, glow };
}

function splitTitle(title = '') {
  const words = String(title || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return ['Không rõ tên phim'];

  const lines = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > 24 && current) {
      lines.push(current);
      current = word;
      if (lines.length === 2) break;
      continue;
    }

    current = next;
  }

  if (lines.length < 2 && current) {
    lines.push(current);
  }

  if (lines.length > 2) {
    return lines.slice(0, 2);
  }

  if (lines.length === 1 && lines[0].length > 28) {
    return [lines[0].slice(0, 28).trimEnd()];
  }

  return lines;
}

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams;
  const title = String(searchParams.get('title') || 'Không rõ tên phim').trim() || 'Không rõ tên phim';
  const tag = String(searchParams.get('tag') || 'Khác').trim() || 'Khác';
  const seed = String(searchParams.get('seed') || `${title}|${tag}`).trim() || `${title}|${tag}`;
  const { base, accent, glow } = buildPalette(seed);
  const titleLines = splitTitle(title);
  const subtitle = `Hanhan Movie • ${tag}`;
  const ariaLabel = `${title} - ${tag}`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" role="img" aria-label="${escapeXml(ariaLabel)}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${base}" />
      <stop offset="58%" stop-color="${glow}" />
      <stop offset="100%" stop-color="#0d0d12" />
    </linearGradient>
    <radialGradient id="shine" cx="30%" cy="22%" r="80%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.36" />
      <stop offset="70%" stop-color="${accent}" stop-opacity="0.06" />
      <stop offset="100%" stop-color="${accent}" stop-opacity="0" />
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#000" flood-opacity="0.45" />
    </filter>
  </defs>
  <rect width="1200" height="675" fill="url(#bg)" />
  <rect width="1200" height="675" fill="url(#shine)" />
  <circle cx="1020" cy="120" r="150" fill="${accent}" fill-opacity="0.16" />
  <circle cx="150" cy="580" r="170" fill="#ffffff" fill-opacity="0.06" />
  <rect x="56" y="56" width="280" height="48" rx="24" fill="#000" fill-opacity="0.38" />
  <text x="96" y="88" fill="#fff" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" letter-spacing="2">HANHAN MOVIE</text>
  <g filter="url(#shadow)">
    <rect x="56" y="156" width="440" height="58" rx="18" fill="#000" fill-opacity="0.3" />
    <text x="84" y="194" fill="${accent}" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700">${escapeXml(tag)}</text>
  </g>
  <text x="56" y="330" fill="#fff" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="800" filter="url(#shadow)">
    ${titleLines.map((line, index) => `<tspan x="56" dy="${index === 0 ? 0 : 84}">${escapeXml(line)}</tspan>`).join('')}
  </text>
  <text x="58" y="564" fill="#f3f3f3" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="600" opacity="0.94">${escapeXml(subtitle)}</text>
  <rect x="56" y="600" width="1088" height="18" rx="9" fill="#ffffff" fill-opacity="0.1" />
  <rect x="56" y="600" width="640" height="18" rx="9" fill="${accent}" fill-opacity="0.7" />
</svg>`;

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
