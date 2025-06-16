"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CheckCircle, Clock, Mail, Shield } from "lucide-react";

export default function VerifyRequestPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
        <div className="flex flex-col space-y-2 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-600">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
          <p className="text-sm text-muted-foreground">We've sent you a verification link</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
              <Mail className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle>Email sent successfully</CardTitle>
            {email && (
              <CardDescription>
                We sent a verification link to <strong>{email}</strong>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Click the link in your email to sign in</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span>The link will expire in 10 minutes</span>
              </div>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Can't find the email?</h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Check your spam or junk folder</p>
                <p>• Make sure you entered the correct email address</p>
                <p>• Wait a few minutes for the email to arrive</p>
              </div>
            </div>

            <div className="space-y-3">
              <Button variant="outline" asChild className="w-full">
                <Link href="/auth/signin">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Sign In
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Having trouble?{" "}
            <Link href="/contact" className="underline underline-offset-4 hover:text-primary">
              Contact Support
            </Link>
          </p>
          <p className="text-xs text-muted-foreground">
            The verification link can only be used once
          </p>
        </div>
      </div>
    </div>
  );
}
