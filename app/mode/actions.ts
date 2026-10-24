"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { exigerRole } from "@/lib/auth"
import { COOKIE_BOUTIQUE } from "@/lib/roles"

const UN_AN = 60 * 60 * 24 * 400

export async function choisirMode(formData: FormData) {
  await exigerRole("appareil", "admin")
  const mode = String(formData.get("mode") ?? "")

  if (mode === "fornil") redirect("/fornil")

  const boutique = String(formData.get("boutique") ?? "")
  if (mode !== "vendeur" || !/^[0-9a-f-]{36}$/.test(boutique)) redirect("/mode")

  ;(await cookies()).set(COOKIE_BOUTIQUE, boutique, {
    maxAge: UN_AN,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  })
  redirect("/vendeur/commande")
}
