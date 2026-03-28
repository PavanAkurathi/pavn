import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
    return (
        <>
            <div className="text-center">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    Create an account
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <Link
                        href="/auth/login"
                        className="font-medium text-primary transition-colors hover:text-primary/80"
                    >
                        Sign in
                    </Link>
                </p>
            </div>
            <SignupForm />
        </>
    );
}
