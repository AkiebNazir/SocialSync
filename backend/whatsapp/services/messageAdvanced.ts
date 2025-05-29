// Advanced message features: location, sticker, document, reply, reaction, mention
import { getClient, isClientReady, validateStringInput, resolveContactJid } from './service';
import { MessageMedia, Location } from 'whatsapp-web.js';

// Add null check helper
function assertClient(client: any): asserts client {
    if (!client) {
        throw new Error('WhatsApp client is not initialized');
    }
}

export const sendLocation = async (to: string, latitude: number, longitude: number, description?: string) => {
    const client = await getClient();
    assertClient(client);
    if (!isClientReady) throw new Error('WhatsApp client is not ready.');
    validateStringInput(to, 'Recipient contact');
    const jid = await resolveContactJid(to);
    if (!jid) throw new Error('Invalid contact');
    // Location expects options object, not string
    const location = new Location(latitude, longitude, description ? { name: description } : {});
    return client.sendMessage(jid, location);
};

export const sendSticker = async (to: string, filePath: string) => {
    const client = await getClient();
    assertClient(client);
    if (!isClientReady) throw new Error('WhatsApp client is not ready.');
    validateStringInput(to, 'Recipient contact');
    validateStringInput(filePath, 'File path');
    const jid = await resolveContactJid(to);
    if (!jid) throw new Error('Invalid contact');
    const media = await MessageMedia.fromFilePath(filePath);
    return client.sendMessage(jid, media, { sendMediaAsSticker: true });
};

export const sendDocument = async (to: string, filePath: string, filename?: string) => {
    const client = await getClient();
    assertClient(client);
    if (!isClientReady) throw new Error('WhatsApp client is not ready.');
    validateStringInput(to, 'Recipient contact');
    validateStringInput(filePath, 'File path');
    const jid = await resolveContactJid(to);
    if (!jid) throw new Error('Invalid contact');
    let media = await MessageMedia.fromFilePath(filePath);
    if (filename) media.filename = filename;
    return client.sendMessage(jid, media);
};

export const replyToMessage = async (to: string, message: string, quotedMsgId: string) => {
    const client = await getClient();
    assertClient(client);
    if (!isClientReady) throw new Error('WhatsApp client is not ready.');
    validateStringInput(to, 'Recipient contact');
    validateStringInput(message, 'Message content');
    validateStringInput(quotedMsgId, 'Quoted Message ID');
    const jid = await resolveContactJid(to);
    if (!jid) throw new Error('Invalid contact');
    const chat = await client.getChatById(jid);
    if (!chat) throw new Error('Chat not found');
    const quotedMsg = await chat.fetchMessages({ limit: 50 }).then(msgs => msgs.find((m: any) => m.id.id === quotedMsgId));
    if (!quotedMsg) throw new Error('Quoted message not found');
    return chat.sendMessage(message, { quotedMessageId: quotedMsg.id._serialized });
};

export const reactToMessage = async (to: string, msgId: string, emoji: string) => {
    const client = await getClient();
    assertClient(client);
    if (!isClientReady) throw new Error('WhatsApp client is not ready.');
    validateStringInput(to, 'Recipient contact');
    validateStringInput(msgId, 'Message ID');
    validateStringInput(emoji, 'Emoji');
    const jid = await resolveContactJid(to);
    if (!jid) throw new Error('Invalid contact');
    const chat = await client.getChatById(jid);
    if (!chat) throw new Error('Chat not found');
    const msg = await chat.fetchMessages({ limit: 50 }).then(msgs => msgs.find((m: any) => m.id.id === msgId));
    if (!msg) throw new Error('Message not found');
    return msg.react(emoji);
};

export const mentionUser = async (to: string, message: string, mentionId: string) => {
    const client = await getClient();
    assertClient(client);
    if (!isClientReady) throw new Error('WhatsApp client is not ready.');
    validateStringInput(to, 'Recipient contact');
    validateStringInput(message, 'Message content');
    validateStringInput(mentionId, 'Mention ID');
    const jid = await resolveContactJid(to);
    if (!jid) throw new Error('Invalid contact');
    const chat = await client.getChatById(jid);
    if (!chat) throw new Error('Chat not found');
    // Mentions should be an array of contact IDs (strings)
    return chat.sendMessage(message, { mentions: [mentionId] });
};
