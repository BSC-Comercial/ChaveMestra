# ☁️ Passo a passo: publicar e ligar o OneDrive

São 3 etapas que só você pode fazer, porque usam as suas contas. Cada uma leva uns 5 minutos.
No fim, me mande **duas informações**: o seu **usuário do GitHub** e o **ID do aplicativo** da Microsoft.

---

## Etapa 1: criar o repositório no GitHub

1. Entre em https://github.com/new
2. **Repository name:** `chavemestra`
3. Marque **Public**.
   > O GitHub Pages gratuito exige repositório público. Isso é seguro: o código fica visível, mas **o cofre nunca vai para lá**. Ele fica só no seu OneDrive, criptografado.
4. **Não** marque "Add a README" nem nenhuma outra opção.
5. Clique em **Create repository**.
6. No repositório criado, vá em **Settings → Pages**.
7. Em **Build and deployment → Source**, escolha **GitHub Actions**.

Pronto. O endereço do app será: `https://SEU-USUARIO.github.io/chavemestra/`

---

## Etapa 2: registrar o app na Microsoft (para acessar o OneDrive)

1. Entre em https://entra.microsoft.com com a **mesma conta do seu OneDrive**.
   > Se aparecer um aviso de que contas pessoais precisam de um diretório, crie a conta gratuita do Azure em https://azure.microsoft.com/free (pode pedir um cartão só para verificação, sem cobrança) e volte para este passo.
2. No menu: **Aplicativos → Registros de aplicativo → + Novo registro**.
3. Preencha:
   - **Nome:** `ChaveMestra`
   - **Tipos de conta com suporte:** *Contas em qualquer diretório organizacional e contas pessoais da Microsoft*
   - **URI de Redirecionamento:** escolha a plataforma **Aplicativo de página única (SPA)** e digite
     `https://SEU-USUARIO.github.io/chavemestra/` (com a barra no final)
4. Clique em **Registrar**.
5. Na página que abrir, copie o **ID do aplicativo (cliente)**. É um código assim: `1a2b3c4d-....`
6. Para testar também no PC: vá em **Autenticação → Adicionar URI** e inclua `http://localhost:5173/`. Depois clique em **Salvar**.

> Não precisa criar "segredo do cliente" nem certificado. O app pede só a permissão
> **Files.ReadWrite.AppFolder**, que dá acesso **apenas** à pasta `OneDrive › Aplicativos › ChaveMestra`.
> Seus outros arquivos ficam inacessíveis para o app.

---

## Etapa 3: me mandar as informações

Me mande:
- seu usuário do GitHub
- o ID do aplicativo (cliente)

Eu coloco o ID no app e envio o código. Na primeira vez, o Windows abre uma janela pedindo para você
entrar no GitHub; é só confirmar. Em uns 2 minutos o app estará no ar.

---

## Depois: instalar no celular

Abra `https://SEU-USUARIO.github.io/chavemestra/` no celular e:

- **Android (Chrome):** menu **⋮ → Instalar app** (ou "Adicionar à tela inicial")
- **iPhone (Safari):** botão **Compartilhar → Adicionar à Tela de Início**

Na primeira abertura, toque em **☁️ Entrar com Microsoft**: o cofre do PC é baixado e você destrava
com a mesma senha mestra.

## Ordem recomendada no PC

1. Abra o endereço do GitHub Pages no PC e **importe o backup** que você exportou na fase 1
   (o cofre de `localhost` não passa sozinho para o novo endereço).
2. Vá em **⚙️ → Conectar OneDrive**, entre e destrave de novo. O ícone ☁️ no topo confirma a sincronização.
3. Só então abra no celular.
