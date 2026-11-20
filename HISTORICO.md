# 🔐 ChaveMestra — Histórico do projeto

Documento com tudo o que foi discutido, decidido e construído, desde a ideia inicial.
Última atualização: 27/10/2026.

---

## 1. A ideia

Um **organizador e gerenciador de senhas** para dois tipos de acesso:

1. **Servidores dos clientes que eu gerencio**: SSH, RDP, painéis web, bancos de dados, roteadores.
2. **Minhas senhas pessoais**: e-mail, bancos, sites.

Cada registro guarda **login, senha e informações de contexto** sobre aquele acesso, como
"porta 2222, só acessa pela VPN, falar com o João antes de reiniciar". É isso que falta nos gerenciadores comuns.

### Nome

| Opção | Ideia |
|---|---|
| **ChaveMestra** ✅ | A chave que abre todas as outras, ligada ao conceito de senha mestra |
| Bunker | Lugar seguro |
| Sentinela | Vigia dos acessos |
| Kofre | "Cofre" com um toque de marca |

**Escolhido: ChaveMestra.**

---

## 2. Decisões tomadas

| Pergunta | Resposta |
|---|---|
| Plataforma | Windows no PC **e** acesso pelo celular/navegador |
| Usuários | Só eu |
| Sei programar? | Não. O Claude escreve e mantém o código |
| Senhas existentes para importar | Nenhuma, começo do zero |
| Hospedagem | **GitHub Pages** (grátis) |
| Visual | Tema claro e escuro, **com botão para alternar** |
| Conta no GitHub | Sim, já tenho |

### Alternativas consideradas
- **Soluções prontas** (KeePassXC, Bitwarden/Vaultwarden): auditadas e confiáveis, mas sem os campos e o fluxo
  do meu trabalho. Optei por construir, usando apenas bibliotecas de criptografia consagradas.
- **Servidor próprio**: descartado. Daria trabalho de manutenção e aumentaria o risco.
- **App web instalável (PWA) + OneDrive**: ✅ escolhido. Não exige servidor, funciona no PC e no celular,
  e o OneDrive que eu já uso faz a sincronização.

---

## 3. Arquitetura

```
   💻 PC (Windows)          📱 Celular
   app instalado            app instalado
          │                       │
          └──── ChaveMestra ──────┘
               (criptografa e descriptografa
                tudo DENTRO do aparelho)
                         │
                         ▼
              ☁️ Meu OneDrive
     Aplicativos › ChaveMestra › cofre.chavemestra
     (arquivo 100% criptografado)
```

- **Conhecimento zero:** a senha mestra nunca sai do aparelho e nunca é gravada.
- **Duas camadas:** para abrir o cofre é preciso a conta Microsoft (com 2FA) **e** a senha mestra.
- **Offline:** o app e uma cópia do cofre ficam no aparelho e funcionam sem internet.
- **Código no GitHub, cofre nunca:** o repositório é público, mas só contém o código do app.

---

## 4. Fase 1: núcleo local ✅

### Funcionalidades
- **Criar cofre** com senha mestra. Exige no mínimo 10 caracteres, força pelo menos "Média",
  confirmação e o aceite de que **não há recuperação**.
- **Pastas e subpastas.** "Pessoal" e "Clientes" já vêm criadas; dá para criar, renomear e excluir pastas
  (só se estiverem vazias).
- **Tipos de registro:** 🖥️ SSH, 🪟 RDP, 🌐 Site/Painel, 🗄️ Banco de dados, ✉️ E-mail, 🔑 Genérico.
  Cada tipo mostra os campos certos e já sugere a porta padrão.
- **Campos:** título, host/IP, porta, URL, usuário, senha, notas livres, tags, favorito e
  **campos extras** personalizados (podem ser ocultos, ex.: "Senha root", "ID AnyDesk").
- **Comando pronto para conectar:** `ssh usuario@host -p porta` ou `mstsc /v:host:porta`, com botão de copiar.
- **Busca** em nome, IP, usuário, URL, notas, tags e pasta. Ignora acentos, procura várias palavras de uma vez
  e **não pesquisa dentro das senhas**.
