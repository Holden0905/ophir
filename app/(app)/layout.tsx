import { requireUser } from "@/lib/auth/dal";
import { Nav } from "@/components/shared/Nav";
import { InstallPrompt } from "@/components/shared/InstallPrompt";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <div className="min-h-screen">
      <Nav email={user.email ?? null} />
      <main className="mx-auto max-w-7xl px-5 py-8 pb-24 md:pb-8">{children}</main>
      <InstallPrompt />
    </div>
  );
}
