import { toPng } from 'html-to-image';

export async function exportToPng(element: HTMLElement, filename: string): Promise<void> {
  const dataUrl = await toPng(element, {
    quality: 1,
    pixelRatio: 2,
    backgroundColor: '#0a0a0f',
    filter: (node: HTMLElement) => !node.classList?.contains?.('no-export'),
  });
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export async function copyToClipboard(element: HTMLElement): Promise<void> {
  const dataUrl = await toPng(element, {
    quality: 1,
    pixelRatio: 2,
    backgroundColor: '#0a0a0f',
    filter: (node: HTMLElement) => !node.classList?.contains?.('no-export'),
  });
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
