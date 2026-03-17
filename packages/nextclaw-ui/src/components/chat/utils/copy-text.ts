function canUseClipboardApi(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard?.writeText === 'function'
  );
}

function restoreSelection(ranges: Range[]) {
  if (typeof document === 'undefined') {
    return;
  }

  const selection = document.getSelection();
  if (!selection) {
    return;
  }

  selection.removeAllRanges();
  ranges.forEach((range) => selection.addRange(range));
}

function fallbackCopyText(text: string): boolean {
  if (typeof document === 'undefined' || !document.body) {
    return false;
  }

  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const activeInput = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement
    ? activeElement
    : null;
  const activeSelection = activeInput
    ? {
        start: activeInput.selectionStart,
        end: activeInput.selectionEnd
      }
    : null;
  const selection = document.getSelection();
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange())
    : [];

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  textarea.style.fontSize = '12pt';

  document.body.appendChild(textarea);

  try {
    textarea.focus({ preventScroll: true });
  } catch {
    textarea.focus();
  }

  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;
  try {
    copied = typeof document.execCommand === 'function' && document.execCommand('copy');
  } catch {
    copied = false;
  }

  textarea.remove();

  if (activeElement) {
    try {
      activeElement.focus({ preventScroll: true });
    } catch {
      activeElement.focus();
    }
  }

  if (activeInput && activeSelection) {
    activeInput.setSelectionRange(activeSelection.start, activeSelection.end);
  } else {
    restoreSelection(ranges);
  }

  return copied;
}

export async function copyText(text: string): Promise<boolean> {
  if (!text) {
    return false;
  }

  if (canUseClipboardApi()) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return fallbackCopyText(text);
    }
  }

  return fallbackCopyText(text);
}
