"use client";

import type { Account } from '@/types';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle, LinkIcon, Zap, XCircle } from 'lucide-react';
import { socialPlatformsConfig } from '@/lib/mock-data';

interface AccountCardProps {
  account: Account;
  onConnectToggle: (accountId: string) => void;
}

export function AccountCard({ account, onConnectToggle }: AccountCardProps) {
  const platformConfig = socialPlatformsConfig[account.platform];
  const IconComponent = account.icon;

  return (
    <Card className="shadow-card hover:shadow-card-hover transform transition-all duration-300 ease-out hover:scale-[1.03] overflow-hidden group">
      <CardHeader className={cn(
        "p-4 flex flex-row items-center gap-3 space-y-0 transition-colors duration-300",
        platformConfig?.color,
        account.connected ? "bg-opacity-25" : "bg-opacity-15 group-hover:bg-opacity-20"
      )}>
        <div className={cn(
          "p-2.5 rounded-lg text-white transition-transform duration-300 group-hover:scale-110",
          platformConfig?.color || "bg-muted-foreground"
        )}>
          {IconComponent && <IconComponent size={24} />}
        </div>
        <div>
          <CardTitle className="text-lg font-semibold">{account.name}</CardTitle>
          {account.username && <CardDescription className="text-xs text-muted-foreground">{account.username}</CardDescription>}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {account.connected ? (
          <div className="flex items-center text-green-600">
            <CheckCircle className="mr-2 h-5 w-5" />
            <p className="text-sm font-medium">Connected</p>
          </div>
        ) : (
          <div className="flex items-center text-amber-600">
            <LinkIcon className="mr-2 h-5 w-5" />
            <p className="text-sm font-medium">Not Connected</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="p-4 bg-muted/20 border-t">
        <Button
          onClick={() => onConnectToggle(account.id)}
          variant={account.connected ? "destructive" : "default"}
          className="w-full transform transition-transform duration-150 ease-out active:scale-95"
        >
          {account.connected ? <XCircle className="mr-2 h-4 w-4" /> : <Zap className="mr-2 h-4 w-4" />}
          {account.connected ? "Disconnect" : "Connect"}
        </Button>
      </CardFooter>
    </Card>
  );
}
