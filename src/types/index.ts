
import type { LucideIcon } from 'lucide-react';

export type SocialPlatform = "Facebook" | "WhatsApp" | "X" | "Instagram" | "LinkedIn";

export interface Account {
  id: SocialPlatform;
  platform: SocialPlatform;
  name: string;
  connected: boolean;
  icon?: LucideIcon; // Made icon optional
  username?: string;
  apiUserId?: string;
  lastSync?: Date;
}

export interface MessageMedia {
  type: 'image' | 'video' | 'file' | 'audio' | 'sticker';
  url: string;
  name?: string;
  mimeType?: string;
  size?: number;
}

export interface Message {
  id: string;
  platform: SocialPlatform;
  sender: string;
  senderName?: string;
  avatar?: string;
  content: string;
  timestamp: Date;
  unread: boolean;
  type: 'direct' | 'group';
  groupName?: string;
  chatId?: string;
  media?: MessageMedia[];
  isSentByMe?: boolean;
}

export interface SmartReply {
  id: string;
  text: string;
}

export interface WhatsAppChatMessage {
  id: { _serialized: string };
  from: string;
  to: string;
  body: string;
  timestamp: number;
  type: string;
  hasMedia: boolean;
  chatId: { _serialized: string };
  _data?: { notifyName?: string };
  author?: string;
}

export interface WhatsAppChat {
  id: { _serialized: string };
  name: string;
  isGroup: boolean;
  unreadCount: number;
  timestamp: number;
  lastMessage?: {
    body: string;
    timestamp: number;
  };
}
