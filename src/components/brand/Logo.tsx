import Image from "next/image";

export function Logo({ size = 44, showWordmark = true }: { size?: number; showWordmark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Image src="/logo.png" alt={showWordmark ? "" : "ZUPA"} width={size} height={size} priority className="object-contain" />
      {showWordmark && <span className="text-2xl font-extrabold tracking-tight text-charcoal">ZUPA</span>}
    </span>
  );
}
