import React, { useState, useEffect } from 'react';
import ReactGA from 'react-ga4';
import { Helmet } from 'react-helmet-async';

ReactGA.initialize('G-5NBQJX8V6E');
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
import VideoGames from './VideoGames';
import Blog from './Blog';
import Gallery from './Gallery';
import GalleryImage from './GalleryImage';
import Auth from './Auth';
import GameRanking from './GameRanking';
import PaintingProjects from './PaintingProjects';
import PaintingProjectDetails from './PaintingProjectDetails';


interface Todo {
    id: number;
    description: string;
    completed: boolean;
    position: number;
}

interface SortableItemProps {
    todo: Todo;
    editingId: number | null;
    startEditing: (todo: Todo) => void;
    saveEdit: (id: number) => void;
    setEditText: (text: string) => void;
    editText: string;
    handleKeyDown: (e: React.KeyboardEvent, id: number) => void;
    toggleTodo: (todo: Todo) => void;
    deleteTodo: (id: number) => void;
    isAdmin: boolean;
}

function SortableItem({
    todo,
    editingId,
    startEditing,
    saveEdit,
    setEditText,
    editText,
    handleKeyDown,
    toggleTodo,
    deleteTodo,
    isAdmin,
}: SortableItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: todo.id, disabled: !isAdmin });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 100 : 'auto',
    };

    return (
        <li
            ref={setNodeRef}
            style={style}
            className={`todo-item ${todo.completed ? 'completed' : ''} ${isDragging ? 'dragging' : ''}`}
        >
            <div
                className={`checkbox ${todo.completed ? 'checked' : ''} ${!isAdmin ? 'disabled' : ''}`}
                role="checkbox"
                aria-checked={todo.completed}
                tabIndex={isAdmin ? 0 : -1}
                onClick={() => isAdmin && toggleTodo(todo)}
                onKeyDown={(e) => {
                    if (isAdmin && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        toggleTodo(todo);
                    }
                }}
            />

            {editingId === todo.id ? (
                <input
                    className="edit-input"
                    type="text"
                    aria-label="Modifier la tâche"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={() => saveEdit(todo.id)}
                    onKeyDown={(e) => handleKeyDown(e, todo.id)}
                    autoFocus
                />
            ) : (
                <span
                    className="todo-description"
                    onDoubleClick={() => isAdmin && startEditing(todo)}
                    {...(isAdmin ? attributes : {})}
                    {...(isAdmin ? listeners : {})}
                    style={{ cursor: isAdmin ? 'grab' : 'default' }}
                >
                    {todo.description}
                </span>
            )}

            {isAdmin && (
                <div className="item-actions">
                    {!editingId && (
                        <button
                            className="action-btn edit-btn"
                            aria-label="Modifier la tâche"
                            onClick={() => startEditing(todo)}
                            title="Edit task"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                    )}
                    <button
                        className="action-btn delete-btn"
                        aria-label="Supprimer la tâche"
                        onClick={() => deleteTodo(todo.id)}
                        title="Delete task"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            )}
        </li>
    );
}

