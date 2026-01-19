import React, { useState } from 'react';

interface AuthProps {
    onLogin: (token: string, user: { id: number; username: string; role: string }) => void;
    onCancel?: () => void;
}

export default function Auth({ onLogin, onCancel }: AuthProps) {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [secretCode, setSecretCode] = useState('');
    const [error, setError] = useState('');

    console.log('Auth component render. isLogin:', isLogin);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, secretCode }),
            });
            const data = await res.json();

            if (res.ok) {
                onLogin(data.token, data.user);
            } else {
                setError(data.error || 'An error occurred');
            }
        } catch (err) {
            setError('Failed to connect to server');
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card glass">
                <h2>{isLogin ? 'Connexion' : 'Inscription'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <input
                            type="text"
                            placeholder="Identifiant"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <input
                            type="password"
                            placeholder="Mot de passe"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    {!isLogin && (
                        <div className="input-group admin-secret-field">
                            <label style={{ display: 'block', textAlign: 'left', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--primary)' }}>
                                Code secret (Optionnel pour Admin)
                            </label>
                            <input
                                type="text"
                                placeholder="Entrer le code secret"
                                value={secretCode}
                                onChange={(e) => setSecretCode(e.target.value)}
                            />
                        </div>
                    )}
                    {error && <p className="error-message">{error}</p>}
                    <button type="submit" className="auth-submit">
                        {isLogin ? 'Se connecter' : "S'inscrire"}
                    </button>
                </form>
                <button
                    className="auth-toggle"
                    onClick={() => setIsLogin(!isLogin)}
                >
                    {isLogin ? "Pas de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
                </button>
                {onCancel && (
                    <button className="auth-toggle" onClick={onCancel} style={{ marginTop: '0.5rem' }}>
                        Annuler
                    </button>
                )}
            </div>
        </div>
    );
}
