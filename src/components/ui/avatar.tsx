import { cn } from "./cn";
import { initials } from "@/lib/format";

const SIZES = { sm: "size-8 text-xs", md: "size-11 text-sm", lg: "size-16 text-lg", xl: "size-28 text-3xl" } as const;

function hue(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function Avatar({
  person,
  size = "md",
  className,
}: {
  person: { firstName: string; lastName: string; avatarImageId?: string | null };
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const base = cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-eiche", SIZES[size], className);
  if (person.avatarImageId) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/bilder/${person.avatarImageId}`} alt="" className={cn(base, "object-cover")} loading="lazy" />;
  }
  const h = hue(person.firstName + person.lastName);
  return (
    <span
      aria-hidden
      className={cn(base, "font-display font-bold")}
      style={{ background: `hsl(${h} 32% 30%)`, color: `hsl(${h} 60% 88%)` }}
    >
      {initials(person)}
    </span>
  );
}
