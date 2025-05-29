import { Client, MessageMedia } from 'whatsapp-web.js';
import { getClient, isClientReady, validateStringInput, resolveContactJid } from './service';
import path from 'path';
import fs from 'fs';
import { createLogger } from '../utils/logger';
import { WhatsAppError } from '../utils/errors';
import fileType from 'file-type';

const logger = createLogger('WHATSAPP-MEDIA');

// Supported media types and their MIME types
const SUPPORTED_MEDIA_TYPES = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    video: ['video/mp4', 'video/3gpp', 'video/quicktime'],
    audio: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    sticker: ['image/webp']
};

// Maximum file size (16MB for WhatsApp)
const MAX_FILE_SIZE = 16 * 1024 * 1024;

interface MediaOptions {
    caption?: string;
    filename?: string;
    sendAsSticker?: boolean;
    sendAsDocument?: boolean;
}

interface SendMediaResult {
    success: boolean;
    file: string;
    recipient: string;
    messageId?: string;
    type: string;
    size: number;
    error?: string;
}

/**
 * Validates a file for WhatsApp sending
 */
async function validateFile(filePath: string): Promise<{ valid: boolean; type: string; size: number; error?: string }> {
    try {
        const stats = await fs.promises.stat(filePath);
        if (stats.size > MAX_FILE_SIZE) {
            return { valid: false, type: '', size: stats.size, error: 'File size exceeds WhatsApp limit of 16MB' };
        }

        const mimeType = await import('mime-types').then(mime => mime.lookup(filePath));
        if (!mimeType) {
            return { valid: false, type: '', size: stats.size, error: 'Could not determine file type' };
        }

        // Check if file type is supported
        const isSupported = Object.values(SUPPORTED_MEDIA_TYPES).some(types => types.includes(mimeType));
        if (!isSupported) {
            return { valid: false, type: mimeType, size: stats.size, error: 'File type not supported by WhatsApp' };
        }

        return { valid: true, type: mimeType, size: stats.size };
    } catch (error) {
        return { valid: false, type: '', size: 0, error: 'Failed to validate file' };
    }
}

/**
 * Sends a single media file to a contact
 */
async function sendSingleMedia(
    to: string,
    filePath: string,
    options: MediaOptions = {}
): Promise<SendMediaResult> {
    try {
        // Get client
        const client = await getClient();
        if (!isClientReady) {
            return {
                success: false,
                file: filePath,
                recipient: to,
                error: 'WhatsApp client is not ready',
                type: '',
                size: 0
            };
        }

        // Validate inputs
        validateStringInput(to, 'Recipient contact');
        validateStringInput(filePath, 'File path');

        // Validate file
        const fileInfo = await validateFile(filePath);
        if (!fileInfo.valid) {
            return {
                success: false,
                file: filePath,
                recipient: to,
                error: fileInfo.error,
                type: fileInfo.type,
                size: fileInfo.size
            };
        }

        // Resolve contact JID
        const jid = await resolveContactJid(to);
        if (!jid) {
            return {
                success: false,
                file: filePath,
                recipient: to,
                error: 'Contact not found',
                type: '',
                size: 0
            };
        }

        // Create media object
        const media = await MessageMedia.fromFilePath(filePath);
        
        // Set filename if provided
        if (options.filename) {
            media.filename = options.filename;
        }

        // Send message
        const message = await client.sendMessage(jid, media, {
            caption: options.caption,
            sendMediaAsSticker: options.sendAsSticker,
            sendMediaAsDocument: options.sendAsDocument
        });

        return {
            success: true,
            file: filePath,
            recipient: to,
            messageId: message.id.id,
            type: fileInfo.type,
            size: fileInfo.size
        };
    } catch (error) {
        return {
            success: false,
            file: filePath,
            recipient: to,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            type: '',
            size: 0
        };
    }
}

/**
 * Sends multiple media files to multiple contacts
 */
