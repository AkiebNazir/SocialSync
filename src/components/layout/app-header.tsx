"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Bell, UserCircle, Zap } from "lucide-react";
import Link from "next/link";
import { AppSidebar } from "./app-sidebar"; 
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const { toggleSidebar, isMobile, openMobile, setOpenMobile } = useSidebar();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
      {isMobile ? (
         <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpenMobile(true)}
          >
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="hidden md:flex"
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle Sidebar</span>
        </Button>
      )}
      
      <div className="flex w-full items-center justify-end gap-4 md:ml-auto md:gap-2 lg:gap-4">
        {/* Placeholder for search bar if needed in future */}
        {/* <form className="ml-auto flex-1 sm:flex-initial">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px]"
            />
          </div>
        </form> */}
        <Button variant="ghost" size="icon" className="rounded-full">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Toggle notifications</span>
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full">
          <UserCircle className="h-6 w-6" />
          <span className="sr-only">User menu</span>
        </Button>
      </div>
    </header>
  );
}
