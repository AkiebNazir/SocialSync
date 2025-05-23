import type { Account, Message, SocialPlatform } from '@/types';
import { Facebook, Instagram, Linkedin, MessageCircle, Twitter, UserCircle, type LucideIcon } from 'lucide-react';

export const socialPlatformsConfig: { [key in SocialPlatform]: { icon: LucideIcon, color: string } } = {
  Facebook: { icon: Facebook, color: "bg-blue-600 hover:bg-blue-700" },
  WhatsApp: { icon: MessageCircle, color: "bg-green-500 hover:bg-green-600" },
  X: { icon: Twitter, color: "bg-sky-500 hover:bg-sky-600" }, // Assuming X uses Twitter icon for familiarity
  Instagram: { icon: Instagram, color: "bg-pink-500 hover:bg-pink-600" },
  LinkedIn: { icon: Linkedin, color: "bg-blue-700 hover:bg-blue-800" },
};

export const initialAccounts: Account[] = [
  { id: "Facebook", platform: "Facebook", name: "Facebook", connected: false, icon: socialPlatformsConfig.Facebook.icon, username: "fb_user", apiUserId: undefined },
  { id: "WhatsApp", platform: "WhatsApp", name: "WhatsApp", connected: false, icon: socialPlatformsConfig.WhatsApp.icon, username: "+1234567890", apiUserId: undefined },
  { id: "X", platform: "X", name: "X (Twitter)", connected: false, icon: socialPlatformsConfig.X.icon, username: "@x_user", apiUserId: undefined },
  { id: "Instagram", platform: "Instagram", name: "Instagram", connected: false, icon: socialPlatformsConfig.Instagram.icon, username: "insta_user", apiUserId: undefined },
  { id: "LinkedIn", platform: "LinkedIn", name: "LinkedIn", connected: false, icon: socialPlatformsConfig.LinkedIn.icon, username: "linkedin_user", apiUserId: undefined },
];

export const mockMessages: Message[] = [
  {
    id: "1",
    platform: "Facebook",
    sender: "Alice Wonderland",
    avatar: "https://placehold.co/40x40.png?text=AW",
    content: "Hey, are you free for a call later today? Wanted to discuss the project.",
    timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
    unread: true,
    type: "direct",
  },
  {
    id: "2",
    platform: "WhatsApp",
    sender: "Bob The Builder",
    avatar: "https://placehold.co/40x40.png?text=BB",
    content: "Can we build it? Yes, we can!",
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    unread: true,
    type: "direct",
  },
  {
    id: "3",
    platform: "X",
    sender: "Tech News",
    avatar: "https://placehold.co/40x40.png?text=TN",
    content: "Breaking: New AI model announced! #AI #Tech",
    timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
    unread: false,
    type: "group",
    groupName: "Tech Updates Feed"
  },
  {
    id: "4",
    platform: "Instagram",
    sender: "Travel Influencer",
    avatar: "https://placehold.co/40x40.png?text=TI",
    content: "Just posted a new reel from my trip to Bali! Check it out!",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    unread: true,
    type: "direct",
    media: [{ type: 'image', url: 'https://placehold.co/300x200.png', name: 'bali_sunset.jpg' }]
  },
  {
    id: "5",
    platform: "LinkedIn",
    sender: "Recruiter Jane",
    avatar: "https://placehold.co/40x40.png?text=RJ",
    content: "Hi there, I came across your profile and was very impressed. Are you open to new opportunities?",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
    unread: false,
    type: "direct",
  },
  {
    id: "6",
    platform: "Facebook",
    sender: "Family Group",
    avatar: "https://placehold.co/40x40.png?text=FG",
    content: "Don't forget about the family BBQ this Saturday!",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    unread: false,
    type: "group",
    groupName: "Smith Family Chat"
  },
   {
    id: "7",
    platform: "WhatsApp",
    sender: "Project Team",
    avatar: "https://placehold.co/40x40.png?text=PT",
    content: "Meeting minutes attached.",
    timestamp: new Date(Date.now() - 1000 * 60 * 120), // 2 hours ago
    unread: true,
    type: "group",
    groupName: "Project Phoenix",
    media: [{ type: 'file', url: '#', name: 'meeting_minutes.pdf' }]
  },
];
