/**
 * Khai báo kiểu cho page-flip 2.0.7 (StPageFlip, MIT) — gói không kèm file .d.ts.
 * Chỉ khai báo phần dùng trong features/public-site/flipbook/PageFlipBook.tsx.
 * Import bản ES module trực tiếp (bản "main" là UMD).
 */
declare module 'page-flip/dist/js/page-flip.module.js' {
  export interface FlipSetting {
    startPage?: number;
    size?: 'fixed' | 'stretch';
    width: number;
    height: number;
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    drawShadow?: boolean;
    flippingTime?: number;
    usePortrait?: boolean;
    startZIndex?: number;
    autoSize?: boolean;
    maxShadowOpacity?: number;
    showCover?: boolean;
    mobileScrollSupport?: boolean;
    swipeDistance?: number;
    clickEventForward?: boolean;
    useMouseEvents?: boolean;
    showPageCorners?: boolean;
    disableFlipByClick?: boolean;
  }

  export type FlipCorner = 'top' | 'bottom';
  export type FlipState = 'user_fold' | 'fold_corner' | 'flipping' | 'read';
  export interface Point { x: number; y: number }
  export interface PageRect { left: number; top: number; width: number; height: number; pageWidth: number }

  /** Bộ điều khiển lật bên trong (không có trong tài liệu chính thức) — dùng để chỉnh vùng góc và gợi ý cong góc. */
  export interface FlipController {
    showCorner(globalPos: Point): void;
    isPointOnCorners(globalPos: Point): boolean;
    getBoundsRect(): PageRect;
    render: { convertToBook(pos: Point): Point };
  }

  export interface FlipEvent<T> { data: T; object: PageFlip }

  export interface Page {
    setDensity(density: 'soft' | 'hard'): void;
    getDensity(): 'soft' | 'hard';
  }

  export class PageFlip {
    constructor(element: HTMLElement, setting: FlipSetting);
    loadFromHTML(items: NodeListOf<HTMLElement> | HTMLElement[]): void;
    destroy(): void;
    flipNext(corner?: FlipCorner): void;
    flipPrev(corner?: FlipCorner): void;
    flip(page: number, corner?: FlipCorner): void;
    turnToPage(page: number): void;
    getCurrentPageIndex(): number;
    getPageCount(): number;
    getState(): FlipState;
    getOrientation(): 'portrait' | 'landscape';
    getBoundsRect(): PageRect;
    getFlipController(): FlipController;
    getPage(index: number): Page;
    on(event: 'flip', cb: (e: FlipEvent<number>) => void): this;
    on(event: 'changeState', cb: (e: FlipEvent<FlipState>) => void): this;
    on(event: 'init' | 'update' | 'changeOrientation', cb: (e: FlipEvent<unknown>) => void): this;
    off(event: string): void;
  }
}
