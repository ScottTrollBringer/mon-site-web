// Utilitaire pour générer un slug unique à partir d'un titre
function slugify(str: string): string {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // retire les accents
        .replace(/[^a-zA-Z0-9\s-]/g, '') // retire caractères spéciaux
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, optionalAuthenticate, AuthRequest } from './middleware/auth';
import { getSecret } from './utils/secrets';
import { uploadPhoto, getPhotos } from './controllers/photoController';
import gameRankingRouter from './routes/gameRankings';
import { getCachedDigest, generateDigest, isDigestGenerating } from './services/newsAgent';
import { execSync } from 'child_process';
import sharp from 'sharp';

dotenv.config();

let prisma: PrismaClient;
const app = express();
const port = 3000;

let ADMIN_SECRET = process.env.ADMIN_SECRET;
let GOOGLE_SEARCH_API_KEY = '';
let GOOGLE_SEARCH_CX = '';
let GEMINI_API_KEY = '';

// Initialize secrets and Prisma
async function initSecrets() {
    const jwtSecret = await getSecret('jwt_secret', 'GCP_JWT_SECRET_NAME');
    if (jwtSecret) {
        process.env.JWT_SECRET = jwtSecret;
    }

    ADMIN_SECRET = await getSecret('admin_secret', 'GCP_ADMIN_SECRET_NAME') || ADMIN_SECRET;

    // News Agent secrets
    GOOGLE_SEARCH_API_KEY = await getSecret('google_search_api_key', 'GCP_GOOGLE_SEARCH_API_KEY_NAME') || '';
    GOOGLE_SEARCH_CX = await getSecret('google_search_cx', 'GCP_GOOGLE_SEARCH_CX_NAME') || '';
    GEMINI_API_KEY = await getSecret('gemini_api_key', 'GCP_GEMINI_API_KEY_NAME') || '';

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

app.use(helmet());
app.use(cors());
app.use(express.json());

// Multer configuration for blog image uploads
// Multer configuration for blog image uploads
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '../uploads/blog');
if (!fs.existsSync(UPLOADS_DIR)) {
    console.log(`Creating uploads directory at: ${UPLOADS_DIR}`);
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
} else {
    console.log(`Uploads directory exists at: ${UPLOADS_DIR}`);
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (_req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Multer config for Gallery
const GALLERY_DIR = path.join(__dirname, '../uploads/gallery');
if (!fs.existsSync(GALLERY_DIR)) {
    console.log(`Creating gallery directory at: ${GALLERY_DIR}`);
    fs.mkdirSync(GALLERY_DIR, { recursive: true });
}

const galleryStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, GALLERY_DIR), // Temporarily save here, controller converts and deletes
    filename: (_req, file, cb) => cb(null, `temp-${Date.now()}-${file.originalname}`)
});

const galleryUpload = multer({
    storage: galleryStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for high res photos
    fileFilter: (_req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp|avif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Multer config for Painting Projects
const PAINTING_DIR = path.join(__dirname, '../uploads/painting');
if (!fs.existsSync(PAINTING_DIR)) {
    console.log(`Creating painting directory at: ${PAINTING_DIR}`);
    fs.mkdirSync(PAINTING_DIR, { recursive: true });
}

// Storage for painting images - temporary save before processing
const paintingStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PAINTING_DIR),
    filename: (_req, file, cb) => cb(null, `temp-${Date.now()}-${file.originalname}`)
});

const paintingUpload = multer({
    storage: paintingStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp|avif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Helper to process and save image as AVIF
const processPaintingImage = async (filePath: string): Promise<string> => {
    const filename = `painting-${Date.now()}-${Math.round(Math.random() * 1E9)}.avif`;
    const outputPath = path.join(PAINTING_DIR, filename);

    await sharp(filePath)
        .avif({ quality: 80 })
        .toFile(outputPath);

    // Delete original temp file
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    return filename;
};


// Serve uploaded files statically
app.use('/uploads', express.static(path.dirname(UPLOADS_DIR)));

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

// Blog Endpoints
// Get all blog posts with pagination
app.get('/api/blog', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 5;
        const skip = (page - 1) * limit;

        const [posts, total] = await Promise.all([
            prisma.blogPost.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: { images: true, author: { select: { username: true } } }
            }),
            prisma.blogPost.count()
        ]);

        res.json({
            posts,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Fetch blog posts error:', error);
        res.status(500).json({ error: 'Failed to fetch blog posts' });
    }
});

