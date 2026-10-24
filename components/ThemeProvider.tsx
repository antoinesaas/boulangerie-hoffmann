"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"
import { Button } from "@/components/ui/button"

export function ThemeProvider(props: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props} />
}

const sAbonner = () => () => {}

/** Bouton jour / nuit (mode sombre pour le travail de nuit au fornil). */
export function BoutonTheme({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const monte = useSyncExternalStore(sAbonner, () => true, () => false)
  const sombre = monte && resolvedTheme === "dark"

  return (
    <Button
      variant="outline"
      size="icon-lg"
      className={className}
      onClick={() => setTheme(sombre ? "light" : "dark")}
      aria-label={sombre ? "Passer en mode jour" : "Passer en mode nuit"}
      title={sombre ? "Mode jour" : "Mode nuit"}
    >
      {sombre ? <SunIcon /> : <MoonIcon />}
    </Button>
  )
}
