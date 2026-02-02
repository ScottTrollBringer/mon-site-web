
import React, { useState, useEffect } from 'react';

interface PaintingImage {
    id: number;
    filename: string;
}

interface PaintingProject {
    id: number;
    title: string;
    status: string;
    description: string;
    images: PaintingImage[];
}

interface PaintingProjectsProps {
    authToken: string;
    userRole: string;
    onAuthError: () => void;
}

export default function PaintingProjects({ authToken, userRole, onAuthError }: PaintingProjectsProps) {
    const [projects, setProjects] = useState<PaintingProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Form state
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [title, setTitle] = useState('');
    const [status, setStatus] = useState('En cours');
    const [description, setDescription] = useState('');
    const [files, setFiles] = useState<FileList | null>(null);

    const isAdmin = userRole === 'admin';

    const fetchProjects = async () => {
        try {
            const res = await fetch('/api/painting-projects');
            if (res.ok) {
                const data = await res.json();
                setProjects(data);
            } else {
                setError('Failed to load projects');
            }
        } catch (err) {
            setError('Error loading projects');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (editingId) {
            // Update existing project (metadata only)
            try {
                const res = await fetch(`/api/painting-projects/${editingId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ title, status, description })
                });

                if (res.ok) {
                    await uploadImages(editingId); // Upload new images if any
                    resetForm();
                    fetchProjects();
                } else {
                    handleError(res);
                }
            } catch (err) {
                setError('Network error');
            }
        } else {
            // Create new project with images
            const formData = new FormData();
            formData.append('title', title);
            formData.append('status', status);
            formData.append('description', description);

            if (files) {
                Array.from(files).forEach(file => {
                    formData.append('images', file);
                });
            }

            try {
                const res = await fetch('/api/painting-projects', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: formData
                });

                if (res.ok) {
                    resetForm();
                    fetchProjects();
                } else {
                    handleError(res);
                }
            } catch (err) {
                setError('Network error');
            }
        }
    };

    const uploadImages = async (projectId: number) => {
        if (!files || files.length === 0) return;

        const formData = new FormData();
        Array.from(files).forEach(file => {
            formData.append('images', file);
        });

        try {
            const res = await fetch(`/api/painting-projects/${projectId}/images`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                },
                body: formData
            });

            if (!res.ok) handleError(res);
        } catch (err) {
            console.error('Failed to upload images', err);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this project?')) return;

        try {
            const res = await fetch(`/api/painting-projects/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (res.ok) {
                fetchProjects();
            } else {
                handleError(res);
            }
        } catch (err) {
            setError('Network error');
        }
    };

    const handleDeleteImage = async (imageId: number) => {
        if (!confirm('Delete this image?')) return;

        try {
            const res = await fetch(`/api/painting-projects/images/${imageId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (res.ok) {
                fetchProjects();
            } else {
                handleError(res);
            }
        } catch (err) {
            setError('Network error');
        }
    };

    const handleEdit = (project: PaintingProject) => {
        setIsEditing(true);
        setEditingId(project.id);
        setTitle(project.title);
        setStatus(project.status);
        setDescription(project.description);
        setFiles(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = () => {
        setIsEditing(false);
        setEditingId(null);
        setTitle('');
        setStatus('En cours');
        setDescription('');
        setFiles(null);
    };

    const handleError = async (res: Response) => {
        if (res.status === 401) onAuthError();
        else {
            const data = await res.json();
            setError(data.error || 'Operation failed');
        }
    };

    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const openLightbox = (filename: string) => {
        setSelectedImage(filename);
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    };

    const closeLightbox = () => {
        setSelectedImage(null);
        document.body.style.overflow = 'auto'; // Restore scrolling
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="painting-projects-container">
            <h2>Projets de Peinture</h2>

            {error && <div className="error-message">{error}</div>}

            {isAdmin && (
                <div className="admin-actions">
                    <button
                        className="toggle-form-btn"
                        onClick={() => setIsEditing(!isEditing)}
                    >
                        {isEditing ? 'Fermer le formulaire' : 'Ajouter un projet'}
                    </button>

                    {isEditing && (
                        <form onSubmit={handleSubmit} className="project-form">
                            <h3>{editingId ? 'Modifier le projet' : 'Nouveau Projet'}</h3>
                            <div className="form-group">
                                <input
                                    type="text"
                                    placeholder="Titre"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <select value={status} onChange={e => setStatus(e.target.value)}>
                                    <option value="En cours">En cours</option>
                                    <option value="Prochainement">Prochainement</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <textarea
                                    placeholder="Description"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    required
                                    rows={4}
                                />
                            </div>
                            <div className="form-group">
                                <label>Ajouter des images (converties en AVIF):</label>
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={e => setFiles(e.target.files)}
                                />
                            </div>
                            <div className="form-actions">
                                <button type="submit" className="save-btn">
                                    {editingId ? 'Sauvegarder' : 'Créer'}
                                </button>
                                <button type="button" onClick={resetForm} className="cancel-btn">
                                    Annuler
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            <div className="projects-grid">
                {projects.map(project => (
                    <div key={project.id} className="project-card">
                        <div className="project-header">
                            <h3>{project.title}</h3>
                            <span className={`status-badge ${project.status === 'En cours' ? 'in-progress' : 'upcoming'}`}>
                                {project.status}
                            </span>
                        </div>

                        <p className="project-description">{project.description}</p>

                        <div className="project-images">
                            {project.images.map(img => (
                                <div key={img.id} className="image-wrapper">
                                    <img
                                        src={`/uploads/painting/${img.filename}`}
                                        alt="Project"
                                        onClick={() => openLightbox(img.filename)}
                                        className="clickable-image"
                                    />
                                    {isAdmin && isEditing && editingId === project.id && (
                                        <button
                                            className="delete-img-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteImage(img.id);
                                            }}
                                            title="Supprimer l'image"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {isAdmin && (
                            <div className="card-actions">
                                <button onClick={() => handleEdit(project)} className="edit-btn">Modifier</button>
                                <button onClick={() => handleDelete(project.id)} className="delete-btn">Supprimer</button>
                            </div>
                        )}
                    </div>
                ))}
                {projects.length === 0 && <p className="no-data">Aucun projet pour le moment.</p>}
            </div>

            {selectedImage && (
                <div className="lightbox-overlay" onClick={closeLightbox}>
                    <div className="lightbox-content" onClick={e => e.stopPropagation()}>
                        <button className="lightbox-close" onClick={closeLightbox}>×</button>
                        <img src={`/uploads/painting/${selectedImage}`} alt="Full size" />
                    </div>
                </div>
            )}

            <style>{`
                .painting-projects-container {
                    padding: 20px;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .project-form {
                    background: rgba(255, 255, 255, 0.1);
                    padding: 20px;
                    border-radius: 10px;
                    margin: 20px 0;
                    backdrop-filter: blur(10px);
                }
                .form-group { margin-bottom: 15px; }
                .form-group input, .form-group textarea, .form-group select {
                    width: 100%;
                    padding: 10px;
                    border-radius: 5px;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    background: rgba(0, 0, 0, 0.2);
                    color: white;
                }
                .form-group select option { background: #333; }
                
                .toggle-form-btn, .save-btn, .cancel-btn {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                    color: white;
                }
                .toggle-form-btn { background: #6e8efb; margin-bottom: 10px; }
                .save-btn { background: #4caf50; }
                .cancel-btn { background: #f44336; margin-left: 10px; }

                .projects-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 20px;
                    margin-top: 20px;
                }
                .project-card {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 10px;
                    padding: 20px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .project-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }
                .project-header h3 { margin: 0; font-size: 1.2rem; }
                .status-badge {
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 0.8rem;
                    font-weight: bold;
                }
                .in-progress { background: #ff9800; color: black; }
                .upcoming { background: #2196f3; color: white; }
                
                .project-description {
                    color: #ddd;
                    margin-bottom: 15px;
                    white-space: pre-wrap;
                }
                
                .project-images {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    margin-bottom: 15px;
                }
                .image-wrapper {
                    position: relative;
                    width: 100px;
                    height: 100px;
                }
                .image-wrapper img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    border-radius: 5px;
                }
                .clickable-image {
                    cursor: zoom-in;
                    transition: transform 0.2s;
                }
                .clickable-image:hover {
                    transform: scale(1.05);
                }

                .delete-img-btn {
                    position: absolute;
                    top: -5px;
                    right: -5px;
                    background: red;
                    color: white;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    z-index: 2;
                }

                .card-actions {
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    padding-top: 15px;
                    display: flex;
                    gap: 10px;
                }
                .edit-btn { background: #666; }
                .delete-btn { background: #d32f2f; }
                
                .no-data { text-align: center; grid-column: 1 / -1; color: #999; }

                /* Lightbox styles */
                .lightbox-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.9);
                    z-index: 1000;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    animation: fadeIn 0.3s ease;
                }
                .lightbox-content {
                    position: relative;
                    max-width: 90%;
                    max-height: 90vh;
                }
                .lightbox-content img {
                    max-width: 100%;
                    max-height: 90vh;
                    border-radius: 5px;
                    box-shadow: 0 0 20px rgba(0,0,0,0.5);
                }
                .lightbox-close {
                    position: absolute;
                    top: -40px;
                    right: -40px;
                    background: none;
                    border: none;
                    color: white;
                    font-size: 2rem;
                    cursor: pointer;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .lightbox-close:hover {
                    color: #ff4444;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
}
