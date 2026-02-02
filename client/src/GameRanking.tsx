
import React, { useState, useEffect } from 'react';

interface GameRanking {
    id: number;
    gameName: string;
    rating: number;
    genre: string;
    comment: string | null;
}

interface GameRankingProps {
    authToken: string;
    userRole: string;
    onAuthError: () => void;
}

export default function GameRanking({ authToken, userRole, onAuthError }: GameRankingProps) {
    const [rankings, setRankings] = useState<GameRanking[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Form state
    const [gameName, setGameName] = useState('');
    const [rating, setRating] = useState(10);
    const [genre, setGenre] = useState('');
    const [comment, setComment] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);

    const isAdmin = userRole === 'admin';

    const fetchRankings = async () => {
        try {
            const res = await fetch('/api/gamerankings');
            if (res.ok) {
                const data = await res.json();
                setRankings(data);
            } else {
                setError('Failed to load rankings');
            }
        } catch (err) {
            setError('Error loading rankings');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRankings();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const url = editingId
            ? `/api/gamerankings/${editingId}`
            : '/api/gamerankings';

        const method = editingId ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ gameName, rating: Number(rating), genre, comment })
            });

            if (res.ok) {
                setGameName('');
                setRating(10);
                setGenre('');
                setComment('');
                setEditingId(null);
                fetchRankings();
            } else {
                if (res.status === 401) {
                    onAuthError();
                } else {
                    const data = await res.json();
                    setError(data.error || 'Operation failed');
                }
            }
        } catch (err) {
            setError('Network error');
        }
    };

    const handleEdit = (ranking: GameRanking) => {
        setGameName(ranking.gameName);
        setRating(ranking.rating);
        setGenre(ranking.genre);
        setComment(ranking.comment || '');
        setEditingId(ranking.id);

        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this rating?')) return;

        try {
            const res = await fetch(`/api/gamerankings/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (res.ok) {
                fetchRankings();
            } else {
                if (res.status === 401) onAuthError();
                else setError('Failed to delete');
            }
        } catch (err) {
            setError('Network error');
        }
    };

    const cancelEdit = () => {
        setGameName('');
        setRating(10);
        setGenre('');
        setComment('');
        setEditingId(null);
    };

    // Sorting state
    const [sortConfig, setSortConfig] = useState<{ key: keyof GameRanking | null; direction: 'asc' | 'desc' }>({
        key: 'rating',
        direction: 'desc',
    });

    const handleSort = (key: keyof GameRanking) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedRankings = [...rankings].sort((a, b) => {
        if (!sortConfig.key) return 0;

        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === null || bValue === null) return 0;

        if (aValue < bValue) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    const getSortIndicator = (key: keyof GameRanking) => {
        if (sortConfig.key !== key) return '↕';
        return sortConfig.direction === 'asc' ? '↑' : '↓';
    };

    if (loading) return <div>Loading rankings...</div>;

    return (
        <div className="game-ranking-container">
            <h2>Classement jeux vidéo</h2>

            {error && <div className="error-message">{error}</div>}

            {isAdmin && (
                <form onSubmit={handleSubmit} className="ranking-form">
                    <h3>{editingId ? 'Modifier le classement' : 'Ajouter un classement'}</h3>
                    <div className="form-group">
                        <input
                            type="text"
                            placeholder="Nom du jeu"
                            value={gameName}
                            onChange={(e) => setGameName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <input
                            type="number"
                            min="1"
                            max="10"
                            placeholder="Note (1-10)"
                            value={rating}
                            onChange={(e) => setRating(Number(e.target.value))}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <input
                            type="text"
                            placeholder="Genre"
                            value={genre}
                            onChange={(e) => setGenre(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <textarea
                            placeholder="Commentaire (facultatif)"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                        />
                    </div>
                    <div className="form-actions">
                        <button type="submit" className="save-btn">
                            {editingId ? 'Mettre à jour' : 'Ajouter'}
                        </button>
                        {editingId && (
                            <button type="button" onClick={cancelEdit} className="cancel-btn">
                                Annuler
                            </button>
                        )}
                    </div>
                </form>
            )}

            <div className="ranking-table-container">
                <table className="ranking-table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('gameName')} className="sortable-header">
                                Jeu {getSortIndicator('gameName')}
                            </th>
                            <th onClick={() => handleSort('rating')} className="sortable-header">
                                Note {getSortIndicator('rating')}
                            </th>
                            <th onClick={() => handleSort('genre')} className="sortable-header">
                                Genre {getSortIndicator('genre')}
                            </th>
                            <th>Commentaire</th>
                            {isAdmin && <th>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedRankings.map((ranking) => (
                            <tr key={ranking.id}>
                                <td>{ranking.gameName}</td>
                                <td>
                                    <span className={`rating-badge rating-${ranking.rating}`}>
                                        {ranking.rating}/10
                                    </span>
                                </td>
                                <td>{ranking.genre}</td>
                                <td>{ranking.comment}</td>
                                {isAdmin && (
                                    <td>
                                        <button onClick={() => handleEdit(ranking)} className="icon-btn edit-btn" title="Modifier">
                                            ✏️
                                        </button>
                                        <button onClick={() => handleDelete(ranking.id)} className="icon-btn delete-btn" title="Supprimer">
                                            🗑️
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {sortedRankings.length === 0 && (
                            <tr>
                                <td colSpan={isAdmin ? 5 : 4} className="no-data">
                                    Aucun classement disponible.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <style>{`
                .game-ranking-container {
                    padding: 20px;
                    max-width: 1000px;
                    margin: 0 auto;
                }
                .ranking-form {
                    background: rgba(255, 255, 255, 0.1);
                    padding: 20px;
                    border-radius: 10px;
                    margin-bottom: 30px;
                    backdrop-filter: blur(10px);
                }
                .form-group {
                    margin-bottom: 15px;
                }
                .form-group input, .form-group textarea {
                    width: 100%;
                    padding: 10px;
                    border-radius: 5px;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    background: rgba(0, 0, 0, 0.2);
                    color: white;
                }
                .ranking-table {
                    width: 100%;
                    border-collapse: collapse;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 10px;
                    overflow: hidden;
                }
                .ranking-table th, .ranking-table td {
                    padding: 12px 15px;
                    text-align: left;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }
                .ranking-table th {
                    background: rgba(0, 0, 0, 0.3);
                    font-weight: bold;
                }
                .sortable-header {
                    cursor: pointer;
                    user-select: none;
                }
                .sortable-header:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
                .rating-badge {
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-weight: bold;
                    background: #444;
                }
                .rating-10, .rating-9 { background: #4caf50; color: black; }
                .rating-8, .rating-7 { background: #8bc34a; color: black; }
                .rating-6, .rating-5 { background: #ffc107; color: black; }
                .rating-4, .rating-3 { background: #ff9800; color: black; }
                .rating-2, .rating-1 { background: #f44336; color: white; }
                
                .icon-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 1.2em;
                    margin-right: 5px;
                }
                .save-btn, .cancel-btn {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                }
                .save-btn {
                    background: linear-gradient(135deg, #6e8efb, #a777e3);
                    color: white;
                }
                .cancel-btn {
                    background: #666;
                    color: white;
                    margin-left: 10px;
                }
                .no-data {
                    text-align: center;
                    padding: 20px;
                    color: #999;
                }
            `}</style>
        </div>
    );
}
