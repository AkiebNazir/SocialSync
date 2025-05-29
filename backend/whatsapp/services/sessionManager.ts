import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createLogger } from '../utils/logger';

const logger = createLogger('WHATSAPP-SESSION-MANAGER');

// Types
interface SessionData {
    data: any;
    timestamp: number;
    checksum: string;
    version: string;
}

interface SessionState {
    isValid: boolean;
    isExpired: boolean;
    lastValidated: number;
    error?: string;
}

// Constants
const SESSION_VERSION = '1.0';
const SESSION_DIR = path.join(__dirname, 'sessions');
const SESSION_FILE = path.join(SESSION_DIR, 'session.json');
const SESSION_BACKUP_DIR = path.join(SESSION_DIR, 'backups');
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_BACKUPS = 5;

// Ensure directories exist
if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
}
if (!fs.existsSync(SESSION_BACKUP_DIR)) {
    fs.mkdirSync(SESSION_BACKUP_DIR, { recursive: true });
}

// Helper functions
function calculateChecksum(data: any): string {
    return crypto
        .createHash('sha256')
        .update(JSON.stringify(data))
        .digest('hex');
}

function validateSessionData(session: SessionData): boolean {
    if (!session || typeof session !== 'object') return false;
    if (!session.data || !session.timestamp || !session.checksum || !session.version) return false;
    
    // Verify checksum
    const calculatedChecksum = calculateChecksum(session.data);
    if (calculatedChecksum !== session.checksum) return false;
    
    // Check version compatibility
    if (session.version !== SESSION_VERSION) return false;
    
    return true;
}

function isSessionExpired(session: SessionData): boolean {
    const now = Date.now();
    return now - session.timestamp > SESSION_EXPIRY_MS;
}

function createBackup(): void {
    if (!fs.existsSync(SESSION_FILE)) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(SESSION_BACKUP_DIR, `session-${timestamp}.json`);
    
    try {
        fs.copyFileSync(SESSION_FILE, backupPath);
        console.log(`[SESSION] Backup created: ${backupPath}`);
        
        // Clean up old backups
        const backups = fs.readdirSync(SESSION_BACKUP_DIR)
            .filter(f => f.startsWith('session-'))
            .sort()
            .reverse();
            
        if (backups.length > MAX_BACKUPS) {
            backups.slice(MAX_BACKUPS).forEach(backup => {
                fs.unlinkSync(path.join(SESSION_BACKUP_DIR, backup));
            });
        }
    } catch (error) {
        console.error('[SESSION][ERROR] Failed to create backup:', error);
    }
}

// Main session management functions
export async function saveSession(session: any): Promise<void> {
    try {
        logger.debug('Saving session data');
        
        // Create backup of existing session if it exists
        if (fs.existsSync(SESSION_FILE)) {
            const backupPath = path.join(SESSION_BACKUP_DIR, `session-${Date.now()}.json`);
            await fs.promises.copyFile(SESSION_FILE, backupPath);
            logger.debug('Created session backup', { backupPath });
        }

        // Save new session
        await fs.promises.writeFile(SESSION_FILE, JSON.stringify(session, null, 2));
        logger.info('Session saved successfully');
    } catch (error) {
        logger.error('Failed to save session', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    }
}

export async function loadSession(): Promise<any> {
    try {
        logger.debug('Attempting to load session');
        
        if (!fs.existsSync(SESSION_FILE)) {
            logger.warn('No session file found');
            return null;
        }

        const data = await fs.promises.readFile(SESSION_FILE, 'utf-8');
        const session = JSON.parse(data);
        logger.info('Session loaded successfully');
        return session;
    } catch (error) {
        logger.error('Failed to load session', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return null;
    }
}

export async function invalidateSession(): Promise<void> {
    try {
        logger.info('Invalidating session');
        
        if (fs.existsSync(SESSION_FILE)) {
            // Create backup before invalidation
            const backupPath = path.join(SESSION_BACKUP_DIR, `invalidated-session-${Date.now()}.json`);
            await fs.promises.copyFile(SESSION_FILE, backupPath);
            logger.debug('Created backup of invalidated session', { backupPath });
            
            // Remove session file
            await fs.promises.unlink(SESSION_FILE);
            logger.info('Session file removed');
        } else {
            logger.warn('No session file found to invalidate');
        }
    } catch (error) {
        logger.error('Failed to invalidate session', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    }
}

export async function restoreLatestBackup(): Promise<boolean> {
    try {
        logger.info('Attempting to restore latest session backup');
        
        // Get all backup files
        const files = await fs.promises.readdir(SESSION_BACKUP_DIR);
        const backupFiles = files
            .filter(file => file.startsWith('session-') && file.endsWith('.json'))
            .sort()
            .reverse();

        if (backupFiles.length === 0) {
            logger.warn('No backup files found');
            return false;
        }

        // Get the latest backup
        const latestBackup = backupFiles[0];
        const backupPath = path.join(SESSION_BACKUP_DIR, latestBackup);
        
        logger.debug('Found latest backup', { backupPath });

        // Read and validate backup
        const data = await fs.promises.readFile(backupPath, 'utf-8');
        const session = JSON.parse(data);

        // Save as current session
        await fs.promises.writeFile(SESSION_FILE, data);
        logger.info('Successfully restored session from backup', { backupPath });
        
        return true;
    } catch (error) {
        logger.error('Failed to restore session backup', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return false;
    }
}

// Clean up old backups
export async function cleanupOldBackups(maxAgeDays: number = 7): Promise<void> {
    try {
        logger.info('Cleaning up old session backups', { maxAgeDays });
        
        const files = await fs.promises.readdir(SESSION_BACKUP_DIR);
        const now = Date.now();
        const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;

        for (const file of files) {
            if (!file.startsWith('session-') || !file.endsWith('.json')) continue;

            const filePath = path.join(SESSION_BACKUP_DIR, file);
            const stats = await fs.promises.stat(filePath);
            const age = now - stats.mtimeMs;

            if (age > maxAge) {
                await fs.promises.unlink(filePath);
                logger.debug('Removed old backup', { file, age: Math.round(age / (24 * 60 * 60 * 1000)) + ' days' });
            }
        }

        logger.info('Backup cleanup completed');
    } catch (error) {
        logger.error('Failed to cleanup old backups', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

// Export constants for use in other modules
export const SESSION_FILE_PATH = SESSION_FILE; 