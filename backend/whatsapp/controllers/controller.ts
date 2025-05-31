// WhatsApp controllers (request handlers)

import { Request, Response } from 'express';
import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import { startWhatsAppSession, sendMessage, scheduleMessage, getUnreadMessages, getMessages, searchMessages, sendMedia, downloadMedia, downloadMediaByContact, isClientReady, resolveContactJid, getClient } from '../services/service';
import { sendMessageSchema, scheduleMessageSchema } from '../utils/validation';
import { parseISTDate } from '../utils/utils';
import * as groupService from '../services/group';
import * as contactService from '../services/contact';
import * as messageAdvanced from '../services/messageAdvanced';
import * as webhookService from '../services/webhook';
import * as mediaService from '../services/mediaService';
// import { reconnectWhatsApp } from '../services/service'; // Import the new service function

// Controller to start WhatsApp session and return QR code as PNG file
export const connectWhatsApp = async (req: Request, res: Response) => {
    try {
    let sent = false;
        await startWhatsAppSession((qrUrl) => {
        if (sent) return; // Prevent multiple responses
        sent = true;
        // Log when QR is generated for connect endpoint
        console.log('[API][CONNECT] QR code generated and ready to scan.');
        // Extract base64 from data URL
        const base64Data = qrUrl.replace(/^data:image\/png;base64,/, "");
        const filePath = 'whatsapp-qr.png';
        fs.writeFile(filePath, base64Data, 'base64', (err) => {
            if (err) {
                console.error('[API][CONNECT][ERROR] Failed to generate QR code image:', err);
                res.status(500).json({ error: 'Failed to generate QR code image.' });
                return;
            }
            res.sendFile(filePath, { root: process.cwd() }, (err) => {
                // Optionally delete the file after sending
                fs.unlink(filePath, () => {});
            });
        });
    });
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('[API][CONNECT][ERROR]', errorMsg);
        res.status(500).json({ error: errorMsg });
    }
};

// Controller to trigger session check and re-connection
export const reconnectWhatsAppController = async (req: Request, res: Response) => {
    try {
        console.log('[API][RECONNECT] Attempting to reconnect WhatsApp session...');
        // await reconnectWhatsApp();
        res.json({ success: true, message: 'WhatsApp re-connection process initiated. Check logs for status.' });
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('[API][RECONNECT][ERROR]', errorMsg);
        res.status(500).json({ error: `Failed to initiate re-connection: ${errorMsg}` });
    }
};
// TODO: Add OTP-based authentication controller

export const sendMessageController = async (req: Request, res: Response) => {
    const parse = sendMessageSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ error: 'Invalid request', details: parse.error.errors });
    }
    const { to, message } = parse.data;
    try {
        const jid = await resolveContactJid(to);
        if (!jid) {
            console.error(`[API][SEND][ERROR] Could not resolve contact/JID for:`, to);
            return res.status(404).json({ error: 'Invalid phone number or contact name', contact: to });
        }
        await sendMessage(to, message);
        res.json({ success: true, to, jid });
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[API][SEND][ERROR] Failed to send message to '${to}':`, errorMsg);
        res.status(400).json({ error: errorMsg, contact: to });
    }
};

export const scheduleMessageController = async (req: Request, res: Response) => {
    const parse = scheduleMessageSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ error: 'Invalid request', details: parse.error.errors });
    }
    const { to, message, date } = parse.data;
    try {
        // Log the original user-provided date string
        console.log(`[API][SCHEDULE] Requested schedule time (IST, user input):`, date);
        let scheduleDate: Date = parseISTDate(date);
        // Log the final IST time (no conversion)
        console.log(`[API][SCHEDULE] Scheduling for IST (no conversion):`, scheduleDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
        await scheduleMessage(to, message, scheduleDate);
        res.json({ success: true, scheduledFor: scheduleDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), originalInput: date });
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[API][SCHEDULE][ERROR] Failed to schedule message:`, err);
        res.status(400).json({ error: errorMsg });
    }
};

export const getUnreadMessagesController = async (req: Request, res: Response) => {
    const { contactId } = req.query;
    try {
        const unread = await getUnreadMessages(contactId as string);
        res.json(unread);
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[API][UNREAD][ERROR] Failed to fetch unread messages for '${contactId}':`, errorMsg);
        res.status(500).json({ error: errorMsg, contact: contactId });
    }
};

export const getMessagesController = async (req: Request, res: Response) => {
    const { contactId, date } = req.query;
    try {
        const messages = await getMessages(contactId as string, date ? new Date(date as string) : undefined);
        res.json(messages);
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[API][MESSAGES][ERROR] Failed to fetch messages for '${contactId}':`, errorMsg);
        res.status(500).json({ error: errorMsg, contact: contactId });
    }
};

