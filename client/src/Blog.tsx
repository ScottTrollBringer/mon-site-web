import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface BlogImage {
    id: number;
    filename: string;
}

interface BlogPost {
    id: number;
    title: string;
    slug: string;
    content: string;
    images: BlogImage[];
    createdAt: string;
    author: { username: string };
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

interface BlogProps {
    authToken: string;
    onAuthError: () => void;
    userRole: string;
}

export default function Blog({ authToken, onAuthError, userRole }: BlogProps) {
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [pagination, setPagination] = useState<Pagination>({
        page: 1, limit: 5, total: 0, totalPages: 0
    });
    const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
    const [slugView, setSlugView] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({ title: '', content: '' });
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);


    const isAdmin = userRole === 'admin';

    useEffect(() => {
        if (slugView) {
            fetchPostBySlug(slugView);
        } else {
            fetchPosts();
        }
    }, [pagination.page, slugView]);

    // Permet la navigation directe par slug (pour App)
    useEffect(() => {
        if (window.location.pathname.startsWith('/blog/')) {
            const slug = window.location.pathname.replace('/blog/', '');
            if (slug) setSlugView(slug);
        }
    }, []);
    const fetchPostBySlug = async (slug: string) => {
        try {
            const res = await fetchWithAuth(`/api/blog/slug/${slug}`);
            if (res.ok) {
                const post = await res.json();
                setSelectedPost(post);
            } else {
                setSelectedPost(null);
            }
        } catch (error) {
            setSelectedPost(null);
        }
    };

