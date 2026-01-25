import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

export const uploadPhoto = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ message: 'No file uploaded' });
            return;
        }

        const { name, tag } = req.body;
        if (!name || !tag) {
            // Clean up the uploaded file if metadata is missing
            fs.unlinkSync(req.file.path);
            res.status(400).json({ message: 'Name and tag are required' });
            return;
        }

        const originalPath = req.file.path;
        const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}.avif`;
        const outputPath = path.join('uploads', 'gallery', filename);

        // Convert to AVIF
        await sharp(originalPath)
            .avif()
            .toFile(outputPath);

        // Get metadata of the converted image
        const metadata = await sharp(outputPath).metadata();

        // Delete the original uploaded file
        fs.unlinkSync(originalPath);

        const photo = await prisma.photo.create({
            data: {
                name,
                tag,
                filename,
                width: metadata.width,
                height: metadata.height,
            },
        });

        res.status(201).json(photo);
    } catch (error) {
        console.error('Error uploading photo:', error);
        res.status(500).json({ message: 'Error uploading photo' });
    }
};

export const getPhotos = async (req: Request, res: Response): Promise<void> => {
    try {
        const photos = await prisma.photo.findMany({
            orderBy: { createdAt: 'desc' },
        });
        res.json(photos);
    } catch (error) {
        console.error('Error fetching photos:', error);
        res.status(500).json({ message: 'Error fetching photos' });
    }
};
