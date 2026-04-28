/**
 * ScreenshotMarker
 * Injects a transparent canvas overlay on the live page, draws highlight
 * rectangles / arrows / labels around failing elements, takes a screenshot,
 * then removes the overlay — all without any extra npm packages.
 *
 * Usage in tests:
 *   import { ScreenshotMarker } from '../../utils/screenshot-marker';
 *
 *   // Mark a locator by selector
 *   await ScreenshotMarker.markLocator(page, page.locator('button.submit'), 'FAIL: button not found');
 *
 *   // Mark by explicit bounding box
 *   await ScreenshotMarker.markBox(page, { x: 100, y: 200, width: 300, height: 50 }, 'Error zone');
 *
 *   // Mark multiple annotations at once
 *   await ScreenshotMarker.annotate(page, [
 *     { bbox: { x:10, y:10, width:200, height:40 }, label:'Header', color:'#2563EB' },
 *     { bbox: { x:10, y:80, width:200, height:40 }, label:'FAIL here', color:'#DC2626' },
 *   ], 'reports/screenshots/annotated.png');
 */

import { type Page, type Locator } from '@playwright/test';
import * as fs   from 'fs';
import * as path from 'path';

export interface BoundingBox { x: number; y: number; width: number; height: number; }

export interface Annotation {
  bbox:   BoundingBox;
  label:  string;
  color?: string;  // default '#DC2626' (red)
  style?: 'solid' | 'dashed' | 'arrow'; // default 'solid'
}

const OVERLAY_ID = '__pw_screenshot_marker__';

export class ScreenshotMarker {

  /**
   * Marks a Locator's bounding box on the page, takes a screenshot, and
   * removes the overlay.  Returns the absolute path to the saved PNG.
   */
  static async markLocator(
    page:       Page,
    locator:    Locator,
    label       = 'Error',
    outputPath?: string,
    color        = '#DC2626',
  ): Promise<string> {
    const bbox = await locator.boundingBox();
    if (!bbox) return ScreenshotMarker.fullPage(page, outputPath);
    return ScreenshotMarker.markBox(page, bbox, label, outputPath, color);
  }

  /**
   * Marks an explicit bounding box rectangle on the page.
   */
  static async markBox(
    page:       Page,
    bbox:       BoundingBox,
    label       = 'Error',
    outputPath?: string,
    color        = '#DC2626',
  ): Promise<string> {
    return ScreenshotMarker.annotate(page, [{ bbox, label, color }], outputPath);
  }

  /**
   * Draws multiple annotations on the page and takes a screenshot.
   */
  static async annotate(
    page:        Page,
    annotations: Annotation[],
    outputPath?: string,
  ): Promise<string> {
    await ScreenshotMarker.injectOverlay(page, annotations);
    const screenshotPath = await ScreenshotMarker.capture(page, outputPath);
    await ScreenshotMarker.removeOverlay(page);
    return screenshotPath;
  }

  /**
   * Takes a plain full-page screenshot (no annotation).
   */
  static async fullPage(page: Page, outputPath?: string): Promise<string> {
    return ScreenshotMarker.capture(page, outputPath);
  }

