
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, LogIn } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation"; // Changed from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate login
    console.log("Login attempt with:", { email, password });
    // In a real app, you'd authenticate here
    router.push("/dashboard");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-primary via-accent to-secondary p-4 bg-[length:200%_200%] animate-animated-gradient">
      <Card className="w-full max-w-md shadow-2xl bg-card/90 backdrop-blur-md border-border/60 animate-fade-in-up">
        <CardHeader className="text-center">
          <div className="mx-auto mb-6 flex items-center justify-center w-20 h-20 rounded-full bg-primary text-primary-foreground shadow-lg animate-subtle-float">
            <Zap size={40} />
          </div>
          <CardTitle className="text-4xl font-bold text-primary">SocialSync</CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-1">
            Login to access your social hub
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="text-base"
              />
            </div>
            <Button type="submit" className="w-full text-lg py-6 transform transition-transform duration-150 ease-out active:scale-95 hover:shadow-lg">
              <LogIn className="mr-2.5" /> Login
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2 pt-4">
           <Link href="#" passHref>
             <Button variant="link" className="text-sm text-muted-foreground hover:text-primary">
                Forgot Password?
             </Button>
           </Link>
          <p className="text-xs text-muted-foreground">
            Don't have an account?{' '}
            <Link href="#" passHref>
              <span className="font-semibold text-primary hover:underline cursor-pointer">Sign Up</span>
            </Link>
          </p>
        </CardFooter>
      </Card>
       <footer className="mt-8 text-center text-background/80 text-sm">
        <p>&copy; {new Date().getFullYear()} SocialSync. All rights reserved.</p>
      </footer>
    </div>
  );
}
