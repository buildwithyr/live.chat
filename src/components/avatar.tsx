import { cn, initials } from "@/lib/utils";

export function Avatar({
  name,
  url,
  size = 40,
  isGroup = false,
  className,
}: {
  name: string;
  url?: string | null;
  size?: number;
  isGroup?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-200 font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : isGroup ? (
        <span style={{ fontSize: size * 0.5 }}>#</span>
      ) : (
        initials(name)
      )}
    </span>
  );
}
