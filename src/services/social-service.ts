
'use server';
import type { Account, Message, SocialPlatform } from '@/types';
import { generateSmartReplies, type SmartReplyInput, type SmartReplyOutput } from '@/ai/flows/smart-reply-suggestions';
import { mockMessages, initialAccounts } from '@/lib/mock-data'; // For simulations

const WHATSAPP_SERVER_URL = process.env.NEXT_PUBLIC_WHATSAPP_SERVER_URL || 'http://localhost:3000';

// Helper to simulate API delay
const simulateApiDelay = (ms: number = 500) => new Promise(resolve => setTimeout(resolve, ms));


export async function fetchInitialMessages(account: Account): Promise<Message[]> {
  if (account.platform === 'WhatsApp' && account.connected) {
    try {
      const unreadRes = await fetch(`${WHATSAPP_SERVER_URL}/api/messages/unread`);
      if (!unreadRes.ok) {
        const errorData = await unreadRes.json().catch(() => ({}));
        console.error(`WhatsApp server error (fetching unread): ${errorData.message || unreadRes.statusText}`);
        // Fallback to mock messages or empty array if API fails
        return mockMessages.filter(m => m.platform === 'WhatsApp'); 
      }
      const unreadData = await unreadRes.json();
      
      const newWhatsAppMessages: Message[] = unreadData.messages.map((msg: any) => ({
        id: msg.id || `wa-${Date.now()}-${Math.random()}`,
        platform: 'WhatsApp',
        sender: msg.fromName || msg.from.split('@')[0],
        avatar: `https://placehold.co/40x40.png?text=${(msg.fromName || msg.from.split('@')[0]).substring(0,2).toUpperCase()}`,
        content: msg.body,
        timestamp: new Date(msg.timestamp * 1000),
        unread: true, 
        type: msg.chatId.includes('@g.us') ? 'group' : 'direct',
        groupName: msg.chatId.includes('@g.us') ? 'WhatsApp Group' : undefined,
        chatId: msg.chatId,
        isSentByMe: msg.fromMe || false,
      }));
      return newWhatsAppMessages;
    } catch (error: any) {
      console.error("Error fetching WhatsApp data from service:", error);
      // Fallback or specific error handling
      return mockMessages.filter(m => m.platform === 'WhatsApp');
    }
  } else if (account.connected) {
    // Simulate fetching for other connected platforms
    await simulateApiDelay();
    return mockMessages.filter(m => m.platform === account.platform);
  }
  return []; // No messages if not connected or not WhatsApp for now
}

export async function sendMessageToPlatform(
  account: Account,
  content: string,
  type: 'direct' | 'group',
  recipient?: string
): Promise<Message | null> {
  if (!account.connected || !recipient) {
    console.error("Account not connected or recipient missing");
    return null;
  }

  const newMessageBase: Omit<Message, 'id' | 'timestamp'> = {
    platform: account.platform,
    sender: "You", 
    avatar: "https://placehold.co/40x40.png?text=Me",
    content,
    unread: false,
    type,
    groupName: type === 'group' ? recipient : undefined,
    chatId: recipient, // Assuming recipient is chatId for WhatsApp
    isSentByMe: true,
  };

  if (account.platform === 'WhatsApp') {
    try {
      const endpoint = type === 'direct' ? `${WHATSAPP_SERVER_URL}/api/messages/send` : `${WHATSAPP_SERVER_URL}/api/groups/send`;
      const body = type === 'direct' ? { to: recipient, message: content } : { groupId: recipient, message: content };
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `WhatsApp server error (sending): ${response.statusText}`);
      }
      const responseData = await response.json();
      return {
        ...newMessageBase,
        id: responseData.messageId || String(Date.now()),
        timestamp: new Date(),
      };
    } catch (error: any) {
      console.error(`Error sending WhatsApp message via service: ${error.message}`);
      // Return a message indicating failure to send through backend
      return {
        ...newMessageBase,
        id: String(Date.now()),
        timestamp: new Date(),
        content: `[FAILED TO SEND VIA BACKEND] ${content}`,
      };
    }
  } else {
    // Simulate sending for other platforms
    await simulateApiDelay();
    console.log(`Simulated send for ${account.platform}: To ${recipient}, Content: ${content}`);
    return {
      ...newMessageBase,
      id: String(Date.now()),
      timestamp: new Date(),
    };
  }
}

