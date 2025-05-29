// Event handlers for WhatsApp client
import { getClient } from './service';

export async function registerEventHandlers() {
    try {
        const client = await getClient();
        if (!client) {
            throw new Error('Client not initialized');
        }

        // Connection events
        client.on('ready', () => {
            console.log('[EVENT][READY] WhatsApp client is ready');
        });

        client.on('authenticated', () => {
            console.log('[EVENT][AUTHENTICATED] WhatsApp client is authenticated');
        });

        client.on('auth_failure', (msg) => {
            console.error('[EVENT][AUTH_FAILURE] Authentication failed:', msg);
        });

        // Message events
        client.on('message', async (msg) => {
            try {
                console.log('[EVENT][MESSAGE] Received message:', msg.body);
                // Add your message handling logic here
            } catch (error) {
                console.error('[EVENT][MESSAGE][ERROR] Failed to handle message:', error);
            }
        });

        client.on('message_create', async (msg) => {
            try {
                console.log('[EVENT][MESSAGE_CREATE] Message created:', msg.body);
                // Add your message creation handling logic here
            } catch (error) {
                console.error('[EVENT][MESSAGE_CREATE][ERROR] Failed to handle message creation:', error);
            }
        });

        // Group events
        client.on('group_join', async (notification) => {
            try {
                console.log('[EVENT][GROUP_JOIN] User joined group:', notification);
                // Add your group join handling logic here
            } catch (error) {
                console.error('[EVENT][GROUP_JOIN][ERROR] Failed to handle group join:', error);
            }
        });

        client.on('group_leave', async (notification) => {
            try {
                console.log('[EVENT][GROUP_LEAVE] User left group:', notification);
                // Add your group leave handling logic here
            } catch (error) {
                console.error('[EVENT][GROUP_LEAVE][ERROR] Failed to handle group leave:', error);
            }
        });

        // Connection state events
        client.on('disconnected', (reason) => {
            console.log('[EVENT][DISCONNECTED] Client disconnected:', reason);
        });

        client.on('change_state', (state) => {
            console.log('[EVENT][STATE_CHANGE] Client state changed:', state);
        });

        console.log('[EVENT_HANDLERS] Successfully registered event handlers');
    } catch (error) {
        console.error('[EVENT_HANDLERS] Failed to register event handlers:', error);
        throw error;
    }
} 