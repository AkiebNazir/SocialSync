import { reinitialize } from './services/service';
import {logger} from './utils/logger';

let isReconnecting = false;

// Handle process events
process.on('SIGTERM', async () => {
    if (isReconnecting) return;
    isReconnecting = true;
    logger.info('SIGTERM received, cleaning up...');
    try {
        await reinitialize();
    } catch (error) {
        logger.error('Failed to reconnect after SIGTERM:', error);
    } finally {
        isReconnecting = false;
    }
});

process.on('SIGINT', async () => {
    if (isReconnecting) return;
    isReconnecting = true;
    logger.info('SIGINT received, cleaning up...');
    try {
        await reinitialize();
    } catch (error) {
        logger.error('Failed to reconnect after SIGINT:', error);
    } finally {
        isReconnecting = false;
    }
});

// Handle file change events (for development)
if (process.env.NODE_ENV === 'development') {
    process.on('message', async (message: any) => {
        if (message.type === 'restart' && !isReconnecting) {
            isReconnecting = true;
            logger.info('Restart detected, reinitializing WhatsApp client...');
            try {
                await reinitialize();
                logger.info('WhatsApp client reinitialized successfully');
            } catch (error) {
                logger.error('Failed to reinitialize WhatsApp client:', error);
                if (error instanceof Error && error.message === 'Session expired, QR code required') {
                    logger.info('Please scan the QR code to reconnect');
                }
            } finally {
                isReconnecting = false;
            }
        }
    });
}

export default async function handleRestart() {
    if (isReconnecting) {
        logger.warn('Reconnection already in progress');
        return;
    }
    
    isReconnecting = true;
    try {
        await reinitialize();
        logger.info('WhatsApp client reinitialized after restart');
    } catch (error) {
        logger.error('Failed to reinitialize WhatsApp client after restart:', error);
        if (error instanceof Error && error.message === 'Session expired, QR code required') {
            logger.info('Please scan the QR code to reconnect');
        }
    } finally {
        isReconnecting = false;
    }
} 