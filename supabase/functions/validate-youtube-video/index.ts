import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/auth.ts';

function extractYoutubeId(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.replace(/^\//, '').slice(0, 11) || null;
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return v.slice(0, 11);
      const parts = u.pathname.split('/').filter(Boolean);
      const embedIdx = parts.indexOf('embed');
      if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1].slice(0, 11);
      const shortsIdx = parts.indexOf('shorts');
      if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1].slice(0, 11);
    }
  } catch {
    return null;
  }
  return null;
}

Deno.serve(async (req) => {
  bindCorsRequest(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return withCors(errorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED'));
  }

  const auth = await requireUser(req);
  if ('response' in auth) return withCors(auth.response);

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return withCors(errorResponse('Invalid JSON body', 400, 'BAD_REQUEST'));
  }

  const videoId = body.url ? extractYoutubeId(body.url) : null;
  if (!videoId) {
    return withCors(errorResponse('Enter a valid YouTube URL', 400, 'INVALID_URL'));
  }

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`
    )}&format=json`;
    const oembedRes = await fetch(oembedUrl);
    if (!oembedRes.ok) {
      return withCors(
        errorResponse('YouTube video not found or not public/unlisted', 400, 'NOT_FOUND')
      );
    }
    const oembed = (await oembedRes.json()) as {
      title?: string;
      thumbnail_url?: string;
      author_name?: string;
    };

    const apiKey = Deno.env.get('YOUTUBE_DATA_API_KEY');
    let embeddable = true;
    let madeForKids = false;

    if (apiKey) {
      const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=status&id=${videoId}&key=${apiKey}`;
      const apiRes = await fetch(apiUrl);
      if (apiRes.ok) {
        const apiJson = (await apiRes.json()) as {
          items?: Array<{ status?: { embeddable?: boolean; madeForKids?: boolean } }>;
        };
        const status = apiJson.items?.[0]?.status;
        if (status) {
          embeddable = status.embeddable !== false;
          madeForKids = status.madeForKids === true;
        }
      }
    }

    if (!embeddable) {
      return withCors(
        errorResponse('Video must allow embedding', 400, 'NOT_EMBEDDABLE')
      );
    }
    if (madeForKids) {
      return withCors(
        errorResponse('madeForKids videos are not allowed on this 18+ platform', 400, 'MADE_FOR_KIDS')
      );
    }

    return withCors(
      okResponse({
        video_id: videoId,
        title: oembed.title ?? null,
        thumbnail_url: oembed.thumbnail_url ?? null,
        author_name: oembed.author_name ?? null,
        embeddable: true,
        made_for_kids: false,
        watch_url: `https://www.youtube.com/watch?v=${videoId}`,
        embed_url: `https://www.youtube-nocookie.com/embed/${videoId}`,
      })
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'YouTube validation failed';
    return withCors(errorResponse(message, 500, 'VALIDATE_FAILED'));
  }
});