// Get single blog post by slug
app.get('/api/blog/slug/:slug', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
    const { slug } = req.params;
    try {
        const post = await prisma.blogPost.findUnique({
            where: { slug: String(slug) },
            include: { images: true, author: { select: { username: true } } }
        });
        if (!post) {
            return res.status(404).json({ error: 'Blog post not found' });
        }
        res.json(post);
    } catch (error) {
        console.error('Fetch blog post by slug error:', error);
        res.status(500).json({ error: 'Failed to fetch blog post' });
    }
});

// Get single blog post by ID (legacy/admin)
app.get('/api/blog/:id', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
        const post = await prisma.blogPost.findUnique({
            where: { id: parseInt(String(id)) },
            include: { images: true, author: { select: { username: true } } }
        });
        if (!post) {
            return res.status(404).json({ error: 'Blog post not found' });
        }
        res.json(post);
    } catch (error) {
        console.error('Fetch blog post error:', error);
        res.status(500).json({ error: 'Failed to fetch blog post' });
    }
});

// Create blog post (admin only)
app.post('/api/blog', authenticate, isAdmin, upload.array('images', 10), async (req: AuthRequest, res: Response) => {
    const { title, content } = req.body;
    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
    }
    try {
        const files = req.files as Express.Multer.File[];
        console.log('Creating blog post:', { title, userId: req.userId, filesCount: files?.length });

        let baseSlug = slugify(title);
        if (!baseSlug) {
            // Fallback si le titre ne contient que des caractères spéciaux
            baseSlug = `article-${Date.now()}`;
        }
        let slug = baseSlug;
        let suffix = 1;
        // Vérifie l'unicité du slug
        while (await prisma.blogPost.findUnique({ where: { slug } })) {
            slug = `${baseSlug}-${suffix++}`;
        }

        console.log('Generated slug:', slug);

        const post = await prisma.blogPost.create({
            data: {
                title,
                slug,
                content,
                authorId: req.userId!,
                images: {
                    create: files?.map(file => ({ filename: file.filename })) || []
                }
            },
            include: { images: true }
        });
        console.log('Blog post created successfully:', post.id);
        res.json(post);
    } catch (error) {
        console.error('Create blog post error FULL OBJECT:', JSON.stringify(error, null, 2));
        console.error('Create blog post error stack:', error instanceof Error ? error.stack : 'No stack');

        res.status(500).json({
            error: 'Failed to create blog post',
            details: error instanceof Error ? error.message : String(error),
            stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
        });
    }
});

// Update blog post (admin only)
app.put('/api/blog/:id', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { title, content, slug, ...rest } = req.body;
    if (slug !== undefined) {
        return res.status(400).json({ error: 'Slug cannot be modified' });
    }
    try {
        const post = await prisma.blogPost.update({
            where: { id: parseInt(String(id)) },
            data: { title, content },
            include: { images: true }
        });
        res.json(post);
    } catch (error) {
        console.error('Update blog post error:', error);
        res.status(404).json({ error: 'Blog post not found' });
    }
});