- **Gerador de senhas:** tamanho de 8 a 64, minúsculas, maiúsculas, números, símbolos e opção de evitar
  caracteres parecidos (l, 1, O, 0).
- **Indicador de força** da senha.
- **Histórico de senhas:** ao trocar uma senha, a antiga fica guardada (até 20). O app avisa se a senha
  tem mais de 180 dias.
- **Cópia segura:** a área de transferência é limpa sozinha (padrão: 20 s).
- **Bloqueio automático** por inatividade (padrão: 5 min) e botão 🔒 para travar na hora.
- **Tema claro/escuro** com botão.
- **Layout para celular:** menu lateral recolhível e telas em sequência (lista → detalhe).
- **Backup:** exportar e importar o arquivo `.chavemestra` (continua criptografado).
- **Configurações:** tempo de bloqueio, tempo de limpeza da área de transferência e troca da senha mestra.
- **Esqueci a senha:** explica que não há recuperação e permite apagar o cofre do aparelho
  (é preciso digitar APAGAR para confirmar).

### Testado no navegador
- Criação do cofre, registro salvo, busca, travar/destravar, senha errada recusada, tema claro e layout de PC e celular.
- Conferido que o que fica gravado é **só dado embaralhado**, sem IP, título ou senha legíveis.

---

## 5. Fase 2: nuvem e celular ✅ (código pronto, falta configurar)

### Sincronização com o OneDrive
- Login com a conta Microsoft. O app pede só a permissão **Files.ReadWrite.AppFolder**, que dá acesso
  **apenas** à pasta do app no OneDrive.
- Cada alteração é enviada cerca de 1,5 s depois de feita.
- O app confere a nuvem a cada 60 s, quando volta para a tela e quando a internet volta.
- **Mesclagem entre aparelhos:** em cada registro vale a edição mais recente. Exclusões deixam uma "marca"
  para que o item não volte sozinho. Um registro cuja pasta foi apagada em outro aparelho vai para outra pasta.
- **Proteção contra sobrescrever:** o app só grava se a nuvem ainda estiver na versão que ele conhece. Se outro
  aparelho gravou antes, ele mescla e tenta de novo.
- **Indicador no topo:** 💾 só neste aparelho · ☁️ sincronizado · 🔄 enviando · 📴 sem internet · ⚠️ erro.
- No celular novo: botão **☁️ Entrar com Microsoft** baixa o cofre existente.
- Em Configurações: conectar, desconectar (só neste aparelho) e sincronizar agora.

### App instalável (PWA)
- Ícone próprio (chave branca em fundo roxo), abre em tela cheia.
- **Funciona offline:** o app fica guardado no aparelho. Nenhum dado do cofre vai para esse cache.
- Ajuste para o notch do iPhone.

### Publicação automática
- A cada envio para a branch `main`, o GitHub **roda os testes** e, se passarem, publica no GitHub Pages.

### Testado
- Versão publicável com as regras de segurança ligadas: criptografia funcionando e app abrindo offline.
- Tela "Entrar com Microsoft" aparecendo quando o OneDrive está configurado.
- **Ainda não testado:** o login real e a sincronização com o OneDrive (falta o registro na Microsoft).

---

## 6. Segurança

| Item | Como funciona |
|---|---|
| Senha mestra → chave | **Argon2id** (64 MiB de memória, 3 passadas, sal aleatório de 16 bytes), cerca de 0,5 a 1 s por tentativa |
| Criptografia | **AES-256-GCM** com IV novo a cada salvamento |
| Integridade | Cabeçalho do arquivo autenticado: qualquer alteração invalida o arquivo |
| Chave na memória | Não exportável, descartada ao travar |
| Gerador de senhas | Gerador criptográfico do navegador, sem viés |
| Regras do navegador (CSP) | Bloqueia scripts externos; a rede só alcança os servidores da Microsoft |
| Dependências | Mínimas: `hash-wasm` (Argon2), `@azure/msal-browser` (login Microsoft), React |
| Cópia local | IndexedDB, sempre criptografada, guardando também a versão anterior |
| Acesso ao OneDrive | Só à pasta do app |

