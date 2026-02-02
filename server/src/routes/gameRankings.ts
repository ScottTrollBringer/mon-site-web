
import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, optionalAuthenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Helper to check for admin role
const isAdmin = (req: AuthRequest, res: Response, next: any) => {
    if (req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    next();
};

// Get all game rankings
router.get('/', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
    try {
        const rankings = await prisma.gameRanking.findMany({
            orderBy: { rating: 'desc' }
        });
        res.json(rankings);
    } catch (error) {
        console.error('Fetch game rankings error:', error);
        res.status(500).json({ error: 'Failed to fetch game rankings' });
    }
});

// Create a game ranking (Admin only)
router.post('/', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    const { gameName, rating, genre, comment } = req.body;

    if (!gameName || rating === undefined || !genre) {
        return res.status(400).json({ error: 'Game name, rating and genre are required' });
    }

    if (rating < 1 || rating > 10) {
        return res.status(400).json({ error: 'Rating must be between 1 and 10' });
    }

    try {
        const ranking = await prisma.gameRanking.create({
            data: {
                gameName,
                rating,
                genre,
                comment,
            },
        });
        res.json(ranking);
    } catch (error) {
        console.error('Create game ranking error:', error);
        res.status(500).json({ error: 'Failed to create game ranking' });
    }
});

// Update a game ranking (Admin only)
router.put('/:id', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { gameName, rating, genre, comment } = req.body;

    if (rating !== undefined && (rating < 1 || rating > 10)) {
        return res.status(400).json({ error: 'Rating must be between 1 and 10' });
    }

    try {
        const ranking = await prisma.gameRanking.update({
            where: { id: parseInt(id as string) },
            data: {
                gameName,
                rating,
                genre,
                comment,
            },
        });
        res.json(ranking);
    } catch (error) {
        console.error('Update game ranking error:', error);
        res.status(404).json({ error: 'Game ranking not found' });
    }
});

// Delete a game ranking (Admin only)
router.delete('/:id', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
        await prisma.gameRanking.delete({
            where: { id: parseInt(id as string) },
        });
        res.status(204).send();
    } catch (error) {
        console.error('Delete game ranking error:', error);
        res.status(404).json({ error: 'Game ranking not found' });
    }
});

export default router;
