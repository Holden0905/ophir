export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="font-editorial text-5xl tracking-tight text-[var(--accent-amber)]">
            Ophir
          </div>
          <div className="mt-2 font-ui text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
            The source of Solomon&apos;s gold
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
