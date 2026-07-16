import Image from "next/image";
import { defaultSystemSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  maxWidth?: number;
  priority?: boolean;
  variant?: "full" | "mark";
};

export function BrandLogo({
  className,
  maxWidth,
  priority = false,
  variant = "full"
}: BrandLogoProps) {
  if (variant === "mark") {
    const markSize = maxWidth ?? 40;

    return (
      <Image
        src="/brand/health-aid-arugambay-mark.png"
        alt={defaultSystemSettings.clinic.clinicName}
        width={360}
        height={360}
        priority={priority}
        unoptimized
        style={{
          display: "block",
          height: markSize,
          maxHeight: markSize,
          maxWidth: markSize,
          objectFit: "contain",
          width: markSize
        }}
        className={cn("h-auto w-full object-contain", className)}
      />
    );
  }

  const fullLogoMaxWidth = maxWidth ?? 360;

  return (
    <Image
      src="/brand/health-aid-arugambay-logo.png"
      alt={defaultSystemSettings.clinic.clinicName}
      width={900}
      height={255}
      priority={priority}
      unoptimized
      style={{
        display: "block",
        height: "auto",
        maxWidth: fullLogoMaxWidth,
        objectFit: "contain",
        width: "100%"
      }}
      className={cn("h-auto w-full object-contain", className)}
    />
  );
}
