
"use client";

import type { Message, SocialPlatform } from '@/types';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Paperclip, Send, Users, User, Loader2 } from 'lucide-react'; // Added Loader2
import React, { useState, useRef, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';
import { socialPlatformsConfig } from '@/lib/mock-data';

interface MessageComposerProps {
  connectedPlatforms: SocialPlatform[];
  onSendMessage: (platform: SocialPlatform, content: string, type: 'direct' | 'group', recipient?: string) => Promise<void>;
  replyToMessage?: Message | null;
}

export function MessageComposer({ connectedPlatforms, onSendMessage, replyToMessage }: MessageComposerProps) {
  const [activeTab, setActiveTab] = useState<'direct' | 'group'>('direct');
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform | undefined>(
    connectedPlatforms.length > 0 ? connectedPlatforms[0] : undefined
  );
  const [messageContent, setMessageContent] = useState('');
  const [recipient, setRecipient] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (connectedPlatforms.length > 0 && !selectedPlatform && !connectedPlatforms.includes(selectedPlatform!)) {
      setSelectedPlatform(connectedPlatforms[0]);
    }
    if (connectedPlatforms.length === 0) {
      setSelectedPlatform(undefined);
    }
  }, [connectedPlatforms, selectedPlatform]);

  useEffect(() => {
    if (replyToMessage) {
      setSelectedPlatform(replyToMessage.platform);
      setActiveTab(replyToMessage.type);
      if (replyToMessage.type === 'direct') {
        // For WhatsApp, recipient might be a phone number or group ID.
        // For other platforms, it's likely the sender's name.
        setRecipient(replyToMessage.chatId && replyToMessage.platform === 'WhatsApp' ? replyToMessage.chatId : replyToMessage.sender);
      } else if (replyToMessage.type === 'group' && (replyToMessage.groupName || replyToMessage.chatId)) {
        setRecipient(replyToMessage.chatId && replyToMessage.platform === 'WhatsApp' ? replyToMessage.chatId : replyToMessage.groupName!);
      }
      textareaRef.current?.focus();
      // Prepend quoted reply
      const quotedText = `> ${replyToMessage.sender} wrote:\n> ${replyToMessage.content.split('\n').join('\n> ')}\n\n`;
      setMessageContent(quotedText);
    } else {
      // If not replying, ensure message content is clear if it was a reply before
      // setMessageContent(''); // Or clear based on your preference
    }
  }, [replyToMessage]);

  const handleSend = async () => {
    if (!selectedPlatform || !messageContent.trim()) {
      toast({ title: "Error", description: "Please select a platform and write a message.", variant: "destructive" });
      return;
    }
    if ((activeTab === 'direct' || activeTab === 'group') && !recipient.trim()) {
      toast({ title: "Error", description: `Please enter a ${activeTab === 'direct' ? 'recipient/contact ID' : 'group ID'}.`, variant: "destructive" });
      return;
    }
    
    setIsSending(true);
    try {
      // Remove the quoted text before sending if it's a reply
      let textToSend = messageContent;
      if (replyToMessage && messageContent.startsWith(`> ${replyToMessage.sender} wrote:`)) {
        const quotedText = `> ${replyToMessage.sender} wrote:\n> ${replyToMessage.content.split('\n').join('\n> ')}\n\n`;
        textToSend = messageContent.substring(quotedText.length);
      }
      await onSendMessage(selectedPlatform, textToSend, activeTab, recipient);
      setMessageContent(''); // Clear after successful send or processing attempt
      // Do not clear recipient by default
    } catch (error) {
      console.error("Message sending failed in composer:", error);
      // Error toast is now handled by the calling function in DashboardPage
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // For real integrations, this would involve uploading the file to a server
      // and then sending a message with a media URL.
      setMessageContent(prev => `${prev}\n[Attached (simulated): ${file.name}]`);
      toast({ title: "File Attached (Simulated)", description: `${file.name} "attached". Real media sending requires backend integration.`});
    }
  };

  return (
    <div className="p-4 border rounded-lg shadow-md bg-card">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'direct' | 'group')} className="mb-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="direct"><User className="mr-2 h-4 w-4" />Direct Message</TabsTrigger>
          <TabsTrigger value="group"><Users className="mr-2 h-4 w-4" />Group Post</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-4">
        <Select
          value={selectedPlatform}
          onValueChange={(value) => setSelectedPlatform(value as SocialPlatform)}
          disabled={connectedPlatforms.length === 0 || isSending}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a platform" />
          </SelectTrigger>
          <SelectContent>
            {connectedPlatforms.length > 0 ? (
              connectedPlatforms.map(platform => {
                 const Icon = socialPlatformsConfig[platform]?.icon;
                 return (
                    <SelectItem key={platform} value={platform}>
                      <div className="flex items-center gap-2">
                         {Icon && React.createElement(Icon, { className: "h-4 w-4"})}
                        {platform}
                      </div>
                    </SelectItem>
                 );
              })
            ) : (
              <SelectItem value="no-platforms" disabled>No connected platforms</SelectItem>
            )}
          </SelectContent>
        </Select>

        <input
          type="text"
          placeholder={activeTab === 'direct' ? "Recipient ID (e.g., Phone for WA, @username)" : "Group ID (e.g., group-id@g.us for WA)"}
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          className="w-full p-2 border rounded-md bg-background text-sm"
          disabled={isSending || (replyToMessage && replyToMessage.platform === 'WhatsApp')} // Disable if replying to WA to use existing chatId
          suppressHydrationWarning={true}
        />

        <Textarea
          ref={textareaRef}
          placeholder={replyToMessage ? `Replying...` : `Type your ${activeTab === 'direct' ? 'message' : 'post'} here...`}
          value={messageContent}
          onChange={(e) => setMessageContent(e.target.value)}
          rows={4}
          className="bg-background"
          disabled={isSending}
          suppressHydrationWarning={true}
        />
        <div className="flex justify-between items-center">
          <div>
            <Button variant="ghost" size="icon" onClick={() => document.getElementById('file-upload')?.click()} disabled={isSending}>
              <Paperclip className="h-5 w-5" />
              <span className="sr-only">Attach file</span>
            </Button>
            <input type="file" id="file-upload" className="hidden" onChange={handleFileUpload} disabled={isSending}/>
          </div>
          <Button onClick={handleSend} disabled={!selectedPlatform || !messageContent.trim() || !recipient.trim() || isSending}>
            {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send {activeTab === 'direct' ? 'Message' : 'Post'}
          </Button>
        </div>
      </div>
    </div>
  );
}
