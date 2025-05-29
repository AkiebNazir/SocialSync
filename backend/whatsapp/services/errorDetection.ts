// Error/ban detection and recovery for WhatsApp (modular)
import { createLogger } from '../utils/logger';
import { Client } from 'whatsapp-web.js';

const logger = createLogger('WHATSAPP-ERROR');

export function registerErrorHandlers() {
    logger.info('Registering error handlers');

    return {
        onConnectionError: (client: Client) => {
            client.on('disconnected', (reason) => {
                logger.error('Client disconnected', {
                    reason,
                    timestamp: new Date().toISOString()
                });
            });

            client.on('change_state', (state) => {
                logger.info('Client state changed', {
                    state,
                    timestamp: new Date().toISOString()
                });
            });
        },

        onAuthenticationError: (client: Client) => {
            client.on('auth_failure', (error: any) => {
                logger.error('Authentication failed', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: new Date().toISOString()
                });
            });
        },

        onMessageError: (client: Client) => {
            client.on('message_revoke_everyone', async (after: any, before: any) => {
                try {
                    logger.info('Message revoked', {
                        after: after.id.id,
                        before: before.id.id,
                        timestamp: new Date().toISOString()
                    });
                } catch (error) {
                    logger.error('Error processing message revocation', {
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            });

            client.on('message_revoke_me', async (after: any, before: any) => {
                try {
                    logger.info('Message revoked by sender', {
                        after: after.id.id,
                        before: before.id.id,
                        timestamp: new Date().toISOString()
                    });
                } catch (error) {
                    logger.error('Error processing message revocation', {
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            });
        },

        onMediaError: (client: Client) => {
            client.on('media_uploaded', (message) => {
                logger.debug('Media uploaded successfully', {
                    messageId: message.id.id,
                    timestamp: new Date().toISOString()
                });
            });

            client.on('media_upload_failed', (message, error) => {
                logger.error('Media upload failed', {
                    messageId: message.id.id,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: new Date().toISOString()
                });
            });
        },

        onGroupError: (client: Client) => {
            client.on('group_admin_changed', async (notification: any) => {
                try {
                    logger.info('Group admin changed', {
                        groupId: notification.id.id,
                        newAdmins: notification.newAdmins,
                        timestamp: new Date().toISOString()
                    });
                } catch (error) {
                    logger.error('Error processing group admin change', {
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            });

            client.on('group_settings_changed', async (notification) => {
                try {
                    logger.info('Group settings changed', {
                        groupId: notification.id.id,
                        changes: notification.changes,
                        timestamp: new Date().toISOString()
                    });
                } catch (error) {
                    logger.error('Error processing group settings change', {
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            });
        }
    };
}
