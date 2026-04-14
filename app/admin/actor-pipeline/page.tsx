import Link from "next/link";
import { ActorPipelineWizard } from "./actor-pipeline-wizard";

export const metadata = {
  title: "Actor pipeline — Admin",
};

export default function ActorPipelinePage() {
  return (
    <div>
      <h1
        className="mb-2 text-2xl font-bold tracking-tight text-metallic-orange md:text-3xl"
        style={{
          fontFamily: "var(--font-display), ui-sans-serif, system-ui, sans-serif",
        }}
      >
        Create → review → import
      </h1>
      <p className="mb-8 max-w-3xl text-sm text-white/55">
        Generate characters in Gemini, ChatGPT, or your image pipeline using the folder contract
        below. Zip the result, load it here to approve turnaround and headshots, then push to
        Supabase. For a one-step drop without per-image review, use{" "}
        <Link href="/admin/import-actors" className="text-metallic-orange underline-offset-2 hover:underline">
          Import zip / folder
        </Link>
        .
      </p>
      <ActorPipelineWizard />
    </div>
  );
}
