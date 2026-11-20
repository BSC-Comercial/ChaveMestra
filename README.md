# 🔐 ChaveMestra

Gerenciador de senhas pessoal para acessos de servidores de clientes e senhas pessoais.
Tudo é criptografado **no seu aparelho** com a senha mestra. Nada sai dele em texto puro.

## Como abrir no PC (fase 1)

Na pasta do projeto, rode:

```bash
npm run dev
```

Depois abra http://localhost:5173 no navegador.

> Sem o OneDrive conectado, o cofre fica salvo só **no navegador em que você abriu**.
> Com ele conectado, cada alteração vai criptografada para `OneDrive › Aplicativos › ChaveMestra`,
> e alterações feitas no PC e no celular são mescladas automaticamente.
> Mesmo assim, use **⚙️ → Exportar backup** de vez em quando.

## Segurança

| Item | Como funciona |
|---|---|
| Senha mestra | Vira chave com **Argon2id** (64 MiB, 3 passadas) e nunca é gravada |
| Criptografia | **AES-256-GCM**, com IV novo a cada salvamento e cabeçalho autenticado |
| Chave na memória | Não exportável e descartada ao travar |
| Bloqueio automático | Após X minutos sem uso (padrão 5) |
| Área de transferência | Limpa sozinha após X segundos (padrão 20) |
| Código publicado | CSP bloqueia scripts externos; só 1 dependência de criptografia (`hash-wasm`) |

⚠️ **Não existe recuperação de senha mestra.** Se esquecer, o cofre não abre.

## Roteiro

- [x] **Fase 1:** cofre local, pastas, registros, busca, gerador, tema claro/escuro, backup
- [x] **Fase 2:** sincronização pelo OneDrive, publicação no GitHub Pages, app instalável e offline (falta configurar: veja [CONFIGURAR.md](CONFIGURAR.md))
- [ ] **Fase 3:** códigos 2FA (TOTP), anexar chaves SSH, relatório de senhas fracas/repetidas, Kit de Emergência

## Comandos

- `npm run dev`: abre a versão de desenvolvimento
- `npm test`: roda os testes de criptografia
- `npm run build`: gera a versão final em `dist/`
