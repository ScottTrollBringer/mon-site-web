import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface Photo {
    id: number;
    name: string;
    tag: string;
    filename: string;
    width?: number;
    height?: number;
    createdAt: string;
}

interface GalleryProps {
    authToken: string;
    userRole: string;
}

export default function Gallery({ authToken, userRole }: GalleryProps) {
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [filterTag, setFilterTag] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [formData, setFormData] = useState({ name: '', tag: '' });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isAdmin = userRole === 'admin';

    useEffect(() => {
        fetchPhotos();
    }, []);

    const fetchPhotos = async () => {
        try {
            const res = await fetch('/api/photos');
            if (res.ok) {
                const data = await res.json();
                setPhotos(data);
            }
        } catch (error) {
            console.error('Failed to fetch photos:', error);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.tag || !selectedFile) {
            alert('Veuillez remplir tous les champs et sélectionner une image.');
            return;
        }

        const form = new FormData();
        form.append('name', formData.name);
        form.append('tag', formData.tag);
        form.append('photo', selectedFile);

        try {
            const res = await fetch('/api/photos', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                },
                body: form
            });

            if (res.ok) {
                const newPhoto = await res.json();
                setPhotos([newPhoto, ...photos]);
                setIsUploading(false);
                setFormData({ name: '', tag: '' });
                setSelectedFile(null);
                alert('Photo ajoutée avec succès !');
            } else {
                const error = await res.json();
                alert(`Erreur: ${error.message || 'Upload failed'}`);
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Erreur lors de l\'upload');
        }
    };

    const uniqueTags = Array.from(new Set(photos.map(p => p.tag)));
    const filteredPhotos = filterTag ? photos.filter(p => p.tag === filterTag) : photos;

    return (
        <div className="gallery-container">
            <div className="gallery-header">
                <h1>Galerie Photo</h1>
                {isAdmin && (
                    <button className="add-btn" onClick={() => setIsUploading(!isUploading)}>
                        {isUploading ? 'Annuler' : '+ Ajouter une photo'}
                    </button>
                )}
            </div>

            {isUploading && (
                <form onSubmit={handleUpload} className="gallery-upload-form">
                    <h3>Nouvelle Photo</h3>
                    <div className="form-group">
                        <input
                            type="text"
                            placeholder="Nom de la photo"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="gallery-input"
                        />
                    </div>
                    <div className="form-group">
                        <input
                            type="text"
                            placeholder="Tag (ex: SciFi, Fantasy)"
                            value={formData.tag}
                            onChange={e => setFormData({ ...formData, tag: e.target.value })}
                            className="gallery-input"
                            list="tags-list"
                        />
                        <datalist id="tags-list">
                            {uniqueTags.map(tag => <option key={tag} value={tag} />)}
                        </datalist>
                    </div>
                    <div className="form-group">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                            className="file-input"
                        />
                    </div>
                    <button type="submit" className="submit-btn">Uploader</button>
                </form>
            )}

            <div className="gallery-filters">
                <button
                    className={`filter-btn ${filterTag === null ? 'active' : ''}`}
                    onClick={() => setFilterTag(null)}
                >
                    Tous
                </button>
                {uniqueTags.map(tag => (
                    <button
                        key={tag}
                        className={`filter-btn ${filterTag === tag ? 'active' : ''}`}
                        onClick={() => setFilterTag(tag)}
                    >
                        {tag}
                    </button>
                ))}
            </div>

            <div className="gallery-grid">
                {filteredPhotos.map(photo => (
                    <div key={photo.id} className="gallery-item" onClick={() => setFullscreenPhoto(photo.filename)}>
                        <div className="image-wrapper">
                            <img src={`/uploads/gallery/${photo.filename}`} alt={photo.name} loading="lazy" />
                        </div>
                        <div className="photo-info">
                            <span className="photo-name">{photo.name}</span>
                            <span className="photo-tag">{photo.tag}</span>
                        </div>
                    </div>
                ))}
            </div>

            {fullscreenPhoto && createPortal(
                <div className="lightbox-overlay" onClick={() => setFullscreenPhoto(null)}>
                    <div className="lightbox-content" onClick={e => e.stopPropagation()}>
                        <img src={`/uploads/gallery/${fullscreenPhoto}`} alt="Full screen" />
                    </div>
                    <button className="lightbox-close" onClick={() => setFullscreenPhoto(null)}>×</button>
                </div>,
                document.body
            )}
        </div>
    );
}
