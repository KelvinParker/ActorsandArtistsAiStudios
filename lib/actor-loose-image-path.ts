/**
 * Maps loose filenames under an actor folder into paths {@link classifyActorImportImages} expects.
 *
 * Supported (case-insensitive; jpeg/png/webp/gif):
 * - `ActorSlug_headshot.png`, `headshot.jpg` at actor root
 * - `Marcus King Headshot.jpg`, `Marcus_King_Headshot.png` (space or underscore before Headshot)
 * - `Marcus King headshot-02.jpg`, `… headshot_03.png`, `… headshot 04.webp` (slots 1–5)
 * - `Marcus King turnaround.png`, `_turnaround.jpg`, `turnaround.png` at root
 */
export function normalizeLooseActorImageRelWithinActor(relWithinActor: string, base: string): string {
  const lower = base.toLowerCase();
  const dot = base.lastIndexOf(".");
  const ext = dot >= 0 ? base.slice(dot) : ".jpg";
  const imgExt = String.raw`(?:jpe?g|png|webp|gif)$`;

  const headNum = new RegExp(
    String.raw`(?:\s|_)+headshots?[-_\s]?0?(\d+)\.${imgExt}`,
    "i",
  ).exec(lower);
  if (headNum) {
    const n = Number.parseInt(headNum[1]!, 10);
    if (n >= 1 && n <= 5) {
      return `headshots/headshot-${String(n).padStart(2, "0")}${ext}`;
    }
  }

  if (
    new RegExp(String.raw`(?:\s|_)+headshots?\.${imgExt}`, "i").test(lower) ||
    /_headshots?\.(jpe?g|png|webp|gif)$/i.test(lower) ||
    /^headshots?\.(jpe?g|png|webp|gif)$/i.test(lower)
  ) {
    return `headshots/headshot-01${ext}`;
  }

  if (
    new RegExp(String.raw`(?:\s|_)+turnarounds?\.${imgExt}`, "i").test(lower) ||
    /_turnarounds?\.(jpe?g|png|webp|gif)$/i.test(lower) ||
    /^turnarounds?\.(jpe?g|png|webp|gif)$/i.test(lower)
  ) {
    return `turnaround/turnaround${ext}`;
  }

  return relWithinActor;
}
