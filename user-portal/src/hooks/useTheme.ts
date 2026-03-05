import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = localStorage.getItem("itportal_theme");
    const initial = saved === "dark" ? "dark" : "light";
    setTheme(initial);
    document.body.dataset.theme = initial;
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("itportal_theme", next);
    document.body.dataset.theme = next;
  };

  return { theme, toggleTheme };
}
