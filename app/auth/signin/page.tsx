import { signIn } from "@/auth";

export const dynamic = "force-dynamic";

const domain = process.env.ALLOWED_DOMAIN ?? "freshworks.com";

const ACCESS_DENIED_MESSAGE =
  `This account isn't allowed to access SkillHub. ` +
  `Please sign in with your @${domain} Google account. ` +
  `If you're an approved guest, make sure you're using the correct email address.`;

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: ACCESS_DENIED_MESSAGE,
  OAuthCallbackError: ACCESS_DENIED_MESSAGE,
  OAuthSignin: "There was a problem starting the sign-in flow. Please try again.",
  Callback: ACCESS_DENIED_MESSAGE,
  Default: "Something went wrong during sign-in. Please try again.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;
  const errorMessage = error
    ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default)
    : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">SkillHub</h1>
        <p className="mb-6 text-sm text-gray-500">
          Sign in with your company Google account.
        </p>

        {errorMessage && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: callbackUrl ?? "/" });
          }}
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </form>

        <DomainNote />
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

async function DomainNote() {
  const domain = process.env.ALLOWED_DOMAIN;
  if (!domain) return null;
  return (
    <p className="mt-6 text-center text-xs text-gray-400">
      Access restricted to <span className="font-medium">@{domain}</span>{" "}
      accounts.
    </p>
  );
}
