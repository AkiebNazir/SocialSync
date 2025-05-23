
"use client";

import type { Message, SmartReply, SocialPlatform } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';
import { Paperclip, CornerDownRight, Download, Image as ImageIcon, Video, FileText, Reply, Loader2 } from 'lucide-react';
import { SocialIcon } from './social-icon';
import { getSmartReplySuggestions } from '@/services/social-service';
import React, { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import Image from 'next/image';

interface MessageItemProps {
  message: Message;
  onReply: (message: Message, replyText?: string) => void;
}

export function MessageItem({ message, onReply }: MessageItemProps) {
  const [smartReplies, setSmartReplies] = useState<SmartReply[]>([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [displayTimestamp, setDisplayTimestamp] = useState<string | null>("...");


  useEffect(() => {
    // Ensure this only runs on the client after hydration
    setDisplayTimestamp(formatDistanceToNow(new Date(message.timestamp), { addSuffix: true }));
  }, [message.timestamp]);

  const handleGenerateSmartReplies = async () => {
    if (smartReplies.length > 0) {
        setSmartReplies([]);
        return;
    }
    setIsLoadingReplies(true);
    try {
      const result = await getSmartReplySuggestions(message.content);
      setSmartReplies(result.suggestions.map((text, index) => ({ id: `${message.id}-reply-${index}`, text })));
    } catch (error) {
      console.error("Failed to generate smart replies:", error);
      toast({ title: "Error", description: "Could not generate smart replies.", variant: "destructive" });
    } finally {
      setIsLoadingReplies(false);
    }
  };

  const getFileIcon = (type: 'image' | 'video' | 'file' | 'audio' | 'sticker')  => {
    if (type === 'image') return <ImageIcon className="h-5 w-5 text-muted-foreground" />;
    if (type === 'video') return <Video className="h-5 w-5 text-muted-foreground" />;
    return <FileText className="h-5 w-5 text-muted-foreground" />;
  }

  return (
    <Card className={cn(
        "mb-4 shadow-card hover:shadow-card-hover transform transition-all duration-300 ease-out hover:scale-[1.015] group"
        // Removed: message.unread ? "border-primary border-2" : "border"
        // The default Card component already applies a border.
      )}>
      <CardHeader className="flex flex-row items-start gap-4 space-y-0 p-4">
        <Avatar className="h-10 w-10 border transition-transform duration-300 group-hover:scale-105">
          <AvatarImage src={message.avatar} alt={message.sender} data-ai-hint="person avatar"/>
          <AvatarFallback>{message.sender.substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">{message.sender}</CardTitle>
            <div className="flex items-center gap-2">
              <SocialIcon platform={message.platform} size={18} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {displayTimestamp}
              </span>
            </div>
          </div>
          {message.type === 'group' && message.groupName && (
            <p className="text-xs text-muted-foreground">in <span className="font-medium">{message.groupName}</span></p>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-sm text-foreground whitespace-pre-wrap">{message.content}</p>
        {message.media && message.media.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.media.map((item, index) => (
              <div key={index} className="flex items-center gap-2 p-2 border rounded-md bg-secondary/50 hover:bg-secondary/70 transition-colors duration-200">
                {item.type === 'image' && item.url.startsWith('https://placehold.co') ? (
                  <Image src={item.url} alt={item.name || 'media'} width={80} height={60} className="rounded-md object-cover" data-ai-hint="social media image"/>
                ) : (
                  getFileIcon(item.type)
                )}
                <span className="text-xs text-foreground flex-1 truncate">{item.name || item.type}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toast({ title: "Download", description: `Simulating download of ${item.name || item.type}`})}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="p-4 pt-0 flex flex-col items-start sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onReply(message)}>
            <Reply className="mr-1.5 h-4 w-4" />
            Reply
          </Button>
          <Button variant="outline" size="sm" onClick={handleGenerateSmartReplies} disabled={isLoadingReplies}>
            {isLoadingReplies ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CornerDownRight className="mr-1.5 h-4 w-4" />}
            {isLoadingReplies ? "Loading..." : (smartReplies.length > 0 ? "Hide Suggestions" : "Smart Reply")}
          </Button>
        </div>
        {message.unread && <Badge variant="default" className="mt-2 sm:mt-0">New</Badge>}
      </CardFooter>
      {smartReplies.length > 0 && (
        <div className="p-4 border-t bg-muted/30 animate-fade-in-up">
          <p className="text-xs font-medium text-muted-foreground mb-2">Suggestions:</p>
          <div className="flex flex-wrap gap-2">
            {smartReplies.map(reply => (
              <Button
                key={reply.id}
                variant="outline"
                size="sm"
                className="bg-accent/10 hover:bg-accent/20 text-accent-foreground border-accent/30"
                onClick={() => {
                  onReply(message, reply.text);
                  setSmartReplies([]);
                }}
              >
                {reply.text}
              </Button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
