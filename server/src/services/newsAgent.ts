import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- Types ---
export interface ArticleResult {
    title: string;
    link: string;
    snippet: string;
    source: string;
    date?: string;
}

export interface TopicDigest {
    topic: string;
    summary: string;
    articles: ArticleResult[];
    articleCount: number;
}

export interface NewsDigest {
    generatedAt: string;
    topics: TopicDigest[];
    status: 'ready' | 'generating' | 'error';
    error?: string;
}

// --- In-memory cache ---
let cachedDigest: NewsDigest | null = null;
let isGenerating = false;

// --- Config ---
const CONFIG_PATH = path.join(__dirname, '../../config/interests.txt');

/**
 * Load interests from the configuration file.
 * Returns an array of non-empty, trimmed lines.
 */
export function loadInterests(): string[] {
    if (!fs.existsSync(CONFIG_PATH)) {
        console.warn(`[NewsAgent] Config file not found: ${CONFIG_PATH}`);
        return [];
    }
    const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'));
}

/**
 * Search Google Custom Search for recent articles about a topic.
 * Uses dateRestrict=d1 to find only articles from the last 24 hours.
 * Requires a Programmable Search Engine ID (cx) configured with relevant news sites.
 */
async function searchNews(
    topic: string,
    apiKey: string,
    cx: string
): Promise<ArticleResult[]> {
    const query = encodeURIComponent(topic);
    const url = `https://www.googleapis.com/customsearch/v1?q=${query}&key=${apiKey}&cx=${cx}&dateRestrict=d1&num=5&lr=lang_fr|lang_en`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[NewsAgent] Google Search API error for "${topic}":`, response.status, errorBody);
            return [];
        }

        const data = await response.json();
        if (!data.items || data.items.length === 0) {
            console.log(`[NewsAgent] No results found for "${topic}" in the last 24h`);
            return [];
        }

        return data.items.map((item: any) => ({
            title: item.title || '',
            link: item.link || '',
            snippet: item.snippet || '',
            source: item.displayLink || '',
            date: item.pagemap?.metatags?.[0]?.['article:published_time'] || undefined,
        }));
    } catch (error) {
        console.error(`[NewsAgent] Search error for "${topic}":`, error);
        return [];
    }
}

/**
 * Use Gemini LLM to synthesize news articles into a structured summary.
 */
async function synthesizeWithLLM(
    topic: string,
    articles: ArticleResult[],
    geminiApiKey: string
): Promise<string> {
    if (articles.length === 0) {
        return `Aucun article récent trouvé pour "${topic}" au cours des dernières 24 heures.`;
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const articlesText = articles
        .map((a, i) => `${i + 1}. "${a.title}" (${a.source})\n   ${a.snippet}`)
        .join('\n\n');

    const prompt = `Tu es un analyste de veille technologique. Voici des articles récents (dernières 24 heures) sur le thème "${topic}".

Articles trouvés :
${articlesText}

Rédige une synthèse concise en français (3-5 paragraphes maximum) des principales nouveautés et tendances. 
La synthèse doit :
- Identifier les informations clés et les développements importants
- Être factuelle et informative
- Utiliser un ton professionnel mais accessible
- Mentionner les sources quand c'est pertinent

Ne mentionne pas que tu es une IA. Écris directement la synthèse.`;

    try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        return response.text();
    } catch (error) {
        console.error(`[NewsAgent] LLM synthesis error for "${topic}":`, error);
        return `Erreur lors de la synthèse pour "${topic}". Les articles sont listés ci-dessous.`;
    }
}

/**
 * Generate the full news digest for all interests.
 */
export async function generateDigest(
    googleApiKey: string,
    googleCx: string,
    geminiApiKey: string
): Promise<NewsDigest> {
    if (isGenerating) {
        return cachedDigest || {
            generatedAt: new Date().toISOString(),
            topics: [],
            status: 'generating',
        };
    }

    isGenerating = true;
    console.log('[NewsAgent] Starting digest generation...');

    try {
        const interests = loadInterests();
        if (interests.length === 0) {
            const digest: NewsDigest = {
                generatedAt: new Date().toISOString(),
                topics: [],
                status: 'error',
                error: 'Aucun centre d\'intérêt configuré. Ajoutez des thèmes dans config/interests.txt.',
            };
            cachedDigest = digest;
            return digest;
        }

        const topics: TopicDigest[] = [];

        for (const interest of interests) {
            console.log(`[NewsAgent] Processing: "${interest}"...`);

            // Search for articles
            const articles = await searchNews(interest, googleApiKey, googleCx);
            console.log(`[NewsAgent] Found ${articles.length} articles for "${interest}"`);

            // Synthesize with LLM
            const summary = await synthesizeWithLLM(interest, articles, geminiApiKey);

            topics.push({
                topic: interest,
                summary,
                articles,
                articleCount: articles.length,
            });

            // Small delay between queries to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const digest: NewsDigest = {
            generatedAt: new Date().toISOString(),
            topics,
            status: 'ready',
        };

        cachedDigest = digest;
        console.log('[NewsAgent] Digest generation complete!');
        return digest;
    } catch (error) {
        console.error('[NewsAgent] Digest generation failed:', error);
        const digest: NewsDigest = {
            generatedAt: new Date().toISOString(),
            topics: [],
            status: 'error',
            error: error instanceof Error ? error.message : 'Erreur inconnue',
        };
        cachedDigest = digest;
        return digest;
    } finally {
        isGenerating = false;
    }
}

/**
 * Get the cached digest, or null if none has been generated.
 */
export function getCachedDigest(): NewsDigest | null {
    return cachedDigest;
}

/**
 * Check if a digest is currently being generated.
 */
export function isDigestGenerating(): boolean {
    return isGenerating;
}
