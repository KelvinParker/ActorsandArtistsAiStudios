import { AddActorForm } from "./add-actor-form";

export const metadata = {
  title: "Add actor — Admin",
};

export default function AddActorPage() {
  return (
    <div>
      <h1
        className="mb-2 text-2xl font-bold tracking-tight text-metallic-orange md:text-3xl"
        style={{
          fontFamily:
            "var(--font-display), ui-sans-serif, system-ui, sans-serif",
        }}
      >
        Add actor
      </h1>
      <p className="mb-8 text-sm text-white/50">
        Create a new character row in Supabase. First image URL is the cover;
        up to three more go in <code className="text-white/70">headshot_urls</code>
        .
      </p>
      <AddActorForm />
    </div>
  );
}
