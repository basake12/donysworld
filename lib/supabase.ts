import { createClient } from "@supabase/supabase-js";

// Public client — used in browser (profile pictures)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Admin client — used in server/api routes only (legal documents)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Bucket names
export const BUCKETS = {
  PROFILE_PICTURES: "profile-pictures",  // public bucket
  LEGAL_DOCUMENTS: "legal-documents",    // private bucket — admin only
} as const;

// Get a public URL for profile pictures
export function getProfilePictureUrl(path: string): string {
  const { data } = supabase.storage
    .from(BUCKETS.PROFILE_PICTURES)
    .getPublicUrl(path);
  return data.publicUrl;
}

// Get a signed URL for legal documents (admin only, expires in 60 mins)
export async function getDocumentSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKETS.LEGAL_DOCUMENTS)
    .createSignedUrl(path, 3600);

  if (error || !data) {
    throw new Error(error?.message ?? "Could not generate document URL");
  }
  return data.signedUrl;
}