import { promises as fs } from 'fs';
import path from 'path';
import type { Request, Response } from 'express';
import sharp from 'sharp';
import { getShareApiOrigin, getSharePublicOrigin, resolveShare } from '../services/share.service';

const assetDirectory = path.resolve(__dirname, '../assets');
let assetPromise: Promise<{ font: string; logo: string }> | null = null;

function loadAssets() {
  assetPromise ??= Promise.all([
    fs.readFile(path.join(assetDirectory, 'NotoSansKR.ttf')).then((value) => value.toString('base64')),
    fs.readFile(path.join(assetDirectory, 'myanitrack-logo.png')).then((value) => value.toString('base64')),
  ]).then(([font, logo]) => ({ font, logo }));
  return assetPromise;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

async function getPreview(token: string) {
  try {
    const share = await resolveShare(token);
    return {
      valid: true,
      username: share.owner.username,
      resourceType: share.resourceType,
      animeListCount: share.owner.animeListCount,
    } as const;
  } catch {
    return { valid: false, username: 'MyAniTrack', resourceType: 'COLLECTION' as const, animeListCount: 0 };
  }
}

type SharePreview = Awaited<ReturnType<typeof getPreview>>;

export async function getSharePreviewHtml(req: Request, res: Response) {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const preview = await getPreview(token);
  const canonical = `${getSharePublicOrigin()}/s/${encodeURIComponent(token)}`;
  const imageUrl = `${getShareApiOrigin()}/share-preview/${encodeURIComponent(token)}/image.png`;
  const resourceLabel = preview.resourceType === 'ANALYSIS' ? '취향 분석' : '애니 컬렉션';
  const title = preview.valid ? `${preview.username}님의 ${resourceLabel} | MyAniTrack` : '공유 링크 | MyAniTrack';
  const description = preview.valid
    ? `${preview.username}님의 ${resourceLabel}을 MyAniTrack에서 확인해 보세요.`
    : '이 공유 링크는 만료되었거나 사용할 수 없습니다.';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return res.send(`<!doctype html><html lang="ko"><head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}">
    <meta name="robots" content="noindex,nofollow,noarchive"><link rel="canonical" href="${escapeHtml(canonical)}">
    <meta property="og:type" content="website"><meta property="og:site_name" content="MyAniTrack">
    <meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(imageUrl)}">
    <meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(imageUrl)}">
  </head><body><p><a href="${escapeHtml(canonical)}">MyAniTrack에서 공유 보기</a></p></body></html>`);
}

export async function renderSharePreviewImage(preview: SharePreview) {
  const assets = await loadAssets();
  const username = escapeHtml(preview.valid ? preview.username : 'MyAniTrack');
  const resourceLabel = preview.valid
    ? preview.resourceType === 'ANALYSIS' ? '취향 분석 리포트' : '애니 컬렉션'
    : '공유 링크를 사용할 수 없습니다';
  const countLabel = preview.valid ? `컬렉션 ${preview.animeListCount.toLocaleString('ko-KR')}개` : 'myanitrack.com';
  const svg = `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff8ed"/><stop offset="1" stop-color="#ffd9a8"/></linearGradient>
        <style>@font-face{font-family:NotoSansKR;src:url(data:font/ttf;base64,${assets.font})}text{font-family:NotoSansKR,sans-serif}</style>
      </defs>
      <rect width="1200" height="630" rx="48" fill="url(#bg)"/>
      <circle cx="1060" cy="110" r="210" fill="#ff8a00" opacity=".12"/><circle cx="1050" cy="560" r="260" fill="#2d2118" opacity=".06"/>
      <image href="data:image/png;base64,${assets.logo}" x="80" y="74" width="112" height="112" preserveAspectRatio="xMidYMid meet"/>
      <text x="218" y="125" font-size="42" font-weight="800" fill="#2d2118">MyAniTrack</text>
      <text x="218" y="164" font-size="24" fill="#725d4d">Track your anime taste</text>
      <text x="80" y="340" font-size="64" font-weight="800" fill="#241a13">${username}</text>
      <text x="80" y="414" font-size="42" font-weight="650" fill="#5e493a">${escapeHtml(resourceLabel)}</text>
      <rect x="80" y="476" width="310" height="72" rx="36" fill="#241a13"/>
      <text x="235" y="524" text-anchor="middle" font-size="28" font-weight="700" fill="#fffaf2">${escapeHtml(countLabel)}</text>
    </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function getSharePreviewImage(req: Request, res: Response) {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const preview = await getPreview(token);
  const png = await renderSharePreviewImage(preview);
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return res.send(png);
}
