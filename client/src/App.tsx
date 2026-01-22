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
import VideoGames from './VideoGames';
import Blog from './Blog';
import Auth from './Auth';

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
                onClick={() => isAdmin && toggleTodo(todo)}
            />

            {editingId === todo.id ? (
                <input
                    className="edit-input"
                    type="text"
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
    const [currentView, setCurrentView] = useState<'todos' | 'videogames' | 'blog'>('blog');

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
                    Jeux Vidéo
                </button>
            </div>

            {currentView === 'todos' ? (
                <>
                    {isAdmin && (
                        <form onSubmit={addTodo} className="input-container">
                            <input
                                type="text"
                                placeholder="Quelle tâche ajouter ?"
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
            ) : (
                <Blog authToken={auth?.token || ''} onAuthError={handleLogout} userRole={auth?.user?.role || 'user'} />
            )}
        </div>
    );
}
