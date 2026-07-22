export function hasFirebaseEnv() {
  const apiKey = import.meta.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = import.meta.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = import.meta.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = import.meta.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  if (!apiKey || !authDomain || !projectId || !appId) return false;

  // Guard against `.env.local.example` placeholders accidentally copied over.
  const values = [apiKey, authDomain, projectId, appId];
  if (values.some((v) => v.includes("YOUR_"))) return false;

  return true;
}
