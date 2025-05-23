
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MessageItem } from '@/components/message-item';
import { MessageComposer } from '@/components/message-composer';
import type { Message, Account, SocialPlatform } from '@/types';
import { initialAccounts, mockMessages as initialMockMessages, socialPlatformsConfig } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, FilterX, ListFilter, Search, AlertCircle, UserCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { fetchInitialMessages, sendMessageToPlatform, generateAiReply } from '@/services/social-service';

export default function DashboardPage() {
  const [messages, setMessages] = useState<Message[]>(initialMockMessages);
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlatformFilter, setSelectedPlatformFilter] = useState<SocialPlatform | 'all'>('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState<Date | undefined>(undefined);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);

  const loadInitialData = useCallback(async (currentAccounts: Account[]) => {
    setServiceError(null);
    let allFetchedMessages: Message[] = [];
    let hadError = false;

    for (const acc of currentAccounts) {
      if (acc.connected) {
        try {
          // The 'icon' property is not serializable and not needed by the server.
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { icon, ...serializableAccount } = acc;
          const fetched = await fetchInitialMessages(serializableAccount);
          allFetchedMessages = [...allFetchedMessages, ...fetched];
        } catch (error: any) {
          console.error(`Error fetching initial messages for ${acc.platform}:`, error);
          setServiceError(`Failed to fetch messages for ${acc.platform}. ${error.message}`);
          hadError = true;
          toast({
            title: `${acc.platform} Sync Error`,
            description: `Could not fetch initial data for ${acc.platform}.`,
            variant: "destructive"
          });
        }
      }
    }
    
    setMessages(prevMessages => {
        const existingIds = new Set(prevMessages.map(m => m.id));
        const uniqueNewMessages = allFetchedMessages.filter(nm => !existingIds.has(nm.id));
        // Combine unique new messages with existing messages that weren't re-fetched
        // This might need more sophisticated logic if messages can be updated
        const combined = [...uniqueNewMessages, ...prevMessages.filter(pm => !allFetchedMessages.find(fm => fm.id === pm.id))];
        return combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    });

    if (hadError && allFetchedMessages.length === 0 && messages.length === 0) {
      // Only set to initialMockMessages if there was an error AND no messages were fetched AND no messages currently exist
      // to avoid overwriting potentially good data if only one platform fails.
      setMessages(initialMockMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    }

  }, [messages.length]); // Added messages.length to dependencies to potentially re-evaluate fallback


  useEffect(() => {
    const storedAccounts = localStorage.getItem('socialSyncAccounts');
    let activeAccounts = initialAccounts;
    if (storedAccounts) {
       try {
        const parsedAccounts: Omit<Account, 'icon'>[] = JSON.parse(storedAccounts);
        activeAccounts = parsedAccounts.map(acc => {
          const platformConfig = socialPlatformsConfig[acc.platform as SocialPlatform];
          return {
            ...acc,
            icon: platformConfig ? platformConfig.icon : UserCircle, 
          } as Account; 
        });
        setAccounts(activeAccounts);
      } catch (error) {
        console.error("Failed to parse accounts from localStorage for dashboard", error);
        // If parsing fails, use initialAccounts and clear potentially corrupted localStorage
        activeAccounts = initialAccounts;
        setAccounts(initialAccounts); 
        localStorage.removeItem('socialSyncAccounts'); 
      }
    } else {
      // If no accounts in localStorage, use initialAccounts
      activeAccounts = initialAccounts;
      setAccounts(initialAccounts);
    }
    loadInitialData(activeAccounts);
  }, [loadInitialData]);


  const connectedPlatforms = useMemo(() => 
    accounts.filter(acc => acc.connected).map(acc => acc.platform)
  , [accounts]);

  const filteredMessages = useMemo(() => {
    return messages
      .filter(msg => {
        const platformMatch = selectedPlatformFilter === 'all' || msg.platform === selectedPlatformFilter;
        const searchMatch = searchTerm === '' || 
                            msg.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            msg.sender.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (msg.groupName && msg.groupName.toLowerCase().includes(searchTerm.toLowerCase()));
        const dateMatch = !selectedDateFilter || format(new Date(msg.timestamp), 'yyyy-MM-dd') === format(selectedDateFilter, 'yyyy-MM-dd');
        
        // Ensure we only show messages from connected platforms unless 'all' is selected for platform filter
        const connectedPlatformMatch = selectedPlatformFilter === 'all' || connectedPlatforms.includes(msg.platform);

        return platformMatch && searchMatch && dateMatch && (selectedPlatformFilter === 'all' ? true : connectedPlatformMatch);
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [messages, selectedPlatformFilter, searchTerm, selectedDateFilter, connectedPlatforms]);

  const handleSendMessage = async (platform: SocialPlatform, content: string, type: 'direct' | 'group', recipient?: string) => {
    if (!recipient) {
        toast({ title: "Error", description: "Recipient is required.", variant: "destructive" });
        return;
    }
    const accountFromState = accounts.find(acc => acc.platform === platform);
    if (!accountFromState || !accountFromState.connected) {
        toast({ title: "Error", description: `${platform} account not connected.`, variant: "destructive" });
        return;
    }
    setServiceError(null);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { icon, ...serializableAccount } = accountFromState; 
    const sentMessage = await sendMessageToPlatform(serializableAccount, content, type, recipient);

    if (sentMessage) {
      setMessages(prev => [sentMessage, ...prev].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      toast({ title: "Message Sent!", description: `Your message via ${platform} has been processed.` });
      
      if (replyToMessage) {
        setReplyToMessage(null); 
      }
      
      // Simulate AI reply for non-WhatsApp platforms OR for WhatsApp direct messages that didn't fail.
      if (platform !== 'WhatsApp' || (platform === 'WhatsApp' && type === 'direct')) {
         if (!sentMessage.content.startsWith("[FAILED TO SEND VIA BACKEND]")) {
            const recipientName = recipient; // Assuming recipient is the name/ID to reply to
            const aiGeneratedReply = await generateAiReply(content, platform, recipientName);
            if (aiGeneratedReply) {
            setTimeout(() => { // Add a slight delay for realism
                setMessages(prev => [aiGeneratedReply, ...prev].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
            }, 1500); // 1.5 second delay
            }
         }
      }

    } else {
      setServiceError(`Failed to send message via ${platform}. Check connection or server logs.`);
      toast({
        title: `${platform} Send Error`,
        description: `Could not send message. Check connection or server.`,
        variant: "destructive"
      });
    }
  };

  const handleReply = (message: Message) => {
    setReplyToMessage(message);
    const composerElement = document.getElementById('message-composer-section');
    composerElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedPlatformFilter('all');
    setSelectedDateFilter(undefined);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full max-h-[calc(100vh-theme(spacing.24))] lg:max-h-[calc(100vh-theme(spacing.32))]">
      <div className="flex-1 lg:flex-[3] flex flex-col gap-6 h-full">
        {serviceError && (
          <Alert variant="destructive" className="animate-fade-in-up">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Service Error</AlertTitle>
            <AlertDescription>
              {serviceError} Please check your connection or server status.
              <Button variant="link" className="p-0 h-auto ml-2" onClick={() => loadInitialData(accounts)}>Retry</Button>
            </AlertDescription>
          </Alert>
        )}
        <Card className="shadow-lg animate-fade-in-up delay-100">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><ListFilter size={20}/> Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search messages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-full"
                suppressHydrationWarning={true}
              />
            </div>

            <Select value={selectedPlatformFilter} onValueChange={(value) => setSelectedPlatformFilter(value as SocialPlatform | 'all')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filter by platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                {Object.keys(socialPlatformsConfig).map(platformKey => {
                  const platform = platformKey as SocialPlatform;
                  const ConfigIcon = socialPlatformsConfig[platform].icon;
                  return (
                    <SelectItem key={platformKey} value={platformKey} disabled={!connectedPlatforms.includes(platform) && platformKey !== 'all'}>
                       <div className="flex items-center gap-2">
                         <ConfigIcon className="h-4 w-4" />
                         {socialPlatformsConfig[platform].name || platformKey} {!connectedPlatforms.includes(platform) && platformKey !=='all' && "(Disconnected)"}
                       </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDateFilter ? format(selectedDateFilter, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDateFilter}
                  onSelect={setSelectedDateFilter}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
             <Button variant="outline" onClick={clearFilters} className="w-full">
                <FilterX className="mr-2 h-4 w-4" /> Clear Filters
            </Button>
          </CardContent>
        </Card>

        <Card className="flex-1 flex flex-col h-0 min-h-[300px] shadow-lg animate-fade-in-up delay-200">
          <CardHeader>
            <CardTitle className="text-lg">Unified Inbox</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full p-4 pt-0">
              {filteredMessages.length > 0 ? (
                filteredMessages.map(msg => (
                  <MessageItem key={msg.id} message={msg} onReply={handleReply} />
                ))
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  <Search size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No messages found.</p>
                  <p className="text-sm">Try adjusting your filters or connecting more accounts!</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div id="message-composer-section" className="lg:flex-1 lg:sticky lg:top-[calc(theme(spacing.16)_+_theme(spacing.6))] lg:max-h-[calc(100vh-theme(spacing.16)-theme(spacing.12))] animate-fade-in-up delay-300">
         <Card className="h-full shadow-lg">
            <CardHeader>
                <CardTitle className="text-lg">{replyToMessage ? `Replying to ${replyToMessage.sender}` : "Compose Message"}</CardTitle>
            </CardHeader>
            <CardContent>
                <MessageComposer
                    connectedPlatforms={connectedPlatforms}
                    onSendMessage={handleSendMessage}
                    replyToMessage={replyToMessage}
                 />
            </CardContent>
         </Card>
      </div>
    </div>
  );
}
