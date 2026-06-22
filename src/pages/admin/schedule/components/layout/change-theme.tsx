import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/pages/admin/schedule/components/ui/button";
import { Skeleton } from "@/pages/admin/schedule/components/ui/skeleton";

import { setTheme } from "@/pages/admin/schedule/cookies/set";

export function ToggleTheme() {
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark">();

  useEffect(() => {
    const currentTheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setCurrentTheme(currentTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = currentTheme === "light" ? "dark" : "light";
    setTheme(newTheme);
    setCurrentTheme(newTheme);
  };

  if (!currentTheme) return <Skeleton className="size-9" />;

  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme}>
      {currentTheme === "light" && <Sun />}
      {currentTheme === "dark" && <Moon />}
    </Button>
  );
}