export const searchMessagesController = async (req: Request, res: Response) => {
    const { query, contact } = req.query;
    try {
        const results = await searchMessages(query as string, contact as string | undefined);
        res.json(results);
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[API][SEARCH][ERROR] Failed to search messages:`, errorMsg);
        res.status(500).json({ error: errorMsg });
    }
};

export const sendMediaController = async (req: Request, res: Response) => {
    try {
        // Get recipients (single or multiple)
        const to = req.body.to;
        if (!to) {
            return res.status(400).json({ error: 'Recipient is required' });
        }

        // Get files from request
    const reqAny = req as any;
    let filePaths: string[] = [];
        
        // Handle single file
        if (reqAny.file && reqAny.file.path) {
            filePaths.push(reqAny.file.path);
        }
        
        // Handle multiple files
    if (Array.isArray(reqAny.files) && reqAny.files.length > 0) {
        filePaths = reqAny.files.map((f: any) => f.path);
    }

        if (filePaths.length === 0) {
            return res.status(400).json({ error: 'No files provided' });
        }

        // Get options
        const options = {
            caption: req.body.caption,
            filename: req.body.filename,
            sendAsSticker: req.body.sendAsSticker === 'true',
            sendAsDocument: req.body.sendAsDocument === 'true'
        };

        // Send media
        const result = await mediaService.sendMedia(to, filePaths, options);

        // Clean up uploaded files
        for (const filePath of filePaths) {
            try {
                await fsPromises.unlink(filePath);
            } catch (err) {
                console.error(`[API][SEND_MEDIA][CLEANUP] Failed to delete file ${filePath}:`, err);
            }
        }

        if (!result.success) {
            return res.status(400).json({
                error: 'Failed to send some or all media',
                details: result.errors
            });
        }

        res.json({
            success: true,
            results: result.results.map(r => ({
                file: path.basename(r.file),
                type: r.type,
                size: r.size,
                success: r.success,
                error: r.error
            }))
        });
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('[API][SEND_MEDIA][ERROR]', errorMsg);
        res.status(500).json({ error: errorMsg });
    }
};

export const getMediaInfoController = async (req: Request, res: Response) => {
    try {

        const reqAny = req as any;
        if (!reqAny.file) {
            return res.status(400).json({ error: 'No file provided' });
        }
        
        const info = await mediaService.getMediaInfo(reqAny.file.path);
        
        // Clean up the uploaded file
        try {
            await fsPromises.unlink(reqAny.file.path);
        } catch (err) {
            console.error(`[API][MEDIA_INFO][CLEANUP] Failed to delete file ${reqAny.file.path}:`, err);
        }

        res.json(info);
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('[API][MEDIA_INFO][ERROR]', errorMsg);
        res.status(500).json({ error: errorMsg });
    }
};

export const downloadMediaController = async (req: Request, res: Response) => {
    const { contact, date, count } = req.query;
    try {

        if (!contact) return res.status(400).json({ error: 'Contact (number or name) is required' });
        let parsedDate: Date | undefined = undefined;
        if (date) {
            try {
                parsedDate = new Date(date as string);
                if (isNaN(parsedDate.getTime())) throw new Error('Invalid date');
            } catch {
                return res.status(400).json({ error: 'Invalid date format. Please use YYYY-MM-DD or DD/MM/YYYY.' });
            }
        }
        let mediaCount = 1;
        if (count) {
            mediaCount = parseInt(count as string, 10);
            if (isNaN(mediaCount) || mediaCount < 1) {
                return res.status(400).json({ error: 'Count must be a positive integer.' });
            }
        }
        // Fetch all media for the contact (and date if provided)
        const result = await downloadMediaByContact(
            contact as string,
            parsedDate,
            mediaCount
        );
        const files = result && result.files ? result.files : [];
        if (!files || files.length === 0) {
            console.warn(`[API][DOWNLOAD_MEDIA][WARN] No media found for contact='${contact}' date='${date || 'latest'}' count=${mediaCount}`);
            return res.status(404).json({ error: 'No media found for the specified contact/date.', contact, date, count: mediaCount });
        }
        // If only one file, send as download; if multiple, zip and send
        if (files.length === 1) {
            res.download(files[0], (err) => {
                if (err) {
                    console.error(`[API][DOWNLOAD_MEDIA][ERROR] Failed to send file:`, err);
                }
                // Clean up the file after sending
                fs.unlink(files[0], () => {});
            });
        } else {
            // TODO: Implement zip functionality for multiple files
            res.status(501).json({ error: 'Multiple file download not yet implemented' });
        }
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('[API][DOWNLOAD_MEDIA][ERROR]', errorMsg);
        res.status(500).json({ error: errorMsg });
    }
};

// --- Group management endpoints ---
export const addParticipantController = async (req: Request, res: Response) => {
    try {
        const { groupId, participantId } = req.body;
        await groupService.addParticipant(String(groupId), String(participantId));
        res.json({ success: true });
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(400).json({ error: errorMsg });
    }
};
export const removeParticipantController = async (req: Request, res: Response) => {
    try {
        const { groupId, participantId } = req.body;
        await groupService.removeParticipant(String(groupId), String(participantId));
        res.json({ success: true });
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(400).json({ error: errorMsg });
    }
};
export const promoteParticipantController = async (req: Request, res: Response) => {
    try {
        const { groupId, participantId } = req.body;
        await groupService.promoteParticipant(String(groupId), String(participantId));
        res.json({ success: true });
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(400).json({ error: errorMsg });
    }
};
export const demoteParticipantController = async (req: Request, res: Response) => {
    try {
        const { groupId, participantId } = req.body;
        await groupService.demoteParticipant(String(groupId), String(participantId));
        res.json({ success: true });
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(400).json({ error: errorMsg });
    }
};
export const getGroupInfoController = async (req: Request, res: Response) => {
    try {
        const { groupId } = req.query;
        const info = await groupService.getGroupInfo(String(groupId));
        res.json(info);
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(400).json({ error: errorMsg });
    }
};
export const setGroupSubjectController = async (req: Request, res: Response) => {
    try {
        const { groupId, subject } = req.body;
        await groupService.setGroupSubject(String(groupId), String(subject));
        res.json({ success: true });
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(400).json({ error: errorMsg });
    }
};
export const setGroupDescriptionController = async (req: Request, res: Response) => {
    try {
        const { groupId, description } = req.body;
        await groupService.setGroupDescription(String(groupId), String(description));
        res.json({ success: true });
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(400).json({ error: errorMsg });
    }
};

// --- Contact info/profile endpoints ---
export const getContactInfoController = async (req: Request, res: Response) => {
    try {
        const { contactId } = req.query;
        const info = await contactService.getContactInfo(String(contactId));
        res.json(info);
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(400).json({ error: errorMsg });
    }
};
export const getProfilePicUrlController = async (req: Request, res: Response) => {
    try {
        const { contactId } = req.query;
        const url = await contactService.getProfilePicUrl(String(contactId));
        res.json({ url });
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(400).json({ error: errorMsg });
    }
};

// --- Advanced message features ---
export const sendLocationController = async (req: Request, res: Response) => {
    try {
        const { to, latitude, longitude, description } = req.body;
        await messageAdvanced.sendLocation(String(to), Number(latitude), Number(longitude), description ? String(description) : undefined);
        res.json({ success: true });
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(400).json({ error: errorMsg });
    }
};
export const sendStickerController = async (req: Request, res: Response) => {
    try {
        const { to, filePath } = req.body;
        await messageAdvanced.sendSticker(String(to), String(filePath));
        res.json({ success: true });
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(400).json({ error: errorMsg });
    }
};
export const sendDocumentController = async (req: Request, res: Response) => {
    try {
        const { to, filePath, filename } = req.body;
        await messageAdvanced.sendDocument(String(to), String(filePath), filename ? String(filename) : undefined);
        res.json({ success: true });
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(400).json({ error: errorMsg });
    }
};
export const replyToMessageController = async (req: Request, res: Response) => {
    try {
        const { to, message, quotedMsgId } = req.body;
        await messageAdvanced.replyToMessage(String(to), String(message), String(quotedMsgId));
        res.json({ success: true });
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(400).json({ error: errorMsg });
    }
};
export const reactToMessageController = async (req: Request, res: Response) => {
    try {
        const { to, msgId, emoji } = req.body;
        await messageAdvanced.reactToMessage(String(to), String(msgId), String(emoji));
        res.json({ success: true });
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(400).json({ error: errorMsg });
    }
};
export const mentionUserController = async (req: Request, res: Response) => {
    try {
        const { to, message, mentionId } = req.body;
        await messageAdvanced.mentionUser(String(to), String(message), String(mentionId));
        res.json({ success: true });
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(400).json({ error: errorMsg });
    }
};

// --- Webhook/event system endpoints ---
export const setWebhookController = (req: Request, res: Response) => {
    try {
        const { url } = req.body;
        webhookService.setWebhook(String(url));
        res.json({ success: true });
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(400).json({ error: errorMsg });
    }
};

// Add health check controller
export const healthCheckController = async (req: Request, res: Response) => {
    try {
        const client = await getClient();
        if (!isClientReady) {
            return res.status(503).json({
                status: 'not_ready',
                message: 'WhatsApp client is not ready. Please connect and scan the QR code.'
            });
        }

        // Check if client is connected
        if (!client.info || !client.info.wid) {
            return res.status(503).json({
                status: 'disconnected',
                message: 'WhatsApp client is not connected.'
            });
        }

        res.json({
            status: 'healthy',
            message: 'WhatsApp client is ready and connected.',
            info: {
                pushname: client.info.pushname,
                wid: client.info.wid.user,
                platform: client.info.platform
            }
        });
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('[API][HEALTH][ERROR]', errorMsg);
        res.status(500).json({
            status: 'error',
            message: 'Failed to check WhatsApp client health.',
            error: errorMsg
        });
    }
};
