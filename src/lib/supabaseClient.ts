// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";
import { STOREFRONT_CONFIG } from "../config/storefront";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: STOREFRONT_CONFIG.supabaseAuthStorageKey,
    // flowType: "pkce", // opcional (útil si usás OAuth)
  },
});
