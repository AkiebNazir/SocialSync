import { Client, MessageMedia } from 'whatsapp-web.js';
import { getClient, isClientReady, validateStringInput, resolveContactJid } from './service';
import path from 'path';
import fs from 'fs';
import { createLogger } from '../utils/logger';
import fileType from 'file-type';
import { workerData } from 'worker_threads';

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

// Use dynamic import for file-type to avoid 'exports' issue
async function getFileType(filePath: string): Promise<fileType.FileTypeResult | undefined> {
    try {
        const { fileTypeFromFile } = await import('file-type');
        return await fileTypeFromFile(filePath);
    } catch (error) {
        logger.error('Failed to dynamically import file-type or read file for type detection', { filePath, error });
        return undefined;
    }
}

/**
 * Validates a file for WhatsApp sending
 */
async function validateFile(filePath: string): Promise<{ valid: boolean; type: string; size: number; error?: string }> {    try {        const stats = await fs.promises.stat(filePath);
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


async function getMimeType(filePath: string): Promise<string> {
    try {
        const result = await fileType.fileTypeFromFile(filePath);
        return result?.mime || 'application/octet-stream';
    } catch (error) {
        logger.error('Failed to detect MIME type', {
            filePath,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw new Error('MIME_TYPE_DETECTION_FAILED: Failed to detect file type');
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

// This function retrieves information about a media file without sending it
export function getMediaInfo(path: any) {
    return new Promise(async (resolve, reject) => {
        try {
            // Validate file path
            if (!path || typeof path !== 'string') {
                return reject(new Error('Invalid file path provided'));
            }

            // Check if file exists
            if (!fs.existsSync(path)) {
                return reject(new Error('File does not exist'));
            }

            // Get file stats
            const stats = await fs.promises.stat(path);
            if (stats.size > MAX_FILE_SIZE) {
                return reject(new Error('File size exceeds WhatsApp limit of 16MB'));
            }

            // Get MIME type
            const mimeType = await getMimeType(path);
            if (!mimeType) {
                return reject(new Error('Could not determine file type'));
            }

            // Check if MIME type is supported
            const isSupported = Object.values(SUPPORTED_MEDIA_TYPES).some(types => types.includes(mimeType));
            if (!isSupported) {
                return reject(new Error('File type not supported by WhatsApp'));
            }

            resolve({
                valid: true,
                type: mimeType,
                size: stats.size
            });
        } catch (error) {
            reject(error instanceof Error ? error : new Error('Unknown error occurred'));
        }
    });
}
