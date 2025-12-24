import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
    return (
        <>
            <div className="text-center">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                    Create an account
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                    Already have an account?{" "}
                    <Link
                        href="/auth/login"
                        className="font-medium text-red-600 hover:text-red-500 transition-colors"
                    >
                        Sign in
                    </Link>
                </p>
            </div>
            <SignupForm />
        </>
    );
}
