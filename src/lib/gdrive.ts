import { GOOGLE_CLIENT_ID } from '../config';
import { isVaultFile, type VaultFile } from './crypto';

// Escopo restrito à pasta oculta do app no Drive: o app não enxerga o resto dos seus arquivos.
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email';
const FILE_NAME = 'cofre.chavemestra';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const CONNECTED_KEY = 'cm-gdrive-connected';

export const gdriveEnabled = GOOGLE_CLIENT_ID !== '';

export class ConflictError extends Error {
  constructor() {
    super('O arquivo no Google Drive mudou');
  }
}
export class NotSignedInError extends Error {
  constructor() {
    super('Google Drive não conectado');
  }
}

export interface RemoteVault {
  file: VaultFile;
  etag: string;
}

// ---------- Login (Google Identity Services, sem segredo e sem servidor) ----------

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}
interface TokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}
interface GoogleGlobal {
  google: {
    accounts: {
      oauth2: {
        initTokenClient(config: {
          client_id: string;
          scope: string;
          callback: (r: TokenResponse) => void;
          error_callback?: (e: { type: string }) => void;
        }): TokenClient;
      };
    };
  };
}

let token: { value: string; expires: number } | null = null;
let tokenClient: Promise<TokenClient> | null = null;
let inflight: Promise<string> | null = null;
let ready: TokenClient | null = null;
let pending: { resolve: (t: string) => void; reject: (e: Error) => void } | null = null;

/** Carrega o script do Google só quando o Drive está configurado. */
function loadGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as unknown as Partial<GoogleGlobal>).google) return resolve();
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      tokenClient = null;
      reject(new Error('Não foi possível carregar o login do Google'));
    };
    document.head.appendChild(s);
  });
}

function loginError(type: string): string {
  if (type === 'popup_failed_to_open')
    return 'O navegador bloqueou a janela do Google. Permita pop-ups para este endereço e tente de novo.';
  if (type === 'popup_closed') return 'A janela do Google foi fechada antes de concluir o login.';
  return `Falha no login do Google (${type}).`;
}

function client(): Promise<TokenClient> {
  tokenClient ??= loadGis().then(() => {
    const oauth2 = (window as unknown as GoogleGlobal).google.accounts.oauth2;
    const created = oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: (r) => {
        const p = pending;
        pending = null;
        if (r.error || !r.access_token) return p?.reject(new Error(`Login não concluído${r.error ? ` (${r.error})` : ''}.`));
        const t = r.access_token;
        token = { value: t, expires: Date.now() + (r.expires_in ?? 3600) * 1000 - 60_000 };
        void fetchEmail(t).then((email) => {
          localStorage.setItem(CONNECTED_KEY, email ?? 'Google Drive');
          p?.resolve(t);
        });
      },
      error_callback: (e) => {
        const p = pending;
        pending = null;
        p?.reject(new Error(loginError(e.type)));
      },
    });
    ready = created;
    return created;
  });
  return tokenClient;
}

function requestToken(prompt: string): Promise<string> {
  // Evita abrir dois pedidos ao mesmo tempo (ex.: sincronização automática + botão).
  inflight ??= client()
    .then(
      (c) =>
        new Promise<string>((resolve, reject) => {
          pending = { resolve, reject };
          c.requestAccessToken({ prompt });
        }),
    )
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Lê o e-mail da conta conectada (permissão userinfo.email). */
async function fetchEmail(t: string): Promise<string | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) {
      console.warn('[Google Drive] userinfo respondeu', res.status, await res.text());
      return null;
    }
    return ((await res.json()) as { email?: string }).email ?? null;
  } catch (e) {
    console.warn('[Google Drive] falha ao ler o e-mail', e);
    return null;
  }
}

/** Nome exibido na tela. O Google não envia o e-mail sem um escopo extra, então mostramos só o serviço. */
export async function accountName(): Promise<string | null> {
  if (!gdriveEnabled) return null;
  const saved = localStorage.getItem(CONNECTED_KEY);
  if (!saved) return null;
  return saved.includes('@') ? saved : 'Google Drive';
}

/** Carrega o login do Google ao abrir o app, para o clique em "Conectar" abrir a janela na hora. */
export function preloadGoogle() {
  if (gdriveEnabled) void client().catch(() => undefined);
}

export function signIn(): Promise<void> {
  // Sem "await" antes: o navegador só deixa abrir a janela do Google dentro do clique do usuário.
  const c = ready;
  if (!c) return requestToken('select_account').then(() => undefined);
  return new Promise<void>((resolve, reject) => {
    pending = { resolve: () => resolve(), reject };
    c.requestAccessToken({ prompt: 'select_account' });
  });
}

/** Desconecta só neste aparelho. Não revoga o acesso no Google. */
export async function signOut() {
  token = null;
  localStorage.removeItem(CONNECTED_KEY);
}

async function accessToken(): Promise<string> {
  if (token && Date.now() < token.expires) return token.value;
  if (!localStorage.getItem(CONNECTED_KEY)) throw new NotSignedInError();
  try {
    // Renovação silenciosa: funciona sem o usuário clicar, enquanto a sessão Google estiver ativa.
    return await requestToken('');
  } catch {
    throw new NotSignedInError();
  }
}

async function drive(url: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await accessToken()}`);
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401 && retry) {
    token = null; // token venceu: pega outro e tenta uma vez
    return drive(url, init, false);
  }
  return res;
}

// ---------- Arquivo do cofre ----------

interface Found {
  id: string;
  headRevisionId: string;
}

async function findVault(): Promise<Found | null> {
  const q = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${FILE_NAME}' and trashed = false`,
    fields: 'files(id,headRevisionId)',
    pageSize: '1',
  });
  const res = await drive(`${API}?${q}`);
  if (!res.ok) throw new Error(`Google Drive respondeu ${res.status}`);
  const { files } = (await res.json()) as { files?: Found[] };
  return files?.[0] ?? null;
}

/** Baixa o cofre do Google Drive. `null` se ainda não existe. */
export async function downloadVault(): Promise<RemoteVault | null> {
  const found = await findVault();
  if (!found) return null;
  const res = await drive(`${API}/${found.id}?alt=media`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Falha ao baixar do Google Drive (${res.status})`);
  const file = await res.json();
  if (!isVaultFile(file)) throw new Error('O arquivo no Google Drive não é um cofre válido');
  return { file, etag: found.headRevisionId };
}

/**
 * Envia o cofre. Só grava se o Drive ainda estiver na revisão `etag` que conhecemos;
 * se outro aparelho gravou antes, lança ConflictError para mesclar e tentar de novo.
 * Obs.: o Drive não oferece gravação condicional por versão; a checagem é feita logo antes do envio.
 */
export async function uploadVault(file: VaultFile, etag: string | null): Promise<string> {
  const body = JSON.stringify(file);
  const found = await findVault();

  let res: Response;
  if (found) {
    if (found.headRevisionId !== etag) throw new ConflictError();
    res = await drive(`${UPLOAD}/${found.id}?uploadType=media&fields=headRevisionId`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } else {
    if (etag) throw new ConflictError(); // o arquivo foi apagado em outro lugar
    const boundary = `chavemestra${crypto.randomUUID()}`;
    const multipart = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] }),
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      body,
      `--${boundary}--`,
    ].join('\r\n');
    res = await drive(`${UPLOAD}?uploadType=multipart&fields=headRevisionId`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: multipart,
    });
  }

  if (res.status === 409 || res.status === 412) throw new ConflictError();
  if (!res.ok) throw new Error(`Google Drive respondeu ${res.status}`);
  return ((await res.json()) as { headRevisionId: string }).headRevisionId;
}
