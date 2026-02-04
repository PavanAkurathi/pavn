"use client";

import { useState } from "react";
import { Bell, Check, Clock } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { cn } from "@repo/ui/lib/utils";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";

// Mock Data
// Mock Data removed
const MOCK_NOTIFICATIONS: any[] = [];

export function NotificationsPopover() {
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<typeof MOCK_NOTIFICATIONS>([]);

    const unreadCount = notifications.filter((n) => !n.read).length;

    const markAllAsRead = () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    };

    const markAsRead = (id: string) => {
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-muted-foreground">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-600 border border-white" />
                    )}
                    <span className="sr-only">Notifications</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                    <h4 className="font-semibold text-sm">Notifications</h4>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto px-2 text-xs text-muted-foreground hover:text-primary"
                            onClick={markAllAsRead}
                        >
                            Mark all as read
                        </Button>
                    )}
                </div>
                <ScrollArea className="h-[300px]">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                            <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
                            <p className="text-sm text-muted-foreground">No notifications</p>
                        </div>
                    ) : (
                        <div className="grid">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={cn(
                                        "flex gap-3 px-4 py-3 border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer text-left",
                                        !notification.read && "bg-muted/20"
                                    )}
                                    onClick={() => markAsRead(notification.id)}
                                >
                                    <div className={cn(
                                        "mt-1 h-2 w-2 shrink-0 rounded-full",
                                        !notification.read ? "bg-blue-600" : "bg-transparent"
                                    )} />
                                    <div className="space-y-1">
                                        <p className={cn("text-sm font-medium leading-none", !notification.read && "text-foreground")}>
                                            {notification.title}
                                        </p>
                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                            {notification.message}
                                        </p>
                                        <div className="flex items-center pt-1 text-xs text-muted-foreground">
                                            <Clock className="mr-1 h-3 w-3" />
                                            {notification.time}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
                <div className="p-2 border-t bg-muted/20 text-center">
                    <Button variant="link" size="sm" className="h-auto text-xs w-full" asChild>
                        <a href="/settings?tab=notifications">View Settings</a>
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
