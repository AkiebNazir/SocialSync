import handleRestart from './whatsapp/restartHandler';

// Add restart handler for development
if (process.env.NODE_ENV === 'development') {
    process.on('message', async (message) => {
        if (typeof message === 'object' && message !== null && 'type' in message && (message as any).type === 'restart') {
            await handleRestart();
        }
    });
} 