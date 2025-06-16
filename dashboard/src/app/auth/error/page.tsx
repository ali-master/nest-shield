"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertTriangle,
  ArrowLeft,
  Key,
  RefreshCw,
  Server,
  Shield,
  UserX,
  XCircle,
} from "lucide-react";

type ErrorInfo = {
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  suggestion: string;
  actionText: string;
  actionHref: string;
};

const errorMap: Record<string, ErrorInfo> = {
  Configuration: {
    title: "Configuration Error",
    description: "There is a problem with the server configuration.",
    icon: Server,
    color: "text-red-500",
    suggestion:
      "This is usually a temporary issue. Please try again in a few minutes or contact support if the problem persists.",
    actionText: "Try Again",
    actionHref: "/auth/signin",
  },
  AccessDenied: {
    title: "Access Denied",
    description: "You do not have permission to sign in.",
    icon: UserX,
    color: "text-red-500",
    suggestion:
      "Your account may be suspended or banned. Please contact your administrator for assistance.",
    actionText: "Contact Support",
    actionHref: "/contact",
  },
  Verification: {
    title: "Verification Error",
    description: "The verification link has expired or is invalid.",
    icon: Key,
    color: "text-yellow-500",
    suggestion: "Please request a new verification email or try signing in again.",
    actionText: "Request New Link",
    actionHref: "/auth/signin",
  },
  Default: {
    title: "Authentication Error",
    description: "An error occurred during the authentication process.",
    icon: XCircle,
    color: "text-red-500",
    suggestion: "Please try signing in again. If the problem continues, please contact support.",
    actionText: "Try Again",
    actionHref: "/auth/signin",
  },
};

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const [errorInfo, setErrorInfo] = useState<ErrorInfo>(errorMap.Default);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error && errorMap[error]) {
      setErrorInfo(errorMap[error]);
    }
  }, [searchParams]);

  const ErrorIcon = errorInfo.icon;

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
        <div className="flex flex-col space-y-2 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-600">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Authentication Error</h1>
          <p className="text-sm text-muted-foreground">We encountered an issue during sign in</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div
              className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900`}
            >
              <ErrorIcon className={`h-6 w-6 ${errorInfo.color}`} />
            </div>
            <CardTitle className="text-lg">{errorInfo.title}</CardTitle>
            <CardDescription>{errorInfo.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">{errorInfo.suggestion}</AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Button asChild className="w-full">
                <Link href={errorInfo.actionHref}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {errorInfo.actionText}
                </Link>
              </Button>

              <Button variant="outline" asChild className="w-full">
                <Link href="/auth/signin">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Sign In
                </Link>
              </Button>
            </div>

            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                Error Code: {searchParams.get("error") || "UNKNOWN"}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Need help?{" "}
            <Link href="/contact" className="underline underline-offset-4 hover:text-primary">
              Contact Support
            </Link>
          </p>
          <p className="text-xs text-muted-foreground">Or try a different sign in method</p>
        </div>
      </div>
    </div>
  );
}
