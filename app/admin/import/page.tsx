import { redirect } from "next/navigation";

/** Shorter URL: /admin/import → import-actors */
export default function AdminImportAliasPage() {
  redirect("/admin/import-actors");
}
