
"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from 'lucide-react';

interface SocialConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  platformName: string;
  onSubmit: (credentials: { username: string; password?: string }) => void; // Password optional for some platforms
  isConnecting: boolean;
}

export function SocialConnectModal({
  isOpen,
  onClose,
  platformName,
  onSubmit,
  isConnecting,
}: SocialConnectModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    onSubmit({ username, password });
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Connect to {platformName}</DialogTitle>
          <DialogDescription>
            Enter your credentials for {platformName}. This is a simulation, and your data will not be sent to any real service.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="username" className="text-right">
              Username/Email
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="col-span-3"
              placeholder={`Your ${platformName} username or email`}
            />
          </div>
          {/* Some platforms might not need a password for this step in a real OAuth flow,
              but for simulation, we include it. Could be conditionally rendered. */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="password" className="text-right">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="col-span-3"
              placeholder="Your password (simulated)"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSubmit} disabled={isConnecting || !username}>
            {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
