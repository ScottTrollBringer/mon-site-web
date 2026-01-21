import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticate, optionalAuthenticate, AuthRequest } from './middleware/auth';
import { getSecret } from './utils/secrets';
import { execSync } from 'child_process';

dotenv.config();

console.log('[DEBUG] Environment Variables Keys:', Object.keys(process.env).sort());

let prisma: PrismaClient;
const app = express();
const port = 3000;

let ADMIN_SECRET = process.env.ADMIN_SECRET;

// Initialize secrets and Prisma
async function initSecrets() {
    const jwtSecret = await getSecret('jwt_secret', 'GCP_JWT_SECRET_NAME');
    if (jwtSecret) {
        process.env.JWT_SECRET = jwtSecret;
    }

    ADMIN_SECRET = await getSecret('admin_secret', 'GCP_ADMIN_SECRET_NAME') || ADMIN_SECRET;

    const dbUrl = await getSecret('db_url', 'GCP_DB_URL_NAME');
    if (dbUrl) {
        process.env.DATABASE_URL = dbUrl;
    }

    // Run Prisma migrations after setting DATABASE_URL
    console.log('Running Prisma Migrations...');
    try {
        execSync('npx prisma migrate deploy', { stdio: 'inherit' });
        console.log('Prisma Migrations completed.');
    } catch (error) {
        console.error('CRITICAL: Failed to run Prisma migrations:', error);
        // We continue? Or throw? If migrations fail, DB might be unusable.
        // Let's throw to be safe/fail fast.
        throw error;
    }

    // Initialize Prisma Client
    console.log('Initializing Prisma Client...');
    try {
        prisma = new PrismaClient();
        console.log('Prisma Client initialized.');
    } catch (e) {
        console.error('CRITICAL: Failed to initialize Prisma Client:', e);
        throw e;
    }
}

app.use(cors());
app.use(express.json());

// Auth Endpoints
app.post('/api/auth/register', async (req: Request, res: Response) => {
    const { username, password, secretCode } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log('Registration attempt:', { username, secretCodeProvided: secretCode });

        const role = secretCode === ADMIN_SECRET ? 'admin' : 'user';
        console.log('Assigned role:', role);

        const user = await prisma.user.create({
            data: { username, password: hashedPassword, role },
        });
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET is not defined');
        const token = jwt.sign({ userId: user.id, role: user.role }, secret, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
        console.error('Register error:', error);
        res.status(400).json({ error: 'Username already exists or invalid data' });
    }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    try {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET is not defined');
        const token = jwt.sign({ userId: user.id, role: user.role }, secret, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Helper to check for admin role
const isAdmin = (req: AuthRequest, res: Response, next: express.NextFunction) => {
    if (req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    next();
};

// Apply auth to GET routes, strict auth to others
// Get all todos sorted by position
app.get('/api/todos', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        // If user, get only admin's todos. If admin, get their own.
        const targetUserId = req.userRole === 'admin' ? req.userId : (await prisma.user.findFirst({ where: { role: 'admin' } }))?.id;

        const todos = await prisma.todo.findMany({
            where: { userId: targetUserId },
            orderBy: { position: 'asc' },
        });
        res.json(todos);
    } catch (error) {
        console.error('Fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch todos' });
    }
});

// Create a todo
app.post('/api/todos', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    const { description } = req.body;
    if (!description) {
        return res.status(400).json({ error: 'Description is required' });
    }
    try {
        const lastTodo = await prisma.todo.findFirst({
            where: { userId: req.userId },
            orderBy: { position: 'desc' },
        });
        const position = lastTodo ? lastTodo.position + 1 : 0;

        const todo = await prisma.todo.create({
            data: { description, position, userId: req.userId! },
        });
        res.json(todo);
    } catch (error) {
        console.error('Create error:', error);
        res.status(500).json({ error: 'Failed to create todo' });
    }
});

// Update a todo
app.put('/api/todos/:id', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { description, completed } = req.body;

    try {
        const todo = await prisma.todo.update({
            where: { id: parseInt(id as string), userId: req.userId },
            data: { description, completed },
        });
        res.json(todo);
    } catch (error) {
        console.error('Update error:', error);
        res.status(404).json({ error: 'Todo not found' });
    }
});

// Reorder todos
app.post('/api/todos/reorder', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
        return res.status(400).json({ error: 'IDs array is required' });
    }

    try {
        for (let i = 0; i < ids.length; i++) {
            await prisma.todo.update({
                where: { id: parseInt(ids[i] as string), userId: req.userId },
                data: { position: i },
            });
        }
        res.status(200).json({ message: 'Order updated successfully' });
    } catch (error) {
        console.error('Reorder error:', error);
        res.status(500).json({ error: 'Failed to reorder todos' });
    }
});

// Delete a todo
app.delete('/api/todos/:id', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
        await prisma.todo.delete({
            where: { id: parseInt(id as string), userId: req.userId },
        });
        res.status(204).send();
    } catch (error) {
        console.error('Delete error:', error);
        res.status(404).json({ error: 'Todo not found' });
    }
});

// Video Games Endpoints
app.get('/api/videogames', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
    try {
        const targetUserId = req.userRole === 'admin' ? req.userId : (await prisma.user.findFirst({ where: { role: 'admin' } }))?.id;

        const games = await prisma.videoGame.findMany({
            where: { userId: targetUserId },
            orderBy: { position: 'asc' },
        });
        res.json(games);
    } catch (error) {
        console.error('Fetch games error:', error);
        res.status(500).json({ error: 'Failed to fetch video games' });
    }
});

app.post('/api/videogames', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    const { title, month, genre, why } = req.body;
    if (!title || !month || !genre) {
        return res.status(400).json({ error: 'Title, month and genre are required' });
    }
    try {
        const lastGame = await prisma.videoGame.findFirst({
            where: { userId: req.userId },
            orderBy: { position: 'desc' },
        });
        const position = lastGame ? lastGame.position + 1 : 0;

        const game = await prisma.videoGame.create({
            data: { title, month, genre, why: why || '', position, userId: req.userId! },
        });
        res.json(game);
    } catch (error) {
        console.error('Create game error:', error);
        res.status(500).json({ error: 'Failed to create video game' });
    }
});

app.post('/api/videogames/reorder', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
        return res.status(400).json({ error: 'IDs array is required' });
    }

    try {
        for (let i = 0; i < ids.length; i++) {
            await prisma.videoGame.update({
                where: { id: parseInt(ids[i] as string), userId: req.userId },
                data: { position: i },
            });
        }
        res.status(200).json({ message: 'Order updated successfully' });
    } catch (error) {
        console.error('Reorder games error:', error);
        res.status(500).json({ error: 'Failed to reorder video games' });
    }
});

app.put('/api/videogames/:id', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { title, month, genre, why } = req.body;
    try {
        const game = await prisma.videoGame.update({
            where: { id: parseInt(id as string), userId: req.userId },
            data: { title, month, genre, why },
        });
        res.json(game);
    } catch (error) {
        console.error('Update game error:', error);
        res.status(404).json({ error: 'Video game not found' });
    }
});

app.delete('/api/videogames/:id', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
        await prisma.videoGame.delete({
            where: { id: parseInt(id as string), userId: req.userId },
        });
        res.status(204).send();
    } catch (error) {
        console.error('Delete game error:', error);
        res.status(404).json({ error: 'Video game not found' });
    }
});

initSecrets().then(() => {
    app.listen(port, '0.0.0.0', () => {
        console.log(`Server running at http://0.0.0.0:${port}`);
    });
});
