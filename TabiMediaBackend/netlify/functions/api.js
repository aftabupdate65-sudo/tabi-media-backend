exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const path = event.path.replace('/.netlify/functions/api', '');
    const body = event.body ? JSON.parse(event.body) : {};

    // ── /api/info ──
    if (path === '/info' && event.httpMethod === 'POST') {
        const { url } = body;
        if (!url) return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ message: 'URL required' })
        };

        try {
            const platform = detectPlatform(url);
            let info;
            switch (platform) {
                case 'tiktok':
                    info = await getTikTokInfo(url);
                    break;
                case 'instagram':
                    info = await getInstagramInfo(url);
                    break;
                case 'facebook':
                    info = await getFacebookInfo(url);
                    break;
                case 'youtube':
                    info = await getYouTubeInfo(url);
                    break;
                default:
                    throw new Error('Unsupported platform');
            }
            return { statusCode: 200, headers, body: JSON.stringify(info) };
        } catch (e) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ message: e.message })
            };
        }
    }

    // ── /api/download ──
    if (path === '/download' && event.httpMethod === 'POST') {
        const taskId = Math.random().toString(36).substr(2, 9);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ taskId, downloadUrl: body.downloadUrl })
        };
    }

    // ── /api/progress/:taskId ──
    if (path.startsWith('/progress/')) {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                status: 'completed',
                progress: 100,
                filePath: body.downloadUrl
            })
        };
    }

    // ── /api/batch ──
    if (path === '/batch' && event.httpMethod === 'POST') {
        const urls = body.urls || [];
        const taskIds = urls.map(() => Math.random().toString(36).substr(2, 9));
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ taskIds })
        };
    }

    return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: 'Not found' })
    };
};

// ─── PLATFORM DETECTION ───────────────────────────────
function detectPlatform(url) {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook';
    return 'unknown';
}

// ─── TIKTOK ───────────────────────────────────────────
async function getTikTokInfo(url) {
    const cleanUrl = url.split('?')[0];
    const res = await fetch('https://www.tikwm.com/api/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0',
        },
        body: new URLSearchParams({ url: cleanUrl })
    });
    const data = await res.json();
    if (!data?.data?.play) throw new Error('TikTok video not found');
    return {
        title: data.data.title || 'TikTok Video',
        thumbnail: data.data.cover || '',
        duration: `0:${data.data.duration || 30}`,
        platform: 'TikTok',
        formats: [
            {
                id: 'tiktok_nowm',
                label: 'No Watermark HD',
                quality: '720p',
                type: 'video',
                ext: 'mp4',
                size: '~15 MB',
                downloadUrl: data.data.play,
            },
            {
                id: 'tiktok_audio',
                label: 'Audio MP3',
                quality: '128kbps',
                type: 'audio',
                ext: 'mp3',
                size: '~3 MB',
                downloadUrl: data.data.music || data.data.play,
            },
        ],
    };
}

// ─── INSTAGRAM ────────────────────────────────────────
async function getInstagramInfo(url) {
    const res = await fetch(
        `https://api.instavideosave.com/?url=${encodeURIComponent(url)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const data = await res.json();
    const videoUrl = data?.url?.[0]?.url || data?.url || '';
    if (!videoUrl) throw new Error('Instagram video not found');
    return {
        title: 'Instagram Video',
        thumbnail: data.thumbnail || '',
        duration: '0:30',
        platform: 'Instagram',
        formats: [
            {
                id: 'insta_hd',
                label: 'HD Video',
                quality: '720p',
                type: 'video',
                ext: 'mp4',
                size: '~20 MB',
                downloadUrl: videoUrl,
            },
            {
                id: 'insta_audio',
                label: 'Audio MP3',
                quality: '128kbps',
                type: 'audio',
                ext: 'mp3',
                size: '~3 MB',
                downloadUrl: videoUrl,
            },
        ],
    };
}

// ─── FACEBOOK ─────────────────────────────────────────
async function getFacebookInfo(url) {
    const res = await fetch(
        `https://api.getfvid.com/api?url=${encodeURIComponent(url)}&token=f70dc1b34a2b9947a75d2e30e54e6247`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const data = await res.json();
    const videoUrl = data?.hd || data?.sd || '';
    if (!videoUrl) throw new Error('Facebook video not found');
    return {
        title: data.title || 'Facebook Video',
        thumbnail: data.thumbnail || '',
        duration: '0:30',
        platform: 'Facebook',
        formats: [
            {
                id: 'fb_hd',
                label: 'HD Video',
                quality: '720p',
                type: 'video',
                ext: 'mp4',
                size: '~25 MB',
                downloadUrl: data.hd || data.sd,
            },
            {
                id: 'fb_sd',
                label: 'SD Video',
                quality: '360p',
                type: 'video',
                ext: 'mp4',
                size: '~10 MB',
                downloadUrl: data.sd || '',
            },
        ],
    };
}

// ─── YOUTUBE ──────────────────────────────────────────
async function getYouTubeInfo(url) {
    const videoId = url.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/
    )?.[1];
    if (!videoId) throw new Error('Invalid YouTube URL');
    const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    );
    const oembedData = await oembedRes.json();
    return {
        title: oembedData.title || 'YouTube Video',
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        duration: '0:00',
        platform: 'YouTube',
        formats: [
            {
                id: 'yt_1080',
                label: '1080p Full HD',
                quality: '1080p',
                type: 'video',
                ext: 'mp4',
                size: '~150 MB',
                downloadUrl: `https://www.yt-download.org/api/button/mp4/1080/${videoId}`,
            },
            {
                id: 'yt_720',
                label: '720p HD',
                quality: '720p',
                type: 'video',
                ext: 'mp4',
                size: '~80 MB',
                downloadUrl: `https://www.yt-download.org/api/button/mp4/720/${videoId}`,
            },
            {
                id: 'yt_480',
                label: '480p',
                quality: '480p',
                type: 'video',
                ext: 'mp4',
                size: '~40 MB',
                downloadUrl: `https://www.yt-download.org/api/button/mp4/480/${videoId}`,
            },
            {
                id: 'yt_360',
                label: '360p',
                quality: '360p',
                type: 'video',
                ext: 'mp4',
                size: '~20 MB',
                downloadUrl: `https://www.yt-download.org/api/button/mp4/360/${videoId}`,
            },
            {
                id: 'yt_audio',
                label: 'Audio MP3',
                quality: '128kbps',
                type: 'audio',
                ext: 'mp3',
                size: '~5 MB',
                downloadUrl: `https://www.yt-download.org/api/button/mp3/${videoId}`,
            },
        ],
    };
}