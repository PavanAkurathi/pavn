import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
    return (
        <>
            <div className="text-center">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    Welcome back
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    Don't have an account?{" "}
                    <Link
                        href="/auth/signup"
                        className="font-medium text-primary transition-colors hover:text-primary/80"
                    >
                        Start free trial
                    </Link>
                </p>
            </div>
            <LoginForm />
        </>
    );
}
