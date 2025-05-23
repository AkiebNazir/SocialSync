import type { SocialPlatform } from '@/types';
import { socialPlatformsConfig } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import type { LucideProps } from 'lucide-react';

interface SocialIconProps extends Omit<LucideProps, 'color'> {
  platform: SocialPlatform;
  size?: number;
}

export function SocialIcon({ platform, size = 20, className, ...props }: SocialIconProps) {
  const config = socialPlatformsConfig[platform];
  if (!config) return null;

  const IconComponent = config.icon;

  return (
    <IconComponent
      size={size}
      className={cn("text-white", className)} // Default to white, color is handled by parent usually
      aria-label={`${platform} icon`}
      {...props}
    />
  );
}
