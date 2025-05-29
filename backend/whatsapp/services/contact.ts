// Contact info/profile service for WhatsApp (modular)
import { getClient, isClientReady, validateStringInput } from './service';

export const getContactInfo = async (contactId: string) => {
    const client = getClient();
    if (!isClientReady) throw new Error('WhatsApp client is not ready.');
    validateStringInput(contactId, 'Contact ID');
    return (await client).getContactById(contactId);
};

export const getProfilePicUrl = async (contactId: string) => {
    const client = getClient();
    if (!isClientReady) throw new Error('WhatsApp client is not ready.');
    validateStringInput(contactId, 'Contact ID');
    return (await client).getProfilePicUrl(contactId);
};
