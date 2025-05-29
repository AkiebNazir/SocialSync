// Webhook/event system for WhatsApp (modular)
import { getClient, isClientReady } from './service';
import { createLogger } from '../utils/logger';
import { Client } from 'whatsapp-web.js';

const logger = createLogger('WHATSAPP-WEBHOOK');

let webhookUrl: string | null = null;

export function setWebhook(url: string) {
    webhookUrl = url;
}

function postToWebhook(event: string, data: any) {
    if (!webhookUrl) return;
    require('axios').post(webhookUrl, { event, data }).catch((err: any) => {
        console.error('[WEBHOOK][ERROR]', err);
    });
}

export function registerEventHandlers() {
    logger.info('Registering event handlers');
    
    const client = getClient();
    if (!isClientReady) return;

    return {
        onMessage: (client: Client) => {
            client.on('message', async (message) => {
                try {
                    logger.debug('Message received', {
                        from: message.from,
                        type: message.type,
                        hasMedia: message.hasMedia
                    });

                    // Handle message based on type
                    if (message.hasMedia) {
                        logger.debug('Processing media message');
                        const media = await message.downloadMedia();
                        if (media) {
                            logger.info('Media downloaded successfully', {
                                type: media.mimetype,
                                size: media.data.length
                            });
                        }
                    }

                    // Log message content (sanitized)
                    if (message.body) {
                        logger.info('Message content', {
                            body: message.body.substring(0, 100) // Only log first 100 chars
                        });
                    }
                } catch (error) {
                    logger.error('Error processing message', {
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            });
        },

        onMessageAck: (client: Client) => {
            client.on('message_ack', (message, ack) => {
                logger.debug('Message acknowledgment received', {
                    messageId: message.id.id,
                    ack: ack
                });
    });
        },

        onGroupMessage: (client: Client) => {
            client.on('group_message', async (message) => {
                try {
                    logger.debug('Group message received', {
                        from: message.from,
                        author: message.author,
                        type: message.type
                    });

                    // Log group message content (sanitized)
                    if (message.body) {
                        logger.info('Group message content', {
                            body: message.body.substring(0, 100) // Only log first 100 chars
                        });
                    }
                } catch (error) {
                    logger.error('Error processing group message', {
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            });
        },

        onGroupParticipants: (client: Client) => {
            client.on('group_participants_changed', async (notification) => {
                try {
                    logger.info('Group participants changed', {
                        groupId: notification.id.id,
                        action: notification.action,
                        participants: notification.participants
                    });
                } catch (error) {
                    logger.error('Error processing group participants change', {
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            });
        },

        onContactStatus: (client: Client) => {
            client.on('contact_changed', async (message, oldId, newId, isGroup) => {
                try {
                    logger.info('Contact status changed', {
                        oldId,
                        newId,
                        isGroup
                    });
                } catch (error) {
                    logger.error('Error processing contact status change', {
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            });
        }
    };
}
