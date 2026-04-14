import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getIsAdmin } from "@/lib/auth/is-admin";
import { AdminNav } from "./AdminNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/admin-access?reason=sign-in");
  }
  if (!(await getIsAdmin())) {
    redirect("/admin-access");
  }

  return (
    <div className="min-h-full bg-cinematic-black text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <AdminNav />
        {children}
      </div>
    </div>
  );
}
