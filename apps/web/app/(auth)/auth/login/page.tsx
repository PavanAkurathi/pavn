import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
    return (
        <>
            <div className="text-center">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                    Welcome back
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                    Don't have an account?{" "}
                    <Link
                        href="/auth/signup"
                        className="font-medium text-red-600 hover:text-red-500 transition-colors"
                    >
                        Start free trial
                    </Link>
                </p>
            </div>
            <LoginForm />
        </>
    );
}
