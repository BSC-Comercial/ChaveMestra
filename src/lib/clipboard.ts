let clearTimer: ReturnType<typeof setTimeout> | undefined;

/** Copia e agenda a limpeza da área de transferência. */
export async function copySecret(text: string, seconds: number) {
  await navigator.clipboard.writeText(text);
  clearTimeout(clearTimer);
  clearTimer = setTimeout(clearClipboardNow, seconds * 1000);
}

export function clearClipboardNow() {
  clearTimeout(clearTimer);
  clearTimer = undefined;
  // Pode falhar se a janela estiver sem foco; nesse caso não há o que fazer.
  navigator.clipboard?.writeText('').catch(() => {});
}
