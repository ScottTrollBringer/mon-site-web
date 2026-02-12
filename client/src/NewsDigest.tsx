import React, { useState, useEffect, useCallback } from 'react';

interface ArticleResult {
    title: string;
    link: string;
    snippet: string;
    source: string;
    date?: string;
}

interface TopicDigest {
    topic: string;
    summary: string;
    articles: ArticleResult[];
    articleCount: number;
}

interface NewsDigestData {
    generatedAt: string | null;
    topics: TopicDigest[];
    status: 'ready' | 'generating' | 'error' | 'empty';
    message?: string;
    error?: string;
}

interface Props {
    authToken: string;
    onAuthError: () => void;
    userRole: string;
}

// Map topics to emoji icons
function getTopicIcon(topic: string): string {
    const lower = topic.toLowerCase();
    if (lower.includes('intelligence artificielle') || lower.includes('ia') || lower.includes('ai')) return '🤖';
    if (lower.includes('warhammer')) return '⚔️';
    if (lower.includes('jeux vidéo') || lower.includes('video game') || lower.includes('gaming')) return '🎮';
    if (lower.includes('cyber') || lower.includes('sécurité') || lower.includes('security')) return '🔒';
    if (lower.includes('space') || lower.includes('espace') || lower.includes('nasa')) return '🚀';
    if (lower.includes('climat') || lower.includes('environment') || lower.includes('climate')) return '🌍';
    if (lower.includes('crypto') || lower.includes('bitcoin') || lower.includes('blockchain')) return '💰';
    if (lower.includes('sport')) return '⚽';
    if (lower.includes('science')) return '🔬';
    if (lower.includes('politique') || lower.includes('politic')) return '🏛️';
    return '📰';
}

