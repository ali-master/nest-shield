"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  Bell,
  BookOpen,
  CheckCircle,
  Key,
  Settings,
  Shield,
  Smartphone,
} from "lucide-react";

export default function WelcomePage() {
  const router = useRouter();
  const [_completedSteps, _setCompletedSteps] = useState<string[]>([]);

  // Mock session for demo
  const session = {
    user: {
      name: "Demo User",
      email: "demo@example.com",
    },
  };

  const welcomeSteps = [
    {
      id: "profile",
      title: "Complete your profile",
      description: "Add additional information to your account",
      icon: Settings,
      completed: Boolean(session?.user?.name),
      action: () => router.push("/settings/profile"),
    },
    {
      id: "2fa",
      title: "Enable Two-Factor Authentication",
      description: "Secure your account with an extra layer of protection",
      icon: Smartphone,
      completed: false, // You'll need to check if 2FA is enabled
      action: () => router.push("/settings/security"),
    },
    {
      id: "passkey",
      title: "Add a Passkey",
      description: "Sign in quickly and securely with biometric authentication",
      icon: Key,
      completed: false, // You'll need to check if passkeys are configured
      action: () => router.push("/settings/security"),
    },
    {
      id: "notifications",
      title: "Configure Notifications",
      description: "Choose how you want to be notified about important events",
      icon: Bell,
      completed: false,
      action: () => router.push("/settings/notifications"),
    },
    {
      id: "dashboard",
      title: "Explore the Dashboard",
      description: "Learn about monitoring and protection features",
      icon: BookOpen,
      completed: false,
      action: () => router.push("/dashboard"),
    },
  ];

  const handleStepClick = (step: (typeof welcomeSteps)[0]) => {
    if (step.action) {
      step.action();
    }
  };

  const handleGetStarted = () => {
    router.push("/en/onboarding");
  };

  const handleContinueToDashboard = () => {
    router.push("/dashboard");
  };

  const completionPercentage = Math.round(
    (welcomeSteps.filter((step) => step.completed).length / welcomeSteps.length) * 100,
  );

  return (
    <div className="container flex min-h-screen w-screen flex-col items-center justify-center py-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col justify-center space-y-6">
        {/* Welcome Header */}
        <div className="flex flex-col space-y-4 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-green-500 to-blue-500">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Welcome to NestShield! 🎉</h1>
            <p className="text-lg text-muted-foreground">
              Hi {session.user?.name || session.user?.email}! Let's get your account set up.
            </p>
          </div>

          <div className="flex items-center justify-center space-x-4">
            <Badge variant="secondary" className="text-sm">
              Account Created
            </Badge>
            <Badge variant="outline" className="text-sm">
              {completionPercentage}% Complete
            </Badge>
          </div>
        </div>

        {/* Setup Steps */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Setup Checklist
            </CardTitle>
            <CardDescription>
              Complete these steps to get the most out of NestShield Dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {welcomeSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.id}>
                  <div
                    className="flex items-center justify-between p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleStepClick(step)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleStepClick(step);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-center space-x-4">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${
                          step.completed ? "bg-green-100 dark:bg-green-900" : "bg-muted"
                        }`}
                      >
                        {step.completed ? (
                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <Icon className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-medium">{step.title}</h3>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {step.completed ? (
                        <Badge variant="secondary">Completed</Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>

                  {index < welcomeSteps.length - 1 && <Separator className="my-2" />}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push("/dashboard")}
          >
            <CardContent className="p-6 text-center">
              <BookOpen className="h-8 w-8 mx-auto mb-3 text-blue-500" />
              <h3 className="font-medium mb-2">Explore Dashboard</h3>
              <p className="text-sm text-muted-foreground">Start monitoring your API protection</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push("/settings")}
          >
            <CardContent className="p-6 text-center">
              <Settings className="h-8 w-8 mx-auto mb-3 text-purple-500" />
              <h3 className="font-medium mb-2">Account Settings</h3>
              <p className="text-sm text-muted-foreground">Customize your security preferences</p>
            </CardContent>
          </Card>
        </div>

        {/* Continue Buttons */}
        <div className="flex flex-col space-y-4 items-center">
          <div className="flex gap-4 w-full max-w-md">
            <Button onClick={handleGetStarted} size="lg" className="flex-1">
              Start Onboarding Tour
              <BookOpen className="ml-2 h-4 w-4" />
            </Button>
            <Button
              onClick={handleContinueToDashboard}
              variant="outline"
              size="lg"
              className="flex-1"
            >
              Skip to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground max-w-md">
            Take the guided tour to learn about NestShield's powerful features, or jump straight to
            the dashboard. You can access all setup options later from your account settings.
          </p>
        </div>
      </div>
    </div>
  );
}
