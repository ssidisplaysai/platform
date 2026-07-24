type GlwIconProps = {
  className?: string;
};

function iconClassName(className?: string): string {
  return `h-4 w-4 shrink-0 ${className ?? ""}`.trim();
}

export function DashboardIcon({ className }: GlwIconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={iconClassName(className)}>
      <path d="M3 3h6v6H3V3Zm8 0h6v3h-6V3ZM3 11h6v6H3v-6Zm8 0h6v6h-6v-6Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function PagesIcon({ className }: GlwIconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={iconClassName(className)}>
      <path d="M6 2.5h6.5L15 5v12.5H6V2.5Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12.5 2.5V5H15" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 8h4M8 11h4M8 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function BlogsIcon({ className }: GlwIconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={iconClassName(className)}>
      <path d="M5.5 3.5h9A2.5 2.5 0 0 1 17 6v8a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 3 14V6a2.5 2.5 0 0 1 2.5-2.5Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 7h7M6.5 10h5.5M6.5 13h6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function QueueIcon({ className }: GlwIconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={iconClassName(className)}>
      <path d="M4 5.5h12M4 10h12M4 14.5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14.5 12.5 17 10l-2.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SitesIcon({ className }: GlwIconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={iconClassName(className)}>
      <path d="M10 17s5-4.2 5-8.4A5 5 0 1 0 5 8.6C5 12.8 10 17 10 17Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function SettingsIcon({ className }: GlwIconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={iconClassName(className)}>
      <path d="M8.4 3.5h3.2l.5 1.8a5.9 5.9 0 0 1 1.3.8l1.8-.7 1.6 2.8-1.4 1.3c.1.3.2.9.2 1.4s-.1 1-.2 1.4l1.4 1.3-1.6 2.8-1.8-.7a5.9 5.9 0 0 1-1.3.8l-.5 1.8H8.4l-.5-1.8a5.9 5.9 0 0 1-1.3-.8l-1.8.7-1.6-2.8 1.4-1.3A5.5 5.5 0 0 1 4.4 10c0-.5.1-1.1.2-1.4L3.2 7.3l1.6-2.8 1.8.7a5.9 5.9 0 0 1 1.3-.8l.5-1.8Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M10 12.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function SearchIcon({ className }: GlwIconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={iconClassName(className)}>
      <path d="M8.5 14.5a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="m12.8 12.8 3.7 3.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function UserIcon({ className }: GlwIconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={iconClassName(className)}>
      <path d="M10 9.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.5 17a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function LogoutIcon({ className }: GlwIconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={iconClassName(className)}>
      <path d="M8 4.5H5.5A2.5 2.5 0 0 0 3 7v6a2.5 2.5 0 0 0 2.5 2.5H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11 6.5 14.5 10 11 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.5 10H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: GlwIconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={iconClassName(className)}>
      <path d="m5.5 8 4.5 4 4.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
