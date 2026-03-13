/// <reference types="vite/client" />

declare module 'react-responsive-masonry' {
  import type { ReactNode, CSSProperties } from 'react';
  interface MasonryProps {
    children: ReactNode;
    gutter?: string;
    columnsCount?: number;
    className?: string;
    style?: CSSProperties;
    itemTag?: string;
    itemStyle?: CSSProperties;
  }
  interface ResponsiveMasonryProps {
    children: ReactNode;
    columnsCountBreakPoints?: Record<number, number>;
    className?: string;
    style?: CSSProperties;
  }
  export function ResponsiveMasonry(props: ResponsiveMasonryProps): JSX.Element;
  export default function Masonry(props: MasonryProps): JSX.Element;
}

declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: Error) => void;
  }

  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}