  /**
   * Marks an element, adds an arrow pointing to it, and an info panel.
   * Useful for call-outs in bug reports.
   */
  static async markWithCallout(
    page:        Page,
    locator:     Locator,
    title:       string,
    description: string,
    outputPath?: string,
  ): Promise<string> {
    const bbox = await locator.boundingBox();
    if (!bbox) return ScreenshotMarker.fullPage(page, outputPath);

    await page.evaluate(
      ({ id, b, title: t, description: d }) => {
        // Remove any existing overlay
        document.getElementById(id)?.remove();

        const canvas = document.createElement('canvas');
        canvas.id = id;
        canvas.style.cssText = [
          'position:fixed', 'top:0', 'left:0',
          'width:100vw', 'height:100vh',
          'pointer-events:none', 'z-index:2147483647',
        ].join(';');
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
        document.body.appendChild(canvas);

        const ctx = canvas.getContext('2d')!;
        const color = '#DC2626';

        // Pulsing red border
        ctx.strokeStyle = color;
        ctx.lineWidth   = 3;
        ctx.setLineDash([]);
        ctx.strokeRect(b.x - 2, b.y - 2, b.width + 4, b.height + 4);

        // Semi-transparent fill
        ctx.fillStyle = 'rgba(220,38,38,0.08)';
        ctx.fillRect(b.x, b.y, b.width, b.height);

        // Arrow from callout panel to element
        const tipX = b.x + b.width / 2;
        const tipY = b.y;
        const panelX = Math.min(b.x + b.width + 20, canvas.width - 280);
        const panelY = Math.max(b.y - 80, 10);

        ctx.strokeStyle = color;
        ctx.lineWidth   = 2;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(panelX, panelY + 30);
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrow head
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - 8, tipY + 14);
        ctx.lineTo(tipX + 8, tipY + 14);
        ctx.closePath();
        ctx.fill();

        // Callout panel background
        const panelW = 260;
        const panelH = 72;
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur  = 8;
        ctx.fillStyle   = '#1E293B';
        roundRect(ctx, panelX, panelY, panelW, panelH, 6);
        ctx.fill();
        ctx.shadowBlur  = 0;

        // Red top bar
        ctx.fillStyle = color;
        roundRectTop(ctx, panelX, panelY, panelW, 4, 6);
        ctx.fill();

        // Title text
        ctx.fillStyle = '#F8FAFC';
        ctx.font      = 'bold 13px system-ui, sans-serif';
        ctx.fillText(t.substring(0, 32), panelX + 10, panelY + 22);

        // Description text
        ctx.fillStyle = '#94A3B8';
        ctx.font      = '11px system-ui, sans-serif';
        wrapText(ctx, d, panelX + 10, panelY + 40, panelW - 20, 16);

        function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
          c.beginPath();
          c.moveTo(x + r, y);
          c.lineTo(x + w - r, y);
          c.quadraticCurveTo(x + w, y, x + w, y + r);
          c.lineTo(x + w, y + h - r);
          c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
          c.lineTo(x + r, y + h);
          c.quadraticCurveTo(x, y + h, x, y + h - r);
          c.lineTo(x, y + r);
          c.quadraticCurveTo(x, y, x + r, y);
          c.closePath();
        }

        function roundRectTop(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
          c.beginPath();
          c.moveTo(x + r, y);
          c.lineTo(x + w - r, y);
          c.quadraticCurveTo(x + w, y, x + w, y + r);
          c.lineTo(x + w, y + h);
          c.lineTo(x, y + h);
          c.lineTo(x, y + r);
          c.quadraticCurveTo(x, y, x + r, y);
          c.closePath();
        }

        function wrapText(c: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
          const words = text.split(' ');
          let line = '';
          for (const word of words) {
            const test = line + word + ' ';
            if (c.measureText(test).width > maxW && line !== '') {
              c.fillText(line.trim(), x, y);
              line = word + ' ';
              y += lineH;
            } else {
              line = test;
            }
          }
          c.fillText(line.trim(), x, y);
        }
      },
      { id: OVERLAY_ID, b: bbox, title, description },
    );

    const screenshotPath = await ScreenshotMarker.capture(page, outputPath);
    await ScreenshotMarker.removeOverlay(page);
    return screenshotPath;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private static async injectOverlay(page: Page, annotations: Annotation[]): Promise<void> {
    await page.evaluate(
      ({ id, annotations: anns }) => {
        document.getElementById(id)?.remove();

        const canvas = document.createElement('canvas');
        canvas.id = id;
        canvas.style.cssText = [
          'position:fixed', 'top:0', 'left:0',
          'width:100vw', 'height:100vh',
          'pointer-events:none', 'z-index:2147483647',
        ].join(';');
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
        document.body.appendChild(canvas);

        const ctx = canvas.getContext('2d')!;

        for (const ann of anns) {
          const { bbox: b, label, color = '#DC2626', style = 'solid' } = ann;

          ctx.strokeStyle = color;
          ctx.lineWidth   = 3;

          if (style === 'dashed') {
            ctx.setLineDash([8, 4]);
          } else {
            ctx.setLineDash([]);
          }

          // Border
          ctx.strokeRect(b.x - 2, b.y - 2, b.width + 4, b.height + 4);
          ctx.setLineDash([]);

          // Fill
          const hex = color.replace('#', '');
          const r   = parseInt(hex.substring(0, 2), 16);
          const g   = parseInt(hex.substring(2, 4), 16);
          const bl  = parseInt(hex.substring(4, 6), 16);
          ctx.fillStyle = `rgba(${r},${g},${bl},0.10)`;
          ctx.fillRect(b.x, b.y, b.width, b.height);

          // Label pill
          ctx.font = 'bold 12px system-ui, sans-serif';
          const textW   = ctx.measureText(label).width;
          const pillW   = textW + 16;
          const pillH   = 22;
          const pillX   = b.x - 2;
          const pillY   = b.y - 2 - pillH;

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.roundRect?.(pillX, pillY, pillW, pillH, 4);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(label, pillX + 8, pillY + 15);

          // Corner accent dots
          const dotR = 4;
          ctx.fillStyle = color;
          [[b.x - 2, b.y - 2], [b.x + b.width + 2, b.y - 2],
           [b.x - 2, b.y + b.height + 2], [b.x + b.width + 2, b.y + b.height + 2]
          ].forEach(([cx, cy]) => {
            ctx.beginPath();
            ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      },
      { id: OVERLAY_ID, annotations },
    );
  }

  private static async removeOverlay(page: Page): Promise<void> {
    await page.evaluate((id) => document.getElementById(id)?.remove(), OVERLAY_ID);
  }

  private static async capture(page: Page, outputPath?: string): Promise<string> {
    if (!outputPath) {
      const dir = 'reports/screenshots';
      fs.mkdirSync(dir, { recursive: true });
      outputPath = path.join(dir, `annotated-${Date.now()}.png`);
    } else {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    }
    await page.screenshot({ path: outputPath, fullPage: true });
    return outputPath;
  }
}