export default function App() {
    // Gestion du routage par slug pour le blog et galerie
    const [currentView, setCurrentView] = useState<'todos' | 'videogames' | 'blog' | 'gallery' | 'gallery-image' | 'gameranking' | 'painting' | 'painting-project'>('blog');
    const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

    useEffect(() => {
        const handleLocationChange = () => {
            const path = window.location.pathname;
            if (path.startsWith('/blog/')) {
                setCurrentView('blog');
            } else if (path.startsWith('/gallery/')) {
                const parts = path.split('/');
                if (parts.length === 3) {
                    const id = parseInt(parts[2]);
                    if (!isNaN(id)) {
                        setSelectedImageId(id);
                        setCurrentView('gallery-image');
                    } else {
                        setCurrentView('gallery');
                    }
                } else {
                    setCurrentView('gallery');
                }
            } else if (path === '/gallery') {
                setCurrentView('gallery');
            } else if (path.startsWith('/painting-projects/')) {
                const parts = path.split('/');
                if (parts.length === 3) {
                    const id = parseInt(parts[2]);
                    if (!isNaN(id)) {
                        setSelectedProjectId(id);
                        setCurrentView('painting-project');
                    } else {
                        setCurrentView('painting');
                    }
                } else {
                    setCurrentView('painting');
                }
            } else if (path === '/painting-projects') {
                setCurrentView('painting');
            }
        };

        // Initial check
        handleLocationChange();

        // Listen for popstate
        window.addEventListener('popstate', handleLocationChange);
        return () => window.removeEventListener('popstate', handleLocationChange);
    }, []);

    const [metaDescription, setMetaDescription] = useState('Bienvenue sur Praetor Scott');
    const [pageTitle, setPageTitle] = useState('Praetor Scott');

    useEffect(() => {
        let path = window.location.pathname;
        let title = 'Praetor Scott';
        let description = "Ce site montre les photos des figurines que j'ai peintes, les jeux vidéos auxquels j'ai joués et les projets sur lesquels je travaille.";

        if (currentView === 'blog') {
            if (path === '/' || !path.startsWith('/blog/')) {
                path = '/blog';
                title = 'Blog - Praetor Scott';
                description = 'Le blog de Praetor Scott : retrouvez tous les derniers articles thématiques, réflexions et actualités.';
            }
            // Add specific blog article cases later if routing is updated.
        } else if (currentView === 'todos') {
            path = '/todos';
            title = 'Tâches - Praetor Scott';
            description = 'NoIndex'; // Will be handled to generate a noindex tag instead of a standard description.
        } else if (currentView === 'videogames') {
            path = '/videogames';
            title = 'Wishlist jeux vidéo - Praetor Scott';
            description = "Découvrez la page détaillant ma liste d'envie de jeux vidéo. Les meilleurs jeux auxquels je vais jouer.";
        } else if (currentView === 'gameranking') {
            path = '/gameranking';
            title = 'Classement jeux vidéo - Praetor Scott';
            description = "Je partage ici tous mes avis, ressentis et notes des jeux vidéo auxquels j'ai joué afin d'en faire un classement subjectif.";
        } else if (currentView === 'gallery') {
            path = '/gallery';
            title = 'Galerie - Praetor Scott';
            description = "Parcourez la galerie visuelle des figurines de Praetor Scott. Principalement du Warhammer 40K et de la fantasy type D&D, mais pas seulement.";
        } else if (currentView === 'gallery-image' && selectedImageId) {
            path = `/gallery/${selectedImageId}`;
            title = `Image Galerie ${selectedImageId} - Praetor Scott`;
            description = `Regardez la galerie d'image numéro ${selectedImageId} sur Praetor Scott.`;
        } else if (currentView === 'painting') {
            path = '/painting-projects';
            title = 'Projets de peinture - Praetor Scott';
            description = 'Voici mon portfolio complet dédié à la peinture de figurines. Tous les projets à venir et en cours.';
        } else if (currentView === 'painting-project' && selectedProjectId) {
            path = `/painting-projects/${selectedProjectId}`;
            title = `Projet Peinture ${selectedProjectId} - Praetor Scott`;
            description = `Découvrez tous les détails d'un de mes de projets de peinture numéro ${selectedProjectId}.`;
        }

        setMetaDescription(description);
        setPageTitle(title);
        ReactGA.send({ hitType: 'pageview', page: path, title });
    }, [currentView, selectedImageId, selectedProjectId]);

    const [auth, setAuth] = useState<{ token: string; user: { id: number; username: string; role: string } } | null>(() => {
        const saved = localStorage.getItem('auth');
        try {
            const parsed = saved ? JSON.parse(saved) : null;
            // Only return auth if it has a token
            if (parsed && parsed.token) {
                console.log('Auth loaded from localStorage:', parsed.user.username);
                return parsed;
            }
            return null;
        } catch (e) {
            console.error('Failed to parse auth from localStorage', e);
            localStorage.removeItem('auth');
            return null;
        }
    });


    const [todos, setTodos] = useState<Todo[]>([]);
    const [newTodo, setNewTodo] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editText, setEditText] = useState('');
    const [showAuth, setShowAuth] = useState(false);

    const isAdmin = auth?.user?.role === 'admin';

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        console.log('Auth state changed:', auth ? `Logged in as ${auth.user.username}` : 'Logged out');
        if (isAdmin) {
            fetchTodos();
        } else {
            setCurrentView('blog');
            setTodos([]);
        }
    }, [auth, isAdmin]);

    useEffect(() => {
        console.log('showAuth changed:', showAuth);
    }, [showAuth]);

    const handleLogin = (token: string, user: { id: number; username: string; role: string }) => {
        const authData = { token, user };
        setAuth(authData);
        localStorage.setItem('auth', JSON.stringify(authData));
        setShowAuth(false);
    };

    const handleLogout = () => {
        setAuth(null);
        localStorage.removeItem('auth');
        setTodos([]);
    };

    const fetchWithAuth = (url: string, options: RequestInit = {}) => {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (auth?.token) {
            headers['Authorization'] = `Bearer ${auth.token}`;
        }
        return fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                ...headers,
            },
        });
    };

    const fetchTodos = async () => {
        const res = await fetchWithAuth('/api/todos');
        if (res.ok) {
            const data = await res.json();
            setTodos(data);
        } else if (res.status === 401 && auth) {
            handleLogout();
        }
    };

    const addTodo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTodo.trim()) return;

        const res = await fetchWithAuth('/api/todos', {
            method: 'POST',
            body: JSON.stringify({ description: newTodo }),
        });

        if (res.ok) {
            setNewTodo('');
            fetchTodos();
        } else {
            const error = await res.json();
            alert(`Erreur d'ajout: ${error.error || 'Erreur inconnue'}`);
        }
    };

    const toggleTodo = async (todo: Todo) => {
        const res = await fetchWithAuth(`/api/todos/${todo.id}`, {
            method: 'PUT',
            body: JSON.stringify({ completed: !todo.completed }),
        });

        if (res.ok) {
            fetchTodos();
        }
    };

    const startEditing = (todo: Todo) => {
        setEditingId(todo.id);
        setEditText(todo.description);
    };

    const saveEdit = async (id: number) => {
        if (!editText.trim()) {
            setEditingId(null);
            return;
        }

        const res = await fetchWithAuth(`/api/todos/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ description: editText }),
        });

        if (res.ok) {
            setEditingId(null);
            fetchTodos();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, id: number) => {
        if (e.key === 'Enter') saveEdit(id);
        if (e.key === 'Escape') setEditingId(null);
    };

    const deleteTodo = async (id: number) => {
        const res = await fetchWithAuth(`/api/todos/${id}`, {
            method: 'DELETE',
        });

        if (res.ok) {
            fetchTodos();
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        if (!isAdmin) return;
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = todos.findIndex((t) => t.id === active.id);
            const newIndex = todos.findIndex((t) => t.id === over.id);

            const newTodos = arrayMove(todos, oldIndex, newIndex);
            setTodos(newTodos);

            const res = await fetchWithAuth('/api/todos/reorder', {
                method: 'POST',
                body: JSON.stringify({ ids: newTodos.map((t) => t.id) }),
            });

            if (!res.ok) {
                fetchTodos();
            }
        }
    };

    return (
        <div className="app-container">
            <Helmet>
                <title>{pageTitle}</title>
                {metaDescription === 'NoIndex' ? (
                    <meta name="robots" content="noindex" />
                ) : (
                    <meta name="description" content={metaDescription} />
                )}
            </Helmet>

            <div className="user-header">
                {auth ? (
                    <>
                        <span>👤 <strong>{auth.user?.username || 'Utilisateur'}</strong> ({auth.user?.role || 'user'})</span>
                        <span className="logout-link" onClick={handleLogout}>Déconnexion</span>
                    </>
                ) : (
                    <span className="login-link" onClick={() => setShowAuth(true)}>🔑 Connexion</span>
                )}
            </div>

            {showAuth && (
                <div className="modal-overlay">
                    <Auth onLogin={handleLogin} onCancel={() => setShowAuth(false)} />
                </div>
            )}

            <h1>Praetor Scott</h1>

            <div className="nav-tabs">
                <button
                    className={`nav-btn ${currentView === 'blog' ? 'active' : ''}`}
                    onClick={() => setCurrentView('blog')}
                >
                    Blog
                </button>
                {isAdmin && (
                    <button
                        className={`nav-btn ${currentView === 'todos' ? 'active' : ''}`}
                        onClick={() => setCurrentView('todos')}
                    >
                        Tâches
                    </button>
                )}
                <button
                    className={`nav-btn ${currentView === 'videogames' ? 'active' : ''}`}
                    onClick={() => setCurrentView('videogames')}
                >
                    Wishlist jeux vidéo
                </button>
                <button
                    className={`nav-btn ${currentView === 'gallery' ? 'active' : ''}`}
                    onClick={() => setCurrentView('gallery')}
                >
                    Galerie
                </button>
                <button
                    className={`nav-btn ${currentView === 'gameranking' ? 'active' : ''}`}
                    onClick={() => setCurrentView('gameranking')}
                >
                    Classement jeux vidéo
                </button>
                <button
                    className={`nav-btn ${currentView === 'painting' ? 'active' : ''}`}
                    onClick={() => setCurrentView('painting')}
                >
                    Projets de peinture
                </button>

            </div>

            {currentView === 'todos' ? (
                <>
                    {isAdmin && (
                        <form onSubmit={addTodo} className="input-container">
                            <input
                                type="text"
                                placeholder="Quelle tâche ajouter ?"
                                aria-label="Nouvelle tâche"
                                value={newTodo}
                                onChange={(e) => setNewTodo(e.target.value)}
                            />
                            <button type="submit" className="add-btn">Ajouter</button>
                        </form>
                    )}

                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={todos.map((t) => t.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <ul className="todo-list">
                                {todos.map((todo) => (
                                    <SortableItem
                                        key={todo.id}
                                        todo={todo}
                                        editingId={editingId}
                                        startEditing={startEditing}
                                        saveEdit={saveEdit}
                                        setEditText={setEditText}
                                        editText={editText}
                                        handleKeyDown={handleKeyDown}
                                        toggleTodo={toggleTodo}
                                        deleteTodo={deleteTodo}
                                        isAdmin={isAdmin}
                                    />
                                ))}
                            </ul>
                        </SortableContext>
                    </DndContext>

                    {todos.length === 0 && (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>
                            {isAdmin ? 'Aucune tâche pour le moment.' : "Aucune tâche de l'administrateur."}
                        </p>
                    )}
                </>
            ) : currentView === 'videogames' ? (
                <VideoGames authToken={auth?.token || ''} onAuthError={handleLogout} userRole={auth?.user?.role || 'user'} />
            ) : currentView === 'gallery' ? (
                <Gallery
                    authToken={auth?.token || ''}
                    userRole={auth?.user?.role || 'user'}
                    onNavigate={(id) => {
                        window.history.pushState(null, '', `/gallery/${id}`);
                        setSelectedImageId(id);
                        setCurrentView('gallery-image');
                    }}
                />
            ) : currentView === 'gallery-image' && selectedImageId ? (
                <GalleryImage
                    imageId={selectedImageId}
                    onBack={() => {
                        window.history.pushState(null, '', '/gallery');
                        setCurrentView('gallery');
                        setSelectedImageId(null);
                    }}
                />
            ) : currentView === 'painting-project' && selectedProjectId ? (
                <PaintingProjectDetails
                    projectId={selectedProjectId}
                    onBack={() => {
                        window.history.pushState(null, '', '/painting-projects');
                        setCurrentView('painting');
                        setSelectedProjectId(null);
                    }}
                />
            ) : currentView === 'gameranking' ? (
                <GameRanking authToken={auth?.token || ''} onAuthError={handleLogout} userRole={auth?.user?.role || 'user'} />
            ) : currentView === 'painting' ? (
                <PaintingProjects
                    authToken={auth?.token || ''}
                    onAuthError={handleLogout}
                    userRole={auth?.user?.role || 'user'}
                    onNavigate={(id) => {
                        window.history.pushState(null, '', `/painting-projects/${id}`);
                        setSelectedProjectId(id);
                        setCurrentView('painting-project');
                    }}
                />
            ) : currentView === 'painting-project' && selectedProjectId ? (
                <PaintingProjectDetails
                    projectId={selectedProjectId}
                    onBack={() => {
                        window.history.pushState(null, '', '/painting-projects');
                        setCurrentView('painting');
                        setSelectedProjectId(null);
                    }}
                />
            ) : (
                <Blog authToken={auth?.token || ''} onAuthError={handleLogout} userRole={auth?.user?.role || 'user'} />
            )}
        </div>
    );
}