// Delete blog post (admin only)
app.delete('/api/blog/:id', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
        // Get images to delete from disk
        const post = await prisma.blogPost.findUnique({
            where: { id: parseInt(String(id)) },
            include: { images: true }
        });
        if (!post) {
            return res.status(404).json({ error: 'Blog post not found' });
        }

        // Delete images from disk
        for (const image of post.images) {
            // Path traversal protection
            if (image.filename.includes('..') || path.isAbsolute(image.filename) || image.filename.includes('/') || image.filename.includes('\\')) {
                console.warn(`Tentative de path traversal détectée pour le fichier: ${image.filename}`);
                continue;
            }
            const filePath = path.join(UPLOADS_DIR, image.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        // Delete post (cascade deletes images in DB)
        await prisma.blogPost.delete({ where: { id: parseInt(String(id)) } });
        res.status(204).send();
    } catch (error) {
        console.error('Delete blog post error:', error);
        res.status(500).json({ error: 'Failed to delete blog post' });
    }
});

// Upload images to existing blog post (admin only)
app.post('/api/blog/:id/images', authenticate, isAdmin, upload.array('images', 10), async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No images provided' });
        }

        const images = await prisma.blogImage.createMany({
            data: files.map(file => ({
                filename: file.filename,
                blogPostId: parseInt(String(id))
            }))
        });

        const updatedPost = await prisma.blogPost.findUnique({
            where: { id: parseInt(String(id)) },
            include: { images: true }
        });

        res.json(updatedPost);
    } catch (error) {
        console.error('Upload images error:', error);
        res.status(500).json({ error: 'Failed to upload images' });
    }
});

