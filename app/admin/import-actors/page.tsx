import {
  getActorImportSyncBucket,
  getActorImportSyncDefaultPack,
  getActorImportSyncPrefix,
} from "@/lib/actor-import-storage-sync-config";
import { ImportLibraryForm } from "./import-library-form";
import { StorageSyncPanel } from "./storage-sync-panel";

export const metadata = {
  title: "Import and storage sync — Admin",
};

export default function ImportActorsPage() {
  const bucket = getActorImportSyncBucket();
  const prefix = getActorImportSyncPrefix();
  const defaultPack = getActorImportSyncDefaultPack();

  return (
    <div className="space-y-12">
      <div>
        <h1
          className="mb-2 text-2xl font-bold tracking-tight text-metallic-orange md:text-3xl"
          style={{
            fontFamily:
              "var(--font-display), ui-sans-serif, system-ui, sans-serif",
          }}
        >
          Import and storage sync
        </h1>
        <p className="mb-8 max-w-2xl text-sm text-white/55">
          Upload a zip or a local folder from your machine, or sync from Supabase Storage below.
          Numbered text / RTF maps to columns; rows merge by name and pack.
        </p>
        <ImportLibraryForm />
      </div>

      <StorageSyncPanel
        configured={Boolean(bucket)}
        bucketLabel={bucket ?? ""}
        prefix={prefix}
        defaultPack={defaultPack ?? ""}
      />
    </div>
  );
}
