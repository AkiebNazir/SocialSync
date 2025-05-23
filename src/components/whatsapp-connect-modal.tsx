
"use client";

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface WhatsAppConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionSuccess: () => void;
  isConnecting: boolean;
  setIsConnecting: (isConnecting: boolean) => void;
}

export function WhatsAppConnectModal({
  isOpen,
  onClose,
  onConnectionSuccess,
  isConnecting,
  setIsConnecting
}: WhatsAppConnectModalProps) {

  const handleConfirmScan = () => {
    onConnectionSuccess();
  };

  if (!isOpen) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Connect to WhatsApp</AlertDialogTitle>
          <AlertDialogDescription>
            To connect your WhatsApp account, you need to run the separate Node.js WhatsApp server you prepared.
          </AlertDialogDescription>
          <ol className="list-decimal list-inside space-y-1 text-sm mt-3">
            <li>Ensure you have Node.js installed.</li>
            <li>Save the server code (provided to you) as a `.js` file (e.g., `whatsapp-server.js`) in a new directory.</li>
            <li>Open a terminal in that directory.</li>
            <li>Install dependencies: `npm install express whatsapp-web.js qrcode-terminal cors helmet morgan express-rate-limit winston express-validator`</li>
            <li>Run the server: `node whatsapp-server.js`</li>
            <li>A QR code will appear in that server's terminal.</li>
            <li>Open WhatsApp on your phone, go to Settings &gt; Linked Devices &gt; Link a Device, and scan the QR code shown in your server's terminal.</li>
          </ol>
          <div className="font-semibold mt-3">
            Once you have successfully scanned the QR code and your server terminal indicates "WhatsApp client is ready!", click "I've Scanned & Connected" below.
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <Button onClick={handleConfirmScan}>
            {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            I've Scanned & Connected
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

