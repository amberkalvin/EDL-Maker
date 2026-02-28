// OpenSubtitles API Integration

const API_KEY = 'OQIdVXixLFubwJzlYTk4XhUqUrlbB8Ce';
const BASE_URL = '/api/v1'; // Proxied via vite.config.ts to avoid CORS

export interface SubtitleMetadata {
    id: string;
    language: string;
    url: string;
    fileName: string;
    downloads: number;
}

export async function searchSubtitles(query: string, language: string = 'en'): Promise<SubtitleMetadata[]> {
    try {
        const response = await fetch(`${BASE_URL}/subtitles?query=${encodeURIComponent(query)}&languages=${language}`, {
            method: 'GET',
            headers: {
                'Api-Key': API_KEY,
                'Content-Type': 'application/json',
                'User-Agent': 'EDLMaker v1.0'
            }
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();

        return data.data.slice(0, 5).map((item: any) => ({
            id: item.attributes.files[0]?.file_id,
            language: item.attributes.language,
            url: item.attributes.files[0]?.cd_id, // We need the file_id to download
            fileName: item.attributes.release,
            downloads: item.attributes.download_count
        })).filter((s: SubtitleMetadata) => s.id);
    } catch (error) {
        console.error('Error searching subtitles:', error);
        throw error;
    }
}

export async function downloadSubtitle(fileId: string): Promise<string> {
    try {
        // 1. Request a download link
        const response = await fetch(`${BASE_URL}/download`, {
            method: 'POST',
            headers: {
                'Api-Key': API_KEY,
                'Content-Type': 'application/json',
                'User-Agent': 'EDLMaker v1.0',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ file_id: parseInt(fileId, 10) })
        });

        if (!response.ok) {
            throw new Error(`Download API Error: ${response.status}`);
        }

        const data = await response.json();
        let downloadUrl = data.link;

        // Proxied via vite.config.ts to avoid CORS on the actual file fetching
        if (downloadUrl.startsWith('https://dl.opensubtitles.com')) {
            downloadUrl = downloadUrl.replace('https://dl.opensubtitles.com', '/dl');
        } else if (downloadUrl.startsWith('https://www.opensubtitles.com')) {
            downloadUrl = downloadUrl.replace('https://www.opensubtitles.com', '/dl-www');
        }

        // 2. Fetch the actual raw file content (it's often raw text to this direct link)
        const fileResponse = await fetch(downloadUrl);
        if (!fileResponse.ok) {
            throw new Error('Failed to fetch actual subtitle file content');
        }

        const textContent = await fileResponse.text();
        return textContent;
    } catch (error) {
        console.error('Error downloading subtitle:', error);
        throw error;
    }
}
