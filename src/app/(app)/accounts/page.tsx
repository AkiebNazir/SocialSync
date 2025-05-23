
"use client";

import React, { useState, useEffect } from 'react';
import { AccountCard } from '@/components/account-card';
import type { Account, SocialPlatform } from '@/types';
import { initialAccounts, socialPlatformsConfig } from '@/lib/mock-data';
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, UserCircle } from 'lucide-react';
import { WhatsAppConnectModal } from '@/components/whatsapp-connect-modal';
import { SocialConnectModal } from '@/components/social-connect-modal';
import { disconnectPlatform } from '@/services/social-service';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [searchTerm, setSearchTerm] = useState('');

  // WhatsApp Modal States
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppConnecting, setWhatsAppConnecting] = useState(false);

  // Generic Social Connect Modal States
  const [showSocialConnectModal, setShowSocialConnectModal] = useState(false);
  const [connectingAccount, setConnectingAccount] = useState<Account | null>(null);
  const [isSubmittingSocialConnect, setIsSubmittingSocialConnect] = useState(false);


  useEffect(() => {
    const storedAccounts = localStorage.getItem('socialSyncAccounts');
    if (storedAccounts) {
      try {
        const parsedAccounts: Omit<Account, 'icon'>[] = JSON.parse(storedAccounts);
        const rehydratedAccounts = parsedAccounts.map(acc => {
          const platformConfig = socialPlatformsConfig[acc.platform as SocialPlatform];
          return {
            ...acc,
            icon: platformConfig ? platformConfig.icon : UserCircle,
            apiUserId: acc.apiUserId || undefined, // Ensure undefined if missing/falsy
          };
        }) as Account[];
        setAccounts(rehydratedAccounts);
      } catch (error) {
        console.error("Failed to parse accounts from localStorage", error);
        const serializableInitialAccounts = initialAccounts.map(({ icon, ...rest }) => rest);
        setAccounts(initialAccounts);
        localStorage.setItem('socialSyncAccounts', JSON.stringify(serializableInitialAccounts));
      }
    } else {
      const serializableInitialAccounts = initialAccounts.map(({ icon, ...rest }) => rest);
      setAccounts(initialAccounts);
      localStorage.setItem('socialSyncAccounts', JSON.stringify(serializableInitialAccounts));
    }
  }, []);

  const updateAndStoreAccounts = (updatedAccounts: Account[]) => {
    setAccounts(updatedAccounts);
    const accountsToStore = updatedAccounts.map(({ icon, ...rest }) => rest);
    localStorage.setItem('socialSyncAccounts', JSON.stringify(accountsToStore));
  };

  const handleConnectToggle = async (accountId: string) => {
    const accountToToggle = accounts.find(acc => acc.id === accountId);
    if (!accountToToggle) return;

    let nextAccountsState = [...accounts];
    let toastTitle = "";
    let toastMessage = "";

    if (accountToToggle.platform === 'WhatsApp') {
      if (!accountToToggle.connected) {
        setShowWhatsAppModal(true);
      } else {
        // Disconnect WhatsApp
        const { icon, ...serializableAccount } = accountToToggle;
        const updatedAccountInfoFromService = await disconnectPlatform(serializableAccount.platform, serializableAccount);
        nextAccountsState = accounts.map(acc => {
          if (acc.id === accountId) {
            return {
              ...acc,
              connected: false,
              apiUserId: undefined, // Explicitly ensure apiUserId is cleared for WhatsApp too
              username: updatedAccountInfoFromService.username || acc.username,
              icon: accountToToggle.icon,
            };
          }
          return acc;
        });
        toastTitle = "Account Disconnected";
        toastMessage = `${accountToToggle.name} has been disconnected.`;
        updateAndStoreAccounts(nextAccountsState);
        toast({ title: toastTitle, description: toastMessage, variant: "default" });
      }
      return;
    }

    // For other platforms
    if (accountToToggle.connected) {
      // Disconnect
      const { icon, ...serializableAccount } = accountToToggle;
      const updatedAccountInfoFromService = await disconnectPlatform(serializableAccount.platform, serializableAccount); // This service call returns apiUserId: undefined

      nextAccountsState = accounts.map(acc => {
        if (acc.id === accountId) {
          return {
            ...acc, // Keep original id, platform, name etc.
            connected: false, // Set by service, or explicitly false
            apiUserId: undefined, // Explicitly ensure apiUserId is undefined
            username: updatedAccountInfoFromService.username || acc.username, // Preserve username from service or original
            icon: accountToToggle.icon, // Preserve original icon
          };
        }
        return acc;
      });
      toastTitle = "Account Disconnected";
      toastMessage = `${accountToToggle.name} has been disconnected.`;
      updateAndStoreAccounts(nextAccountsState);
      toast({ title: toastTitle, description: toastMessage, variant: "default" });
    } else {
      // Connect
      // console.log(`Attempting to connect ${accountToToggle.name}. Current apiUserId: `, accountToToggle.apiUserId); // Useful for debugging
      if (!accountToToggle.apiUserId) { // First time connecting this specific platform instance (apiUserId is undefined)
        setConnectingAccount(accountToToggle);
        setShowSocialConnectModal(true);
      } else {
        // Already "authenticated" before (apiUserId exists), simulate direct re-connection
        nextAccountsState = accounts.map(acc =>
          acc.id === accountId ? { ...acc, connected: true, icon: acc.icon } : acc
        );
        toastTitle = "Account Reconnected";
        toastMessage = `${accountToToggle.name} has been reconnected.`;
        updateAndStoreAccounts(nextAccountsState);
        toast({ title: toastTitle, description: toastMessage, variant: "default" });
      }
    }
  };

  const handleWhatsAppConnectionSuccess = () => {
    setWhatsAppConnecting(false);
    const updatedAccounts = accounts.map(acc =>
      acc.platform === 'WhatsApp' ? { ...acc, connected: true, apiUserId: 'whatsapp_connected_via_server' } : acc
    );
    updateAndStoreAccounts(updatedAccounts);
    setShowWhatsAppModal(false);
    toast({
      title: "WhatsApp Connected",
      description: "WhatsApp is now connected via your Node.js server.",
    });
  };

  const handleSocialConnectSubmit = (credentials: { username: string; password?: string }) => {
    if (!connectingAccount) return;
    setIsSubmittingSocialConnect(true);
    // Simulate API call / saving credentials
    setTimeout(() => {
      const updatedAccounts = accounts.map(acc =>
        acc.id === connectingAccount.id
          ? { ...acc, connected: true, apiUserId: `simulated_token_for_${acc.platform}_${credentials.username}`, username: credentials.username }
          : acc
      );
      updateAndStoreAccounts(updatedAccounts);
      setIsSubmittingSocialConnect(false);
      setShowSocialConnectModal(false);
      setConnectingAccount(null);
      toast({
        title: `Connected to ${connectingAccount.name}`,
        description: `Successfully simulated connection for ${connectingAccount.name}.`,
      });
    }, 1000);
  };


  const filteredAccounts = accounts.filter(account =>
    account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (account.platform && account.platform.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold tracking-tight">Manage Your Accounts</CardTitle>
          <CardDescription>
            Connect or disconnect your social media accounts.
            Provide (simulated) credentials when connecting for the first time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search accounts (e.g., Facebook, Instagram...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full max-w-md text-base"
              suppressHydrationWarning={true}
            />
          </div>
          {filteredAccounts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAccounts.map(account => (
                <AccountCard key={account.id} account={account} onConnectToggle={handleConnectToggle} />
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8 text-lg">No accounts match your search.</p>
          )}
        </CardContent>
      </Card>

      <WhatsAppConnectModal
        isOpen={showWhatsAppModal}
        onClose={() => { setShowWhatsAppModal(false); setWhatsAppConnecting(false); }}
        onConnectionSuccess={handleWhatsAppConnectionSuccess}
        isConnecting={whatsAppConnecting}
        setIsConnecting={setWhatsAppConnecting}
      />

      {connectingAccount && (
        <SocialConnectModal
          isOpen={showSocialConnectModal}
          onClose={() => { setShowSocialConnectModal(false); setConnectingAccount(null); setIsSubmittingSocialConnect(false); }}
          platformName={connectingAccount.name}
          onSubmit={handleSocialConnectSubmit}
          isConnecting={isSubmittingSocialConnect}
        />
      )}
    </div>
  );
}
