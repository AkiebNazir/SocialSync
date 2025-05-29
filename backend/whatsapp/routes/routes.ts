import { Router } from 'express';
import multer from 'multer';
import {
  connectWhatsApp,
  sendMessageController,
  scheduleMessageController,
  getUnreadMessagesController,
  getMessagesController,
  searchMessagesController,
  sendMediaController,
  downloadMediaController,
  addParticipantController,
  removeParticipantController,
  promoteParticipantController,
  demoteParticipantController,
  getGroupInfoController,
  setGroupSubjectController,
  setGroupDescriptionController,
  getContactInfoController,
  getProfilePicUrlController,
  sendLocationController,
  sendStickerController,
  sendDocumentController,
  replyToMessageController,
  reactToMessageController,
  mentionUserController,
  setWebhookController,
 getMediaInfoController,
  reconnectWhatsAppController,
  healthCheckController
} from '../controllers/controller';
import path from 'path';
import fs from 'fs';

const router = Router();

// Helper to wrap async route handlers
function asyncHandler(fn: any) {
  return function (req: any, res: any, next: any) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Get multer instance from app.locals if available (for testability)
function getUploadMiddleware() {
  // Fallback for test environments
  try {
    // @ts-ignore
    const upload = require('express').application.locals.upload;
    return upload;
  } catch {
    return multer(); // fallback, not used in prod
  }
}

// Route to start WhatsApp session and get QR code
router.get('/connect', asyncHandler(connectWhatsApp));

// Route to trigger WhatsApp session reconnection
router.get('/reconnect', asyncHandler(reconnectWhatsAppController));

// TODO: Add OTP-based authentication route

// Update send endpoint to expect 'to' (number or contact name)
router.post('/send', asyncHandler(sendMessageController));
router.post('/schedule', asyncHandler(scheduleMessageController));
router.get('/unread', asyncHandler(getUnreadMessagesController));
router.get('/messages', asyncHandler(getMessagesController));
router.get('/search', asyncHandler(searchMessagesController));

// Media endpoints
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + '-' + file.originalname);
    }
  }),
  limits: {
    fileSize: 16 * 1024 * 1024, // 16MB max file size
    files: 10 // Max 10 files per request
  }
});

// Media send endpoint: support single and multiple file uploads
router.post('/media/send', upload.array('files', 10), asyncHandler(sendMediaController));

// Media info endpoint: get information about a file before sending
router.post('/media/info', upload.single('file'), asyncHandler(getMediaInfoController));

// Update download media route to accept contact, date, and count as query params
router.get('/media/download', asyncHandler(downloadMediaController));

// --- Group management routes ---
router.post('/group/add', asyncHandler(addParticipantController));
router.post('/group/remove', asyncHandler(removeParticipantController));
router.post('/group/promote', asyncHandler(promoteParticipantController));
router.post('/group/demote', asyncHandler(demoteParticipantController));
router.get('/group/info', asyncHandler(getGroupInfoController));
router.post('/group/subject', asyncHandler(setGroupSubjectController));
router.post('/group/description', asyncHandler(setGroupDescriptionController));

// --- Contact info/profile routes ---
router.get('/contact/info', asyncHandler(getContactInfoController));
router.get('/contact/profile-pic', asyncHandler(getProfilePicUrlController));

// --- Advanced message features routes ---
router.post('/message/location', asyncHandler(sendLocationController));
router.post('/message/sticker', asyncHandler(sendStickerController));
router.post('/message/document', asyncHandler(sendDocumentController));
router.post('/message/reply', asyncHandler(replyToMessageController));
router.post('/message/react', asyncHandler(reactToMessageController));
router.post('/message/mention', asyncHandler(mentionUserController));

// --- Webhook/event system route ---
router.post('/webhook', asyncHandler(setWebhookController));

// Add health check route
router.get('/health', asyncHandler(healthCheckController));

export default router;