export default function NewsDigest({ authToken, onAuthError, userRole }: Props) {
    const [digest, setDigest] = useState<NewsDigestData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedTopics, setExpandedTopics] = useState<Set<number>>(new Set());
    const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);

    const isAdmin = userRole === 'admin';

    const fetchDigest = useCallback(async () => {
        try {
            const headers: Record<string, string> = {};
            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }
            const res = await fetch('/api/news-digest', { headers });
            if (res.status === 401) {
                onAuthError();
                return;
            }
            if (res.ok) {
                const data = await res.json();
                setDigest(data);

                // Stop polling if generation is done
                if (data.status !== 'generating' && pollInterval) {
                    clearInterval(pollInterval);
                    setPollInterval(null);
                    setRefreshing(false);
                }
            }
        } catch (error) {
            console.error('Failed to fetch news digest:', error);
        } finally {
            setLoading(false);
        }
    }, [authToken, onAuthError, pollInterval]);

    useEffect(() => {
        fetchDigest();
    }, [fetchDigest]);

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [pollInterval]);

    const handleRefresh = async () => {
        setRefreshing(true);

        try {
            const res = await fetch('/api/news-digest/refresh', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (res.status === 401) {
                onAuthError();
                return;
            }

            if (res.ok) {
                // Start polling to check for completion
                const interval = setInterval(() => fetchDigest(), 3000);
                setPollInterval(interval);

                // Also update immediately
                setDigest(prev => prev ? { ...prev, status: 'generating' } : null);
            } else {
                const error = await res.json();
                alert(error.error || 'Erreur lors du rafraîchissement');
                setRefreshing(false);
            }
        } catch (error) {
            console.error('Refresh error:', error);
            alert('Erreur de connexion au serveur');
            setRefreshing(false);
        }
    };

    const toggleTopic = (index: number) => {
        setExpandedTopics(prev => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getTimeSince = (dateStr: string) => {
        const now = new Date();
        const generated = new Date(dateStr);
        const diffMs = now.getTime() - generated.getTime();
        const diffMinutes = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMinutes / 60);

        if (diffMinutes < 1) return "à l'instant";
        if (diffMinutes < 60) return `il y a ${diffMinutes} min`;
        if (diffHours < 24) return `il y a ${diffHours}h`;
        return `il y a ${Math.floor(diffHours / 24)} jour(s)`;
    };

    if (loading) {
        return (
            <div className="news-digest">
                <div className="news-digest-loading">
                    <div className="news-loading-spinner" />
                    <p>Chargement du rapport de veille...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="news-digest">
            {/* Header */}
            <div className="news-digest-header">
                <div className="news-digest-title-row">
                    <div className="news-digest-title-block">
                        <h2 className="news-digest-title">📰 Rapport de Veille</h2>
                        {digest?.generatedAt && (
                            <div className="news-digest-meta">
                                <span className="news-digest-date">{formatDate(digest.generatedAt)}</span>
                                <span className="news-digest-freshness">{getTimeSince(digest.generatedAt)}</span>
                            </div>
                        )}
                    </div>
                    {isAdmin && (
                        <button
                            className="news-refresh-btn"
                            onClick={handleRefresh}
                            disabled={refreshing}
                        >
                            <span className={`news-refresh-icon ${refreshing ? 'spinning' : ''}`}>⟳</span>
                            {refreshing ? 'Génération...' : 'Rafraîchir'}
                        </button>
                    )}
                </div>
            </div>

            {/* Status Messages */}
            {digest?.status === 'generating' && (
                <div className="news-status-banner generating">
                    <div className="news-loading-spinner small" />
                    <span>Génération en cours... L'agent recherche et synthétise les actualités pour chaque thème.</span>
                </div>
            )}

            {digest?.status === 'error' && (
                <div className="news-status-banner error">
                    <span>⚠️ {digest.error || 'Une erreur est survenue lors de la génération.'}</span>
                </div>
            )}

            {(!digest || digest.status === 'empty') && !refreshing && (
                <div className="news-empty-state">
                    <div className="news-empty-icon">📭</div>
                    <h3>Aucun rapport disponible</h3>
                    <p>{digest?.message || 'Un administrateur doit déclencher la génération du premier rapport de veille.'}</p>
                </div>
            )}

            {/* Topic Cards */}
            {digest?.topics && digest.topics.length > 0 && (
                <div className="news-topics-grid">
                    {digest.topics.map((topic, index) => (
                        <div
                            key={index}
                            className={`news-topic-card ${expandedTopics.has(index) ? 'expanded' : ''}`}
                        >
                            <div
                                className="news-topic-header"
                                onClick={() => toggleTopic(index)}
                            >
                                <div className="news-topic-title-row">
                                    <span className="news-topic-icon">{getTopicIcon(topic.topic)}</span>
                                    <h3 className="news-topic-title">{topic.topic}</h3>
                                    <span className="news-topic-badge">{topic.articleCount} article{topic.articleCount !== 1 ? 's' : ''}</span>
                                </div>
                                <span className={`news-topic-chevron ${expandedTopics.has(index) ? 'rotated' : ''}`}>▼</span>
                            </div>

                            <div className="news-topic-content">
                                <div className="news-topic-summary">
                                    {topic.summary.split('\n').map((paragraph, pIndex) => (
                                        paragraph.trim() ? <p key={pIndex}>{paragraph}</p> : null
                                    ))}
                                </div>

                                {topic.articles.length > 0 && (
                                    <div className="news-articles-section">
                                        <h4 className="news-articles-heading">🔗 Sources</h4>
                                        <ul className="news-articles-list">
                                            {topic.articles.map((article, aIndex) => (
                                                <li key={aIndex} className="news-article-item">
                                                    <a
                                                        href={article.link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="news-article-link"
                                                    >
                                                        <span className="news-article-title">{article.title}</span>
                                                        <span className="news-article-source">{article.source}</span>
                                                    </a>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Footer info */}
            {digest?.topics && digest.topics.length > 0 && (
                <div className="news-digest-footer">
                    <p>
                        Rapport généré automatiquement par l'Agent IA de veille. Les synthèses sont produites par Google Gemini
                        à partir d'articles trouvés via Google Search.
                    </p>
                </div>
            )}
        </div>
    );
}
