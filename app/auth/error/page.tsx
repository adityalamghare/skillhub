const errorMessages: Record<string, string> = {
  AccessDenied: "Access to SkillHub is limited to Freshworks employees (@freshworks.com) and approved guests. If you believe you should have access, ask a Freshworks admin to add your email to the guest list.",
  Configuration: "There is a server configuration problem. Please contact your admin.",
  Default: "An unexpected error occurred during sign-in.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = errorMessages[error ?? ""] ?? errorMessages.Default;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-xl font-semibold text-gray-900">
          Sign-in failed
        </h1>
        <p className="mb-6 text-sm text-gray-600">{message}</p>
        <a
          href="/auth/signin"
          className="block w-full rounded-lg bg-gray-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-gray-700"
        >
          Try again
        </a>
      </div>
    </main>
  );
}
