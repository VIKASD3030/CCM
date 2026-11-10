import env from "react-dotenv";

// How sign-in works:
//  'azure'  (default) Microsoft sign-in only. The CCM public API needs no CCM
//           session token (the proxy adds the API token), so the app keeps the
//           user's identity from Microsoft and never calls the old backend.
//  'legacy' the old FastAPI flow: OTP login and exchanging the Microsoft token
//           at /api/auth/azure/login.
const authMode = import.meta.env.VITE_AUTH_MODE === 'legacy' ? 'legacy' : 'azure';

const config = {
    apiUrl: import.meta.env.VITE_API_URL || '',
    target: "node",
    authMode,
    // Local testing only: shows "Continue as <email>" on the login page when set.
    // Ignored in production builds.
    devLoginEmail: import.meta.env.DEV ? (import.meta.env.VITE_DEV_LOGIN_EMAIL || '').trim() : '',
}
export default config
