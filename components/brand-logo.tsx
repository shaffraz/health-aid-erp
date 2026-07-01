import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
  variant?: "full" | "mark";
};

export function BrandLogo({ className, priority = false, variant = "full" }: BrandLogoProps) {
  if (variant === "mark") {
    return (
      <Image
        src="/brand/health-aid-arugambay-mark.png"
        alt="Health Aid Arugambay"
        width={360}
        height={360}
        priority={priority}
        unoptimized
        className={cn("h-auto w-full object-contain", className)}
      />
    );
  }

  return (
    <Image
      src="/brand/health-aid-arugambay-logo.png"
      alt="Health Aid Arugambay"
      width={900}
      height={255}
      priority={priority}
      unoptimized
      className={cn("h-auto w-full object-contain", className)}
    />
  );
}
