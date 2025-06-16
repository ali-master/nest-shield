"use client";

import { Languages } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect } from "react";

export function LanguageToggle() {
  const t = useTranslations("language");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleLanguageChange = (newLocale: string) => {
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);

    // Update document direction immediately for better UX
    const newDirection = newLocale === "fa" ? "rtl" : "ltr";
    document.documentElement.dir = newDirection;
    document.documentElement.lang = newLocale;

    router.push(newPath);
  };

  // Ensure direction is set correctly on mount
  useEffect(() => {
    const direction = locale === "fa" ? "rtl" : "ltr";
    document.documentElement.dir = direction;
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <Languages className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Toggle language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleLanguageChange("en")}>
          {t("english")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleLanguageChange("fa")}>
          {t("persian")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