⚠️ **Não existe recuperação da senha mestra.** Se esquecer, ninguém abre o cofre.

---

## 7. Estrutura dos arquivos

```
repositorio senha/
├── CONFIGURAR.md          ← passo a passo do GitHub e da Microsoft
├── HISTORICO.md           ← este documento
├── README.md              ← resumo e comandos
├── index.html
├── package.json
├── vite.config.ts         ← regras de segurança (CSP) da versão publicada
├── .github/workflows/
│   └── deploy.yml         ← testa e publica no GitHub Pages
├── public/
│   ├── manifest.webmanifest   ← dados para instalar como app
│   ├── sw.js                  ← modo offline
│   └── icon*.png / icon.svg   ← ícones
└── src/
    ├── config.ts          ← ID do app Microsoft (falta preencher)
    ├── App.tsx            ← sessão, salvamento e sincronização
    ├── hooks.ts           ← tema e bloqueio automático
    ├── styles.css         ← visual claro/escuro e celular
    ├── lib/
    │   ├── crypto.ts      ← Argon2id + AES-256-GCM
    │   ├── vault.ts       ← modelo de dados, busca e mesclagem
    │   ├── storage.ts     ← cópia local (IndexedDB)
    │   ├── onedrive.ts    ← login Microsoft e OneDrive
    │   ├── generator.ts   ← gerador e força de senha
    │   ├── clipboard.ts   ← cópia com limpeza automática
    │   └── *.test.ts      ← testes automáticos
    └── components/        ← telas (criar, destravar, principal, editor, configurações…)
```

### Testes automáticos: 11 de 11 passando
- Criptografar e descriptografar, recusar senha errada, detectar arquivo adulterado, IV novo a cada salvamento.
- Gerador respeitando tamanho e tipos, classificação de força.
- Mesclagem: registros dos dois lados, edição mais recente vence, exclusão não ressuscita, edição posterior
  à exclusão vence, registro de pasta apagada é realocado.

---

## 8. Ambiente instalado no PC

- **Node.js 24 LTS**, instalado pelo winget.
- **Git 2.56**, já existia.
- Repositório Git local criado na branch `main`, com o primeiro commit
  (autor: `wballock <ballock89@gmail.com>`; ajustar se o usuário do GitHub for outro).
- **Nada foi enviado para a internet ainda.**

### Comandos úteis
```bash
npm run dev
```
Abre o app em http://localhost:5173.

```bash
npm test
```
Roda os testes.

---

## 9. Pendências

### Comigo (veja [CONFIGURAR.md](CONFIGURAR.md))
- [ ] Criar o repositório público `chavemestra` no GitHub e ligar o Pages (Source: GitHub Actions)
- [ ] Registrar o app em entra.microsoft.com e copiar o **ID do aplicativo (cliente)**
- [ ] Enviar ao Claude: usuário do GitHub e ID do aplicativo

### Com o Claude, depois disso
- [ ] Colocar o ID em `src/config.ts`, enviar o código e publicar
- [ ] Testar o login e a sincronização reais entre PC e celular

### Fase 3 (futuro)
- [ ] Códigos 2FA (TOTP)
- [ ] Anexar chaves SSH (`.pem` / `.ppk`)
- [ ] Relatório de senhas fracas e repetidas
- [ ] Kit de Emergência para imprimir
- [ ] Indicador de força que reconheça palavras de dicionário

---

## 10. Cuidados a lembrar

- **Repositório público** é necessário para o Pages grátis. O cofre nunca vai para o GitHub.
- **A Microsoft pode exigir uma conta Azure gratuita** para registrar o app com conta pessoal
  (pode pedir cartão só para verificação).
- **O cofre de `localhost` não passa sozinho** para o endereço publicado: exportar o backup e importar lá.
- **Trocar a senha mestra** com o app aberto em outro aparelho faz esse aparelho mostrar erro de
  sincronização até ser travado e aberto de novo com a senha nova.
- **O indicador de força é otimista** com senhas que contêm palavras comuns.
- **Fazer backup** (⚙️ → Exportar) de vez em quando, mesmo com o OneDrive ligado.
