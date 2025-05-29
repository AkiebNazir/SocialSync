// Group management service for WhatsApp (modular)
import { Client, GroupChat } from 'whatsapp-web.js';
import { getClient, isClientReady, validateStringInput } from './service';

export const addParticipant = async (groupId: string, participantId: string) => {
    const client = await getClient();
    if (!isClientReady) throw new Error('WhatsApp client is not ready.');
    validateStringInput(groupId, 'Group ID');
    validateStringInput(participantId, 'Participant ID');
    const chat = await client.getChatById(groupId);
    if (!chat.isGroup) throw new Error('Not a group chat');
    return (chat as GroupChat).addParticipants([participantId]);
};

export const removeParticipant = async (groupId: string, participantId: string) => {
    const client = await getClient();
    if (!isClientReady) throw new Error('WhatsApp client is not ready.');
    validateStringInput(groupId, 'Group ID');
    validateStringInput(participantId, 'Participant ID');
    const chat = await client.getChatById(groupId);
    if (!chat.isGroup) throw new Error('Not a group chat');
    return (chat as GroupChat).removeParticipants([participantId]);
};

export const promoteParticipant = async (groupId: string, participantId: string) => {
    const client = await getClient();
    if (!isClientReady) throw new Error('WhatsApp client is not ready.');
    validateStringInput(groupId, 'Group ID');
    validateStringInput(participantId, 'Participant ID');
    const chat = await client.getChatById(groupId);
    if (!chat.isGroup) throw new Error('Not a group chat');
    return (chat as GroupChat).promoteParticipants([participantId]);
};

export const demoteParticipant = async (groupId: string, participantId: string) => {
    const client = await getClient();
    if (!isClientReady) throw new Error('WhatsApp client is not ready.');
    validateStringInput(groupId, 'Group ID');
    validateStringInput(participantId, 'Participant ID');
    const chat = await client.getChatById(groupId);
    if (!chat.isGroup) throw new Error('Not a group chat');
    return (chat as GroupChat).demoteParticipants([participantId]);
};

export const getGroupInfo = async (groupId: string) => {
    const client =  await getClient();
    if (!isClientReady) throw new Error('WhatsApp client is not ready.');
    validateStringInput(groupId, 'Group ID');
    const chat = await client.getChatById(groupId);
    if (!chat.isGroup) throw new Error('Not a group chat');
    return chat;
};

export const setGroupSubject = async (groupId: string, subject: string) => {
    const client = await getClient();
    if (!isClientReady) throw new Error('WhatsApp client is not ready.');
    validateStringInput(groupId, 'Group ID');
    validateStringInput(subject, 'Subject');
    const chat = await client.getChatById(groupId);
    if (!chat.isGroup) throw new Error('Not a group chat');
    return (chat as GroupChat).setSubject(subject);
};

export const setGroupDescription = async (groupId: string, description: string) => {
    const client = await getClient();
    if (!isClientReady) throw new Error('WhatsApp client is not ready.');
    validateStringInput(groupId, 'Group ID');
    validateStringInput(description, 'Description');
    const chat = await client.getChatById(groupId);
    if (!chat.isGroup) throw new Error('Not a group chat');
    return (chat as GroupChat).setDescription(description);
};
