// apps/web/components/nav-user.tsx

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, ChevronDown, User, Settings as SettingsIcon, Sparkles } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@repo/ui/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { authClient } from "@repo/auth/client";
import type { TrialState } from "@/lib/trial";

interface NavUserProps {
    user?: {
        name?: string | null;
        email?: string | null;
        image?: string | null;
    } | null;
    /** Shown in the menu where the top bar has no room for its own pill. */
    trial?: TrialState | null;
}

export function NavUser({ user, trial }: NavUserProps) {
    const router = useRouter();

    const handleSignOut = async () => {
        await authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.push("/auth/login");
                },
            },
        });
    };

    if (!user) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex h-auto items-center gap-2 rounded-full py-1.5 pl-1.5 pr-1.5 hover:bg-muted data-[state=open]:bg-muted lg:pr-2" data-testid="user-menu">
                    <Avatar className="h-8 w-8 border">
                        <AvatarImage src={user.image || undefined} />
                        <AvatarFallback className="bg-muted text-muted-foreground font-medium">
                            {user.name?.slice(0, 2).toUpperCase() || "ME"}
                        </AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-[120px] truncate text-sm font-medium text-foreground lg:block">
                        {user.name}
                    </span>
                    <ChevronDown className="hidden h-4 w-4 text-muted-foreground lg:block" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.name}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {trial ? (
                    <DropdownMenuItem asChild className="lg:hidden">
                        <Link href="/settings/billing">
                            <Sparkles className="mr-2 h-4 w-4" />
                            Trial · {trial.daysLeft} {trial.daysLeft === 1 ? "day" : "days"} left
                        </Link>
                    </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem asChild>
                    <Link href="/settings">
                        <User className="mr-2 h-4 w-4" />
                        Profile
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link href="/settings">
                        <SettingsIcon className="mr-2 h-4 w-4" />
                        Settings
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-primary-soft" onClick={handleSignOut} data-testid="sign-out">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
