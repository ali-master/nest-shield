"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle,
  Cpu,
  Eye,
  Globe,
  Lock,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useTheme } from "next-themes";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

const OnboardingPage = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const router = useRouter();
  const t = useTranslations("onboarding");
  const { theme: _theme } = useTheme();

  const steps = [
    {
      id: "welcome",
      title: t("welcome.title"),
      subtitle: t("welcome.subtitle"),
      description: t("welcome.description"),
      icon: Shield,
      color: "from-blue-500 to-purple-600",
      features: [
        { icon: Lock, text: t("features.security") },
        { icon: Eye, text: t("features.monitoring") },
        { icon: Brain, text: t("features.analytics") },
        { icon: CheckCircle, text: t("features.compliance") },
      ],
    },
    {
      id: "configure",
      title: t("steps.configure.title"),
      subtitle: t("steps.configure.description"),
      description:
        "Set up comprehensive protection layers for your NestJS applications with intelligent defaults and customizable rules.",
      icon: Cpu,
      color: "from-green-500 to-teal-600",
      features: [
        { icon: Shield, text: "Rate Limiting" },
        { icon: Zap, text: "Circuit Breakers" },
        { icon: Activity, text: "Throttling" },
        { icon: Brain, text: "Anomaly Detection" },
      ],
    },
    {
      id: "monitor",
      title: t("steps.monitor.title"),
      subtitle: t("steps.monitor.description"),
      description:
        "Real-time visibility into your application performance with advanced alerting and intelligent insights.",
      icon: BarChart3,
      color: "from-orange-500 to-red-600",
      features: [
        { icon: TrendingUp, text: "Performance Metrics" },
        { icon: Activity, text: "Health Monitoring" },
        { icon: Users, text: "User Analytics" },
        { icon: Globe, text: "Global Insights" },
      ],
    },
    {
      id: "optimize",
      title: t("steps.optimize.title"),
      subtitle: t("steps.optimize.description"),
      description:
        "AI-powered optimization recommendations to enhance performance and reduce operational overhead.",
      icon: Sparkles,
      color: "from-purple-500 to-pink-600",
      features: [
        { icon: Brain, text: "AI Optimization" },
        { icon: Zap, text: "Auto Scaling" },
        { icon: TrendingUp, text: "Cost Reduction" },
        { icon: Activity, text: "Performance Tuning" },
      ],
    },
  ];

  const totalSteps = steps.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      router.push("/dashboard");
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    router.push("/dashboard");
  };

  const currentStepData = steps[currentStep];
  if (!currentStepData) return <div>Loading...</div>;
  const Icon = currentStepData.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-background/90 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Background Animation */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary/5 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 w-60 h-60 bg-accent/5 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      {/* Header Controls */}
      <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            {t("skipTour")}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="absolute top-20 left-6 right-6 z-10">
        <div className="flex items-center gap-4 mb-2">
          <span className="text-sm text-muted-foreground">
            {currentStep + 1} / {totalSteps}
          </span>
          <div className="flex-1">
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-6xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -300 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="grid lg:grid-cols-2 gap-12 items-center"
          >
            {/* Left Side - Content */}
            <div className="space-y-8 text-center lg:text-start">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-4"
              >
                <div
                  className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r ${currentStepData.color} text-white mb-6`}
                >
                  <Icon className="w-8 h-8" />
                </div>

                <h1 className="text-4xl lg:text-5xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                  {currentStepData.title}
                </h1>

                <p className="text-xl text-muted-foreground max-w-2xl">
                  {currentStepData.subtitle}
                </p>

                <p className="text-lg text-muted-foreground/80 max-w-xl leading-relaxed">
                  {currentStepData.description}
                </p>
              </motion.div>

              {/* Features Grid */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="grid grid-cols-2 gap-4 max-w-md mx-auto lg:mx-0"
              >
                {currentStepData.features.map((feature, index) => (
                  <motion.div
                    key={feature.text}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border/50 hover:bg-card/80 transition-colors"
                  >
                    <feature.icon className="w-5 h-5 text-primary" />
                    <span className="text-sm font-medium">{feature.text}</span>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Right Side - Visual */}
            <div className="relative">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="relative"
              >
                <Card className="p-8 bg-card/30 backdrop-blur-sm border-border/50">
                  <CardContent className="p-0">
                    <div className="space-y-6">
                      {/* Animated Dashboard Preview */}
                      <div className="aspect-video bg-gradient-to-br from-muted/20 to-muted/40 rounded-lg border border-border/30 p-4 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 animate-shimmer" />

                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-400 rounded-full" />
                            <div className="w-3 h-3 bg-yellow-400 rounded-full" />
                            <div className="w-3 h-3 bg-green-400 rounded-full" />
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            Live Demo
                          </Badge>
                        </div>

                        {/* Dashboard Content */}
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <div className="flex-1 h-8 bg-primary/20 rounded animate-pulse" />
                            <div className="w-16 h-8 bg-secondary/20 rounded animate-pulse delay-100" />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="h-16 bg-muted/40 rounded animate-pulse delay-200" />
                            <div className="h-16 bg-muted/40 rounded animate-pulse delay-300" />
                            <div className="h-16 bg-muted/40 rounded animate-pulse delay-400" />
                          </div>
                          <div className="h-20 bg-gradient-to-r from-primary/10 to-secondary/10 rounded animate-pulse delay-500" />
                        </div>
                      </div>

                      {/* Step Indicators */}
                      <div className="flex justify-center gap-3">
                        {steps.map((_, index) => (
                          <motion.div
                            key={index}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.8 + index * 0.1 }}
                            className={`w-3 h-3 rounded-full transition-all duration-300 ${
                              index === currentStep
                                ? "bg-primary scale-125"
                                : index < currentStep
                                  ? "bg-primary/60"
                                  : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="flex justify-between items-center mt-12 gap-4"
        >
          <Button
            variant="outline"
            size="lg"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("previous")}
          </Button>

          <Button
            size="lg"
            onClick={handleNext}
            className={`flex items-center gap-2 bg-gradient-to-r ${currentStepData.color} hover:opacity-90 transition-opacity`}
          >
            {currentStep === totalSteps - 1 ? t("finish") : t("next")}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>

      {/* Custom CSS for shimmer animation */}
      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%) skewX(-12deg);
          }
          100% {
            transform: translateX(200%) skewX(-12deg);
          }
        }
        .animate-shimmer {
          animation: shimmer 3s infinite;
        }
      `}</style>
    </div>
  );
};

export default OnboardingPage;
