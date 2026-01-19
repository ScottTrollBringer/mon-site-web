import React, { useState, useEffect } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface VideoGame {
    id: number;
    title: string;
    month: string;
    genre: string;
    why: string;
    position: number;
}

interface VideoGamesProps {
    authToken: string;
    onAuthError: () => void;
    userRole: string;
}

const MONTHS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

interface SortableGameProps {
    game: VideoGame;
    onEdit: (game: VideoGame) => void;
    onDelete: (id: number) => void;
    isAdmin: boolean; // Added isAdmin prop
}

function SortableGame({ game, onEdit, onDelete, isAdmin }: SortableGameProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: game.id, disabled: !isAdmin }); // Disable sorting if not admin

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 100 : 'auto',
    };

    return (
        <div ref={setNodeRef} style={style} className="game-card">
            <div className="game-header" {...(isAdmin ? attributes : {})} {...(isAdmin ? listeners : {})} style={{ cursor: isAdmin ? 'grab' : 'default' }}>
                <span className="game-title">{game.title}</span>
                {isAdmin && (
                    <div className="game-actions">
                        <button className="action-btn edit-btn" onClick={() => onEdit(game)}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button className="action-btn delete-btn" onClick={() => onDelete(game.id)}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                )}
            </div>
            <div className="game-meta">
                <span className="badge badge-month">{game.month}</span>
                <span className="badge badge-genre">{game.genre}</span>
            </div>
            {game.why && <div className="game-why">{game.why}</div>}
        </div>
    );
}

export default function VideoGames({ authToken, onAuthError, userRole }: VideoGamesProps) {
    const [games, setGames] = useState<VideoGame[]>([]);
    const [title, setTitle] = useState('');
    const [month, setMonth] = useState('Janvier');
    const [genre, setGenre] = useState('');
    const [why, setWhy] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);

    const isAdmin = userRole === 'admin';

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        fetchGames();
    }, []);

    const fetchWithAuth = (url: string, options: RequestInit = {}) => {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        return fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                ...headers,
            },
        });
    };

    const fetchGames = async () => {
        const res = await fetchWithAuth('/api/videogames');
        if (res.ok) {
            const data = await res.json();
            setGames(data);
        } else if (res.status === 401) {
            onAuthError();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        if (!isAdmin) return;
        e.preventDefault();
        if (!title.trim() || !genre.trim()) return;

        const url = editingId ? `/api/videogames/${editingId}` : '/api/videogames';
        const method = editingId ? 'PUT' : 'POST';

        const res = await fetchWithAuth(url, {
            method,
            body: JSON.stringify({ title, month, genre, why }),
        });

        if (res.ok) {
            setTitle('');
            setGenre('');
            setWhy('');
            setMonth('Janvier');
            setEditingId(null);
            fetchGames();
        }
    };

    const deleteGame = async (id: number) => {
        if (!isAdmin) return;
        const res = await fetchWithAuth(`/api/videogames/${id}`, {
            method: 'DELETE',
        });
        if (res.ok) {
            fetchGames();
        }
    };

    const startEdit = (game: VideoGame) => {
        if (!isAdmin) return;
        setEditingId(game.id);
        setTitle(game.title);
        setMonth(game.month);
        setGenre(game.genre);
        setWhy(game.why);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        if (!isAdmin) return;
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = games.findIndex((g) => g.id === active.id);
            const newIndex = games.findIndex((g) => g.id === over.id);
            const newGames = arrayMove(games, oldIndex, newIndex);
            setGames(newGames);

            const res = await fetchWithAuth('/api/videogames/reorder', {
                method: 'POST',
                body: JSON.stringify({ ids: newGames.map((g) => g.id) }),
            });
            if (!res.ok) fetchGames();
        }
    };

    return (
        <div className="videogames-section">
            {isAdmin && (
                <form onSubmit={handleSubmit} className="game-form">
                    <input
                        type="text"
                        placeholder="Titre du jeu"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                    />
                    <div className="game-form-row">
                        <select value={month} onChange={(e) => setMonth(e.target.value)}>
                            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <input
                            type="text"
                            placeholder="Genre (ex: RPG)"
                            value={genre}
                            onChange={(e) => setGenre(e.target.value)}
                            required
                        />
                    </div>
                    <textarea
                        placeholder="Pourquoi ce jeu ? (Commentaire)"
                        value={why}
                        onChange={(e) => setWhy(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button type="submit" className="add-btn" style={{ flex: 1 }}>
                            {editingId ? 'Modifier' : 'Ajouter aux attentes'}
                        </button>
                        {editingId && (
                            <button
                                type="button"
                                className="nav-btn"
                                onClick={() => {
                                    setEditingId(null);
                                    setTitle('');
                                    setGenre('');
                                    setWhy('');
                                }}
                            >
                                Annuler
                            </button>
                        )}
                    </div>
                </form>
            )}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={games.map(g => g.id)} strategy={verticalListSortingStrategy}>
                    <div className="games-container">
                        {games.map((game) => (
                            <SortableGame key={game.id} game={game} onEdit={startEdit} onDelete={deleteGame} isAdmin={isAdmin} />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            {games.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>
                    {isAdmin ? 'Aucune attente enregistrée.' : "Aucune attente de l'administrateur."}
                </p>
            )}
        </div>
    );
}