export async function generateAiReply(originalMessageContent: string, platform: SocialPlatform, recipientName: string): Promise<Message | null> {
  // For now, AI replies are only simulated for non-WhatsApp to avoid conflict with real WhatsApp replies
  // or if explicitly desired for WhatsApp.
  // This logic can be expanded based on requirements.
  if (platform === 'WhatsApp') { 
    // If it's a real WhatsApp integration, we typically wouldn't generate an AI reply *from* the recipient.
    // However, we might generate reply *suggestions for the user*, which is already handled by `getSmartReplySuggestions`.
    return null;
  }

  try {
    await simulateApiDelay(2000); // Simulate AI thinking time
    const smartReplyInput: SmartReplyInput = { message: originalMessageContent };
    const replySuggestions = await generateSmartReplies(smartReplyInput);
    
    let replyContent = "Okay, got your message! (Simulated)"; 
    if (replySuggestions.suggestions && replySuggestions.suggestions.length > 0) {
        replyContent = replySuggestions.suggestions[Math.floor(Math.random() * replySuggestions.suggestions.length)];
    }

    const replyMsg: Message = {
        id: String(Date.now()) + '_sim_reply',
        platform: platform,
        sender: recipientName, // The person who "received" the message
        avatar: `https://placehold.co/40x40.png?text=${recipientName.substring(0,2).toUpperCase()}`,
        content: replyContent,
        timestamp: new Date(),
        unread: true,
        type: 'direct', // Assuming AI replies are direct for now
        isSentByMe: false,
    };
    return replyMsg;
  } catch (error) {
    console.error("Error generating simulated AI reply:", error);
    return null;
  }
}

export async function getSmartReplySuggestions(messageContent: string): Promise<SmartReplyOutput> {
  try {
    const result = await generateSmartReplies({ message: messageContent });
    return result;
  } catch (error) {
    console.error("Failed to generate smart replies from service:", error);
    return { suggestions: [] }; // Return empty on error
  }
}

// Placeholder for future authentication functions
export async function initiatePlatformAuth(platform: SocialPlatform): Promise<{ redirectUrl?: string; error?: string }> {
  console.log(`Simulating auth initiation for ${platform}`);
  await simulateApiDelay();
  // In a real scenario, this would redirect to the platform's OAuth page
  // or return specific instructions.
  if (platform === "Facebook") {
    // return { redirectUrl: `https://www.facebook.com/v12.0/dialog/oauth?client_id=...&redirect_uri=...&scope=...` };
    return { error: `${platform} OAuth flow not implemented yet.` };
  }
  return { error: `${platform} authentication not implemented yet.` };
}

export async function handlePlatformAuthCallback(platform: SocialPlatform, callbackParams: any): Promise<Account | null> {
  console.log(`Simulating auth callback handling for ${platform} with params:`, callbackParams);
  await simulateApiDelay();
  // In a real scenario, exchange code for token, fetch user profile, then update account.
  const accountToUpdate = initialAccounts.find(acc => acc.platform === platform);
  if (accountToUpdate) {
    return { ...accountToUpdate, connected: true, apiUserId: `mock_api_id_${platform.toLowerCase()}` };
  }
  return null;
}

export async function disconnectPlatform(platform: SocialPlatform, account: Account): Promise<Account> {
    console.log(`Simulating disconnection for ${platform}`);
    await simulateApiDelay();
    // In a real scenario, this might involve revoking tokens on the backend.
    return { ...account, connected: false, apiUserId: undefined };
}
