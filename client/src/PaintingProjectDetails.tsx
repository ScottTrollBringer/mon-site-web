import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ReactGA from 'react-ga4';

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
    createdAt: string;
}

interface PaintingProjectDetailsProps {
    projectId: number;
    onBack: () => void;
}

export default function PaintingProjectDetails({ projectId, onBack }: PaintingProjectDetailsProps) {
    const [project, setProject] = useState<PaintingProject | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    useEffect(() => {
        const fetchProject = async () => {
            try {
                const res = await fetch(`/api/painting-projects/${projectId}`);
                if (res.ok) {
                    const data = await res.json();
                    setProject(data);
                } else {
                    setError('Projet introuvable');
                }
            } catch (err) {
                console.error('Error fetching project:', err);
                setError('Erreur lors du chargement du projet');
            } finally {
                setLoading(false);
            }
        };

        if (projectId) {
            fetchProject();
        }
    }, [projectId]);

    const openLightbox = (filename: string) => {
        setSelectedImage(filename);
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    };

    const closeLightbox = () => {
        setSelectedImage(null);
        document.body.style.overflow = 'auto'; // Restore scrolling
    };

    useEffect(() => {
        if (selectedImage) {
            ReactGA.send({ hitType: 'pageview', page: `/painting-projects/image/${selectedImage}`, title: 'Image Projet Peinture Lightbox' });
        }
    }, [selectedImage]);

    if (loading) return <div className="painting-details-loading">Chargement...</div>;
    if (error || !project) return <div className="painting-details-error">{error || 'Projet introuvable'}</div>;

    return (
        <div className="painting-details-container">
            <button className="back-btn" onClick={onBack}>← Retour aux projets</button>

            <div className="project-details-content">
                <div className="project-header">
                    <h1>{project.title}</h1>
                    <span className={`status-badge ${project.status === 'En cours' ? 'in-progress' : 'upcoming'}`}>
                        {project.status}
                    </span>
                </div>

                <div className="project-description-full">
                    {project.description}
                </div>

                <div className="project-gallery">
                    {project.images.map(img => (
                        <div key={img.id} className="gallery-item" onClick={() => openLightbox(img.filename)}>
                            <img src={`/uploads/painting/${img.filename}`} alt="Detail" loading="lazy" />
                        </div>
                    ))}
                </div>
            </div>

            {selectedImage && createPortal(
                <div className="lightbox-overlay" onClick={closeLightbox}>
                    <div className="lightbox-content" onClick={e => e.stopPropagation()}>
                        <button className="lightbox-close" onClick={closeLightbox}>×</button>
                        <img src={`/uploads/painting/${selectedImage}`} alt="Full size" />
                    </div>
                </div>,
                document.body
            )}

            <style>{`
                .painting-details-container {
                    padding: 20px;
                    max-width: 1200px;
                    margin: 0 auto;
                    color: white;
                }
                .back-btn {
                    background: none;
                    border: none;
                    color: #aaa;
                    cursor: pointer;
                    font-size: 1rem;
                    margin-bottom: 20px;
                    padding: 0;
                    text-decoration: underline;
                }
                .back-btn:hover { color: white; }
                
                .project-header {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    margin-bottom: 20px;
                }
                .project-header h1 { margin: 0; }
                
                .status-badge {
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 0.9rem;
                    font-weight: bold;
                }
                .in-progress { background: #ff9800; color: black; }
                .upcoming { background: #2196f3; color: white; }

                .project-description-full {
                    font-size: 1.1rem;
                    line-height: 1.6;
                    margin-bottom: 30px;
                    white-space: pre-wrap;
                    background: rgba(255, 255, 255, 0.05);
                    padding: 20px;
                    border-radius: 8px;
                }

                .project-gallery {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                    gap: 15px;
                }
                .gallery-item {
                    cursor: zoom-in;
                    border-radius: 8px;
                    overflow: hidden;
                    height: 200px;
                }
                .gallery-item img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 0.3s;
                }
                .gallery-item:hover img {
                    transform: scale(1.05);
                }

                /* Reuse Lightbox styles from other components if possible, or define here */
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
