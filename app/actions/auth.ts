"use server";

import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// Only fires on a real form submission (a POST), never on the GET request
// that loads the confirmation page — so an email client's automated link
// scanner (Gmail, Outlook Safe Links, etc.) visiting the link can't burn
// the single-use token before the person actually clicks "Confirm."
export async function confirmEmailSignup(formData: FormData) {
  const tokenHash = formData.get("token_hash");
  const type = formData.get("type") as EmailOtpType | null;
  const next = (formData.get("next") as string | null) || "/";

  if (typeof tokenHash === "string" && tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      redirect(next);
    }
  }

  redirect("/login?error=That confirmation link is invalid or expired.");
}
