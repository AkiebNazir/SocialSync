import express from 'express';
import routes from './routes/routes';
import multer, { StorageEngine } from 'multer';
import path from 'path';
import fs from 'fs';

const app = express();
app.use(express.json());

// Multer setup for file uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

const storage: StorageEngine = multer.diskStorage({
    destination: (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
        cb(null, uploadsDir);
    },
    filename: (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB max per file
});

// Attach upload to app locals for use in routes
app.locals.upload = upload;

app.use('/api/whatsapp', routes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`WhatsApp service running on port ${PORT}`);
});
