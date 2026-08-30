import type { Request, Response } from 'express';
import { getSharePublicOrigin, resolveShare } from '../services/share.service';

const DEFAULT_SHARE_OG_IMAGE_URL = 'https://ivbvzxnminsigibsgixs.supabase.co/storage/v1/object/public/MyAniTrack_v2/public-assets/og/share-default-20260831.png';

export function getShareOgImageUrl() {
  const configured = process.env.SHARE_OG_IMAGE_URL?.trim() || DEFAULT_SHARE_OG_IMAGE_URL;

  try {
    const url = new URL(configured);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.toString()
      : DEFAULT_SHARE_OG_IMAGE_URL;
  } catch {
    return DEFAULT_SHARE_OG_IMAGE_URL;
  }
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
    } as const;
  } catch {
    return { valid: false, username: 'MyAniTrack', resourceType: 'COLLECTION' as const };
  }
}

export async function getSharePreviewHtml(req: Request, res: Response) {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const preview = await getPreview(token);
  const canonical = `${getSharePublicOrigin()}/s/${encodeURIComponent(token)}`;
  const imageUrl = getShareOgImageUrl();
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
    <meta property="og:image:width" content="1731"><meta property="og:image:height" content="909">
    <meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(imageUrl)}">
  </head><body><p><a href="${escapeHtml(canonical)}">MyAniTrack에서 공유 보기</a></p></body></html>`);
}