    // Handle ESC key to close lightbox
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setFullscreenImage(null);
        };

        if (fullscreenImage) {
            window.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [fullscreenImage]);

    const fetchWithAuth = (url: string, options: RequestInit = {}) => {
        const headers: Record<string, string> = {};
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        // Don't set Content-Type for FormData - browser will set it with boundary
        const isFormData = options.body instanceof FormData;
        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }
        return fetch(url, {
            ...options,
            headers: { ...headers, ...options.headers },
        });
    };

    const fetchPosts = async () => {
        try {
            const res = await fetchWithAuth(`/api/blog?page=${pagination.page}&limit=5`);
            if (res.ok) {
                const data = await res.json();
                setPosts(data.posts);
                setPagination(data.pagination);
            } else if (res.status === 401 && authToken) {
                onAuthError();
            }
        } catch (error) {
            console.error('Failed to fetch posts:', error);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Submitting post:', formData);

        if (!formData.title.trim() || !formData.content.trim()) {
            alert('Veuillez remplir le titre et le contenu.');
            return;
        }

        const form = new FormData();
        form.append('title', formData.title);
        form.append('content', formData.content);
        if (selectedFiles.length > 0) {
            console.log(`Appending ${selectedFiles.length} images to upload.`);
            selectedFiles.forEach(file => form.append('images', file));
        }

        console.log('Sending request to /api/blog');
        try {
            const res = await fetchWithAuth('/api/blog', {
                method: 'POST',
                body: form,
            });
            console.log('Response status:', res.status);

            if (res.ok) {
                const newPost = await res.json();
                console.log('Post created:', newPost);
                
                // Reset form
                setFormData({ title: '', content: '' });
                setSelectedFiles([]);
                setIsCreating(false);
                setSlugView(null);
                setSelectedPost(null);

                alert('Article publié avec succès !');
                window.history.pushState({}, '', '/blog');
                await fetchPosts();
            } else {
                const error = await res.json();
                console.error('Server error:', error);
                alert(`Erreur de création: ${error.error}${error.details ? `\nDétails: ${error.details}` : ''}`);
            }
        } catch (error: any) {
            console.error('Failed to create post:', error);
            alert(`Erreur réseau: ${error.message}`);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPost) return;

        try {
            const res = await fetchWithAuth(`/api/blog/${selectedPost.id}`, {
                method: 'PUT',
                body: JSON.stringify({ title: formData.title, content: formData.content }),
            });
            if (res.ok) {
                setIsEditing(false);
                setSelectedPost(null);
                fetchPosts();
            }
        } catch (error) {
            console.error('Failed to update post:', error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cet article ?')) return;

        try {
            const res = await fetchWithAuth(`/api/blog/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setSelectedPost(null);
                fetchPosts();
            }
        } catch (error) {
            console.error('Failed to delete post:', error);
        }
    };

    const handleDeleteImage = async (imageId: number) => {
        try {
            const res = await fetchWithAuth(`/api/blog/images/${imageId}`, { method: 'DELETE' });
            if (res.ok && selectedPost) {
                setSelectedPost({
                    ...selectedPost,
                    images: selectedPost.images.filter(img => img.id !== imageId)
                });
            }
        } catch (error) {
            console.error('Failed to delete image:', error);
        }
    };

    const handleUploadImages = async () => {
        if (!selectedPost || selectedFiles.length === 0) return;

        const form = new FormData();
        selectedFiles.forEach(file => form.append('images', file));

        try {
            const res = await fetchWithAuth(`/api/blog/${selectedPost.id}/images`, {
                method: 'POST',
                body: form,
            });
            if (res.ok) {
                const updatedPost = await res.json();
                setSelectedPost(updatedPost);
                setSelectedFiles([]);
            }
        } catch (error) {
            console.error('Failed to upload images:', error);
        }
    };

    const startEdit = (post: BlogPost) => {
        setSelectedPost(post);
        setFormData({ title: post.title, content: post.content });
        setIsEditing(true);
    };

    const getExcerpt = (content: string) => {
        const lines = content.split('\n').slice(0, 2);
        const excerpt = lines.join(' ');
        return excerpt.length > 150 ? excerpt.slice(0, 150) + '...' : excerpt;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
    };

    // --- Render Logic ---

    return (
        <div className="blog-container">
            {selectedPost && !isEditing ? (
                <>
                    <button className="back-btn" onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPost(null);
                        setSlugView(null);
                        setFullscreenImage(null);
                        window.history.pushState({}, '', '/');
                    }}>
                        ← Retour aux articles
                    </button>
                    <article className="blog-full">
                        <h2 className="blog-full-title">{selectedPost.title}</h2>
                        <div style={{ fontSize: '0.9em', color: '#888' }}>URL : /blog/{selectedPost.slug}</div>
                        <div className="blog-meta">
                            <span className="badge badge-date">{formatDate(selectedPost.createdAt)}</span>
                            <span className="badge badge-author">Par {selectedPost.author.username}</span>
                        </div>
                        <div className="blog-content">
                            {selectedPost.content.split('\n').map((para, i) => (
                                <p key={i}>{para}</p>
                            ))}
                        </div>
                        {selectedPost.images.length > 0 && (
                            <div className="blog-images">
                                {selectedPost.images.map(img => (
                                    <div key={img.id} className="blog-image-container">
                                        <img
                                            src={`/uploads/blog/${img.filename}`}
                                            alt=""
                                            className="blog-image"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                console.log('Image clicked:', img.filename);
                                                setFullscreenImage(img.filename);
                                            }}
                                            style={{ cursor: 'zoom-in', pointerEvents: 'auto', position: 'relative', zIndex: 10 }}
                                        />
                                        {isAdmin && (
                                            <button
                                                className="image-delete-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteImage(img.id);
                                                }}
                                            >×</button>
                                        )}

                                    </div>
                                ))}
                            </div>
                        )}
                        {isAdmin && (
                            <div className="blog-admin-actions">
                                <div className="image-upload-section">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        multiple
                                        accept="image/*"
                                        onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                                        style={{ display: 'none' }}
                                    />
                                    <button
                                        className="upload-btn"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        📷 Ajouter des images ({selectedFiles.length})
                                    </button>
                                    {selectedFiles.length > 0 && (
                                        <button className="upload-btn" onClick={handleUploadImages}>
                                            ⬆️ Uploader
                                        </button>
                                    )}
                                </div>
                                <div className="action-buttons">
                                    <button className="edit-action-btn" onClick={() => startEdit(selectedPost)}>
                                        ✏️ Modifier
                                    </button>
                                    <button className="delete-action-btn" onClick={() => handleDelete(selectedPost.id)}>
                                        🗑️ Supprimer
                                    </button>
                                </div>
                            </div>
                        )}
                    </article>
                </>
            ) : isEditing && selectedPost ? (
                <>
                    <button className="back-btn" onClick={() => { setIsEditing(false); setSelectedPost(null); }}>
                        ← Annuler
                    </button>
                    <form onSubmit={handleUpdate} className="blog-form">
                        <h2>Modifier l'article</h2>
                        <input
                            type="text"
                            placeholder="Titre de l'article"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="blog-input"
                        />
                        <textarea
                            placeholder="Contenu de l'article..."
                            value={formData.content}
                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            className="blog-textarea"
                            rows={10}
                        />
                        <button type="submit" className="add-btn">Enregistrer</button>
                    </form>
                </>
            ) : isCreating ? (
                <>
                    <button className="back-btn" onClick={() => setIsCreating(false)}>
                        ← Annuler
                    </button>
                    <form onSubmit={handleCreate} className="blog-form">
                        <h2>Nouvel article</h2>
                        <input
                            type="text"
                            placeholder="Titre de l'article"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="blog-input"
                        />
                        <textarea
                            placeholder="Contenu de l'article..."
                            value={formData.content}
                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            className="blog-textarea"
                            rows={10}
                        />
                        <div className="image-upload-section">
                            <input
                                type="file"
                                ref={fileInputRef}
                                multiple
                                accept="image/*"
                                onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                                style={{ display: 'none' }}
                            />
                            <button
                                type="button"
                                className="upload-btn"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                📷 Ajouter des images ({selectedFiles.length})
                            </button>
                        </div>
                        <button type="submit" className="add-btn">Publier</button>
                    </form>
                </>

            ) : (
                <>
                    {isAdmin && (
                        <button className="add-btn new-post-btn" onClick={() => setIsCreating(true)}>
                            + Nouvel article
                        </button>
                    )}

                    <div className="blog-list">
                        {posts.map(post => (
                            <article key={post.id} className="blog-card">
                                <h3
                                    className="blog-title"
                                    onClick={() => {
                                        setSelectedPost(post);
                                        setSlugView(post.slug);
                                        window.history.pushState({}, '', `/blog/${post.slug}`);
                                    }}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {post.title}
                                </h3>
                                <div className="blog-meta">
                                    <span className="badge badge-date">{formatDate(post.createdAt)}</span>
                                </div>
                                <p className="blog-excerpt">{getExcerpt(post.content)}</p>
                                {post.images.length > 0 && (
                                    <span className="image-count">📷 {post.images.length} image(s)</span>
                                )}
                            </article>
                        ))}
                    </div>

                    {posts.length === 0 && (
                        <p className="empty-message">Aucun article pour le moment.</p>
                    )}

                    {pagination.totalPages > 1 && (
                        <div className="pagination">
                            <button
                                className="pagination-btn"
                                disabled={pagination.page <= 1}
                                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                            >
                                ← Précédent
                            </button>
                            <span className="pagination-info">
                                Page {pagination.page} / {pagination.totalPages}
                            </span>
                            <button
                                className="pagination-btn"
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                            >
                                Suivant →
                            </button>
                        </div>
                    )}
                </>
            )}

            {fullscreenImage && createPortal(
                <div className="lightbox-overlay" onClick={() => setFullscreenImage(null)}>
                    <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
                        <img
                            src={`/uploads/blog/${fullscreenImage}`}
                            alt="Plein écran"
                            className="lightbox-image"
                        />
                    </div>
                    <button className="lightbox-close" onClick={() => setFullscreenImage(null)}>×</button>
                </div>,
                document.body
            )}
        </div>
    );
}

