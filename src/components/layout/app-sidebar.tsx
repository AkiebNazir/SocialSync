"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Settings, Users, Zap } from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Image from "next/image";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/accounts", label: "Accounts", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { open, setOpen, isMobile, openMobile, setOpenMobile } = useSidebar();

  const commonItemClasses = "w-full justify-start transition-all duration-200 ease-out";

  return (
    <Sidebar 
        collapsible={isMobile ? "offcanvas" : "icon"}
        variant="sidebar"
        className="border-r shadow-md"
    >
      <SidebarHeader className="p-4 flex items-center gap-3">
         <div className={cn(
            "p-2 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground transition-transform duration-300",
            (open || openMobile) ? "scale-100" : "scale-110 -translate-x-0.5" // Icon slightly larger when collapsed
         )}>
            <Zap size={ (open || openMobile) ? 28 : 24 } />
         </div>
        <h1 className={cn(
            "text-2xl font-semibold text-sidebar-foreground whitespace-nowrap transition-opacity duration-200",
            (open || openMobile) ? "opacity-100 delay-100" : "opacity-0 pointer-events-none md:opacity-0"
            )}>
            SocialSync
        </h1>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.label}>
              <Link href={item.href} passHref legacyBehavior>
                <SidebarMenuButton
                  className={cn(
                    commonItemClasses,
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    pathname === item.href 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold" 
                      : ""
                  )}
                  isActive={pathname === item.href}
                  tooltip={{ 
                    children: item.label, 
                    side:"right", 
                    className: "bg-card text-card-foreground border shadow-sm"
                  }}
                  onClick={() => isMobile && setOpenMobile(false)}
                >
                  <item.icon size={20} />
                  <span className={cn(
                    "transition-opacity duration-200",
                    (open || openMobile) ? "opacity-100 delay-100" : "opacity-0 md:opacity-0 pointer-events-none"
                  )}>{item.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-4 mt-auto border-t border-sidebar-border">
        <div className={cn(
             "flex items-center gap-3 p-2 rounded-lg bg-sidebar-accent/30 transition-all duration-200",
             (open || openMobile) ? "opacity-100 delay-100" : "opacity-0 md:opacity-0 pointer-events-none"
             )}>
          <Image 
            src="https://placehold.co/40x40.png?text=U" 
            alt="User Avatar"
            width={40}
            height={40}
            className="rounded-full border-2 border-sidebar-primary"
            data-ai-hint="user avatar" 
          />
          <div className="truncate">
            <p className="font-semibold text-sm text-sidebar-foreground">Current User</p>
            <p className="text-xs text-sidebar-foreground/70 truncate">user@example.com</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