export async function sendMedia(
    recipients: string | string[],
    files: string | string[],
    options: MediaOptions = {}
): Promise<{ success: boolean; results: SendMediaResult[]; errors?: string[] }> {
    // Convert single recipient/file to arrays and handle comma-separated recipients
    const recipientList = Array.isArray(recipients) 
        ? recipients 
        : recipients.split(',').map(r => r.trim()).filter(r => r);
    
    const fileList = Array.isArray(files) ? files : [files];

    if (recipientList.length === 0) {
        return {
            success: false,
            results: [],
            errors: ['No valid recipients provided']
        };
    }

    // Remove duplicate recipients
    const uniqueRecipients = [...new Set(recipientList)];
    console.log('Sending to recipients:', uniqueRecipients);

    const results: SendMediaResult[] = [];
    const errors: string[] = [];

    // Process each recipient
    for (const recipient of uniqueRecipients) {
        // Process each file for this recipient
        for (const file of fileList) {
            try {
                console.log(`Attempting to send ${file} to ${recipient}`);
                const result = await sendSingleMedia(recipient, file, options);
                results.push(result);
                if (!result.success && result.error) {
                    errors.push(`Failed to send ${path.basename(file)} to ${recipient}: ${result.error}`);
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                errors.push(`Failed to send ${path.basename(file)} to ${recipient}: ${errorMsg}`);
                results.push({
                    success: false,
                    file,
                    recipient,
                    error: errorMsg,
                    type: '',
                    size: 0
                });
            }
        }
    }

    return {
        success: results.some(r => r.success),
        results,
        errors: errors.length > 0 ? errors : undefined
    };
}

/**
 * Sends a file as a sticker
 */
export async function sendSticker(
    recipients: string | string[],
    filePath: string
): Promise<{ success: boolean; results: SendMediaResult[]; errors?: string[] }> {
    return sendMedia(recipients, filePath, { sendAsSticker: true });
}

/**
 * Sends a file as a document
 */
export async function sendDocument(
    recipients: string | string[],
    filePath: string,
    filename?: string
): Promise<{ success: boolean; results: SendMediaResult[]; errors?: string[] }> {
    return sendMedia(recipients, filePath, { sendAsDocument: true, filename });
}

/**
 * Gets information about a media file
 */
export async function getMediaInfo(filePath: string): Promise<{
    valid: boolean;
    type: string;
    size: number;
    error?: string;
    supported: boolean;
    maxSize: number;
}> {
    const validation = await validateFile(filePath);
    return {
        ...validation,
        supported: validation.valid,
        maxSize: MAX_FILE_SIZE
    };
}

export async function validateMediaFile(filePath: string): Promise<void> {
    logger.debug('Validating media file', { filePath });
    
    try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            logger.error('File not found', { filePath });
            throw new WhatsAppError('FILE_NOT_FOUND', `File not found: ${filePath}`);
        }

        // Check file size
        const stats = await fs.promises.stat(filePath);
        if (stats.size > MAX_FILE_SIZE) {
            logger.error('File too large', { 
                filePath,
                size: stats.size,
                maxSize: MAX_FILE_SIZE
            });
            throw new WhatsAppError('FILE_TOO_LARGE', `File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
        }

        // Check file type
        const mimeType = await getMimeType(filePath);
        if (!SUPPORTED_MEDIA_TYPES.image.includes(mimeType) && !SUPPORTED_MEDIA_TYPES.video.includes(mimeType) && !SUPPORTED_MEDIA_TYPES.audio.includes(mimeType) && !SUPPORTED_MEDIA_TYPES.document.includes(mimeType)) {
            logger.error('Unsupported file type', { 
                filePath,
                mimeType,
                supportedTypes: SUPPORTED_MEDIA_TYPES
            });
            throw new WhatsAppError('UNSUPPORTED_FILE_TYPE', `Unsupported file type: ${mimeType}`);
        }

        logger.info('Media file validation successful', { 
            filePath,
            size: stats.size,
            mimeType
        });
    } catch (error) {
        if (error instanceof WhatsAppError) {
            throw error;
        }
        logger.error('Media validation failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw new WhatsAppError('MEDIA_VALIDATION_FAILED', 'Failed to validate media file');
    }
}

async function getMimeType(filePath: string): Promise<string> {
    try {
        const result = await fileType.fileTypeFromFile(filePath);
        return result?.mime || 'application/octet-stream';
    } catch (error) {
        logger.error('Failed to detect MIME type', {
            filePath,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw new WhatsAppError('MIME_TYPE_DETECTION_FAILED', 'Failed to detect file type');
    }
}

export async function createMediaMessage(filePath: string, caption?: string): Promise<MessageMedia> {
    logger.debug('Creating media message', { filePath, hasCaption: !!caption });
    
    try {
        await validateMediaFile(filePath);
        
        const media = await MessageMedia.fromFilePath(filePath);
        
        logger.info('Media message created successfully', {
            filePath,
            mimeType: media.mimetype,
            hasCaption: !!caption
        });
        
        return media;
    } catch (error) {
        logger.error('Failed to create media message', {
            filePath,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    }
}

export async function downloadMedia(message: any, outputDir: string): Promise<string> {
    logger.debug('Downloading media', { 
        messageId: message.id.id,
        outputDir
    });
    
    try {
        if (!message.hasMedia) {
            logger.error('Message has no media', { messageId: message.id.id });
            throw new WhatsAppError('NO_MEDIA', 'Message does not contain media');
        }

        // Create output directory if it doesn't exist
        if (!fs.existsSync(outputDir)) {
            await fs.promises.mkdir(outputDir, { recursive: true });
            logger.debug('Created output directory', { outputDir });
        }

        const media = await message.downloadMedia();
        if (!media) {
            logger.error('Failed to download media', { messageId: message.id.id });
            throw new WhatsAppError('DOWNLOAD_FAILED', 'Failed to download media');
        }

        const ext = media.mimetype.split('/')[1] || 'bin';
        const filename = `media_${message.id.id}_${Date.now()}.${ext}`;
        const filePath = path.join(outputDir, filename);

        await fs.promises.writeFile(filePath, media.data, 'base64');
        
        logger.info('Media downloaded successfully', {
            messageId: message.id.id,
            filePath,
            mimeType: media.mimetype
        });
        
        return filePath;
    } catch (error) {
        logger.error('Media download failed', {
            messageId: message.id.id,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    }
}

export async function cleanupMediaFiles(directory: string, maxAgeHours: number = 24): Promise<void> {
    logger.info('Cleaning up media files', { directory, maxAgeHours });
    
    try {
        const files = await fs.promises.readdir(directory);
        const now = Date.now();
        const maxAge = maxAgeHours * 60 * 60 * 1000;

        for (const file of files) {
            if (!file.startsWith('media_')) continue;

            const filePath = path.join(directory, file);
            const stats = await fs.promises.stat(filePath);
            const age = now - stats.mtimeMs;

            if (age > maxAge) {
                await fs.promises.unlink(filePath);
                logger.debug('Removed old media file', { 
                    file,
                    age: Math.round(age / (60 * 60 * 1000)) + ' hours'
                });
            }
        }

        logger.info('Media cleanup completed');
    } catch (error) {
        logger.error('Media cleanup failed', {
            directory,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
} 