import React, { useState, useEffect } from 'react';

interface Photo {
    id: number;
    name: string;
    tag: string;
    filename: string;
    width?: number;
    height?: number;
    createdAt: string;
}

interface GalleryImageProps {
    imageId: number;
    onBack: () => void;
}

export default function GalleryImage({ imageId, onBack }: GalleryImageProps) {
    const [photo, setPhoto] = useState<Photo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPhoto = async () => {
            try {
                const res = await fetch(`/api/photos/${imageId}`);
                if (res.ok) {
                    const data = await res.json();
                    setPhoto(data);
                } else {
                    setError('Photo not found');
                }
            } catch (err) {
                console.error('Error fetching photo:', err);
                setError('Failed to load photo');
            } finally {
                setLoading(false);
            }
        };

        if (imageId) {
            fetchPhoto();
        }
    }, [imageId]);

    if (loading) return <div className="gallery-image-loading">Chargement...</div>;
    if (error || !photo) return <div className="gallery-image-error">{error || 'Photo introuvable'}</div>;

    return (
        <div className="gallery-image-container">
            <button className="back-btn" onClick={onBack}>← Retour à la galerie</button>
            <div className="gallery-image-content">
                <div className="image-wrapper-large">
                    <img src={`/uploads/gallery/${photo.filename}`} alt={photo.name} />
                </div>
                <div className="image-details">
                    <h1>{photo.name}</h1>
                    <div className="meta-info">
                        <span className="tag-badge">{photo.tag}</span>
                        <span className="date-info">Ajouté le {new Date(photo.createdAt).toLocaleDateString()}</span>
                    </div>
                    {photo.width && photo.height && (
                        <div className="dimensions-info">
                            Dimensions: {photo.width} x {photo.height}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