// Delete single image (admin only)
app.delete('/api/blog/images/:imageId', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    const { imageId } = req.params;
    try {
        const image = await prisma.blogImage.findUnique({ where: { id: parseInt(String(imageId)) } });
        if (!image) {
            return res.status(404).json({ error: 'Image not found' });
        }

        // Delete from disk
        // Path traversal protection
        if (image.filename.includes('..') || path.isAbsolute(image.filename) || image.filename.includes('/') || image.filename.includes('\\')) {
            console.warn(`Tentative de path traversal détectée pour le fichier: ${image.filename}`);
        } else {
            const filePath = path.join(UPLOADS_DIR, image.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        // Delete from DB
        await prisma.blogImage.delete({ where: { id: parseInt(String(imageId)) } });
        res.status(204).send();
    } catch (error) {
        console.error('Delete image error:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

// Gallery Endpoints
app.get('/api/photos', optionalAuthenticate, getPhotos);
app.post('/api/photos', authenticate, isAdmin, galleryUpload.single('photo'), uploadPhoto);
app.use('/api/gamerankings', gameRankingRouter);

// Painting Projects Endpoints

// Get all painting projects
app.get('/api/painting-projects', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
    try {
        const projects = await prisma.paintingProject.findMany({
            include: { images: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(projects);
    } catch (error) {
        console.error('Fetch painting projects error:', error);
        res.status(500).json({ error: 'Failed to fetch painting projects' });
    }
});

// Create painting project (Admin only)
app.post('/api/painting-projects', authenticate, isAdmin, paintingUpload.array('images', 10), async (req: AuthRequest, res: Response) => {
    const { title, status, description } = req.body;

    if (!title || !status || !description) {
        return res.status(400).json({ error: 'Title, status and description are required' });
    }

    try {
        const files = req.files as Express.Multer.File[];
        const processedImages: { filename: string }[] = [];

        if (files && files.length > 0) {
            for (const file of files) {
                try {
                    const filename = await processPaintingImage(file.path);
                    processedImages.push({ filename });
                } catch (err) {
                    console.error(`Failed to process image ${file.originalname}:`, err);
                    // Continue with other images? Or fail? Let's continue.
                    // Clean up temp file if it exists
                    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                }
            }
        }

        const project = await prisma.paintingProject.create({
            data: {
                title,
                status,
                description,
                images: {
                    create: processedImages
                }
            },
            include: { images: true }
        });
        res.json(project);
    } catch (error) {
        console.error('Create painting project error:', error);
        // Cleanup uploaded files if project creation fails?
        // Complex to implement here without processed filenames context, skipping for brevity
        res.status(500).json({ error: 'Failed to create painting project' });
    }
});

// Update painting project (Admin only)
app.put('/api/painting-projects/:id', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { title, status, description } = req.body;

    try {
        const project = await prisma.paintingProject.update({
            where: { id: parseInt(id as string) },
            data: { title, status, description },
            include: { images: true }
        });
        res.json(project);
    } catch (error) {
        console.error('Update painting project error:', error);
        res.status(404).json({ error: 'Painting project not found' });
    }
});

// Delete painting project (Admin only)
app.delete('/api/painting-projects/:id', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
        const project = await prisma.paintingProject.findUnique({
            where: { id: parseInt(id as string) },
            include: { images: true }
        });

        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Delete images from disk
        for (const image of project.images) {
            const filePath = path.join(PAINTING_DIR, image.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await prisma.paintingProject.delete({
            where: { id: parseInt(id as string) },
        });
        res.status(204).send();
    } catch (error) {
        console.error('Delete painting project error:', error);
        res.status(500).json({ error: 'Failed to delete painting project' });
    }
});

// Add images to project (Admin only)
app.post('/api/painting-projects/:id/images', authenticate, isAdmin, paintingUpload.array('images', 10), async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No images provided' });
        }

        const processedImages: { filename: string; paintingProjectId: number }[] = [];

        for (const file of files) {
            try {
                const filename = await processPaintingImage(file.path);
                processedImages.push({
                    filename,
                    paintingProjectId: parseInt(id as string)
                });
            } catch (err) {
                console.error(`Failed to process image ${file.originalname}:`, err);
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            }
        }

        if (processedImages.length > 0) {
            await prisma.paintingImage.createMany({
                data: processedImages
            });
        }

        const updatedProject = await prisma.paintingProject.findUnique({
            where: { id: parseInt(id as string) },
            include: { images: true }
        });

        res.json(updatedProject);
    } catch (error) {
        console.error('Upload painting images error:', error);
        res.status(500).json({ error: 'Failed to upload images' });
    }
});

// Delete single image (Admin only)
app.delete('/api/painting-projects/images/:id', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
        const image = await prisma.paintingImage.findUnique({ where: { id: parseInt(id as string) } });
        if (!image) return res.status(404).json({ error: 'Image not found' });

        const filePath = path.join(PAINTING_DIR, image.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await prisma.paintingImage.delete({ where: { id: parseInt(id as string) } });
        res.status(204).send();
    } catch (error) {
        console.error('Delete painting image error:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

// News Digest Endpoints

// Get latest news digest (public)
app.get('/api/news-digest', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
    try {
        const digest = getCachedDigest();
        if (!digest) {
            return res.json({
                generatedAt: null,
                topics: [],
                status: 'empty',
                message: 'Aucun rapport de veille disponible. Un administrateur doit déclencher la génération.',
            });
        }
        res.json(digest);
    } catch (error) {
        console.error('Fetch news digest error:', error);
        res.status(500).json({ error: 'Failed to fetch news digest' });
    }
});

// Trigger digest refresh (admin only)
app.post('/api/news-digest/refresh', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    if (isDigestGenerating()) {
        return res.status(409).json({ error: 'Un rapport est déjà en cours de génération. Veuillez patienter.' });
    }

    if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_CX || !GEMINI_API_KEY) {
        return res.status(500).json({
            error: 'Clés API manquantes. Vérifiez google_search_api_key, google_search_cx et gemini_api_key dans les secrets.',
        });
    }

    try {
        // Start generation in background and respond immediately
        res.json({ message: 'Génération du rapport de veille lancée...' });

        // Generate asynchronously
        generateDigest(GOOGLE_SEARCH_API_KEY, GOOGLE_SEARCH_CX, GEMINI_API_KEY)
            .then(() => console.log('[NewsAgent] Digest refresh completed'))
            .catch(err => console.error('[NewsAgent] Digest refresh failed:', err));
    } catch (error) {
        console.error('Refresh news digest error:', error);
        res.status(500).json({ error: 'Failed to start digest generation' });
    }
});

initSecrets().then(() => {
    app.listen(port, '0.0.0.0', () => {
        console.log(`Server running at http://0.0.0.0:${port}`);
    });
});
