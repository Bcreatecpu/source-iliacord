# Atualização: hospedagem gratuita

Para Turso + Render Free, siga BANCO-GRATUITO.md. As instruções de disco pago abaixo são uma alternativa antiga. A conexão remota ainda precisa ser configurada.

# IliaCord — publicar e instalar

O projeto está pronto para rodar localmente. Não foi publicado em uma conta de hospedagem. É uma primeira versão funcional para pequenos grupos, não uma reprodução completa do Discord.

## O que está implementado

- Cadastro com nome único e senha, sem e-mail. Senhas protegidas com scrypt e salt individual; sessões expiram em sete dias.
- Pedidos de amizade, aceitar/recusar, lista de disponíveis e mensagens diretas entre amigos.
- Servidores com convite por código, canais de texto/voz e criação de canais pelo dono.
- Mensagens persistidas no servidor, atualização em tempo real, indicador de digitação, reações, apagar a própria mensagem e busca nas últimas 100 mensagens.
- Perfis com foto ou GIF (até 500 KB), nome de exibição, pronomes, bio, status, cor e decoração.
- Ilia Plus gratuito: decorações, GIF por link direto e figurinhas de emoji. Não está ligado ao Nitro ou à empresa Discord.
- Chamadas WebRTC em salas de até oito pessoas, microfone, ensurdecer, câmera e compartilhamento de tela do PC sem áudio do sistema. O áudio continua ao navegar nas conversas.
- Layout adaptável e instalação como PWA (aplicativo do site).
- Lista de amigos preenchida apenas com amizades aceitas. Nenhum perfil ou servidor fictício.

## 1. Rodar no seu PC

1. Instale o Node.js versão 24 LTS pelo site oficial: https://nodejs.org/
2. Extraia este ZIP e abra um terminal na pasta que contém `package.json`.
3. Execute `npm ci` e depois `npm start`.
4. Abra http://localhost:3000 no Chrome.
5. Crie sua conta. Para testar outra pessoa, use uma janela anônima com outra conta.

As contas ficam em `data/iliacord.sqlite`. Não publique essa pasta nem compartilhe seu banco. Faça backup com o servidor parado, incluindo os arquivos SQLite auxiliares se existirem. `npm test` executa testes de integração com banco temporário separado.

## 2. Publicar o servidor de contas e chamadas

O Netlify hospeda a interface deste projeto. O servidor Node com Socket.IO e SQLite precisa rodar em um serviço contínuo separado. Apenas arrastar a interface no Netlify não ativa contas, mensagens e chamadas.

Exemplo com Render (ou use um VPS com Node 24, HTTPS e armazenamento persistente):

1. Envie os arquivos do projeto a um repositório GitHub seu, sem `node_modules`, `data` ou segredos.
2. No Render, crie um **Web Service** ligado a esse repositório, usando Node.
3. Build command: `npm ci --omit=dev`. Start command: `npm start`.
4. Configure `NODE_VERSION=24` e `TRUST_PROXY=1` no Render, que usa um proxy na frente do servidor.
5. Adicione um disco persistente montado em `/var/data` e a variável `DATA_DIR=/var/data`. Escolha um plano que suporte esse disco; pode haver cobrança. Sem disco persistente, um redeploy pode apagar as contas e mensagens.
6. Configure `ALLOWED_ORIGINS` com a URL HTTPS exata do seu Netlify (sem barra no final). Se também usar a interface pelo Render, inclua a URL do Render separada por vírgula.
7. Anote a URL HTTPS do servidor. Ela será usada no passo seguinte.

Não rode várias instâncias desse servidor compartilhando o SQLite. Esta versão foi construída para uma instância e pequenos grupos.

Documentação oficial: https://render.com/docs/deploy-node-express-app e https://render.com/docs/disks

## 3. Publicar a interface no Netlify

1. Entre no Netlify e crie um site por upload manual. Use a pasta `public`, que contém `index.html`.
2. Anote a URL que o Netlify criou.
3. No servidor, configure `ALLOWED_ORIGINS` com essa URL exata e reinicie o serviço.
4. Abra `public/config.js` no editor e altere para:

```js
window.ILIACORD_API = 'https://URL-DO-SEU-SERVIDOR';
```

5. Envie novamente a pasta `public` no Netlify. A URL do servidor é pública; nunca coloque senha, chave privada ou credenciais TURN nesse arquivo.
6. Abra o site, crie duas contas em navegadores diferentes, envie um pedido e aceite com a segunda conta.
7. Crie um servidor, copie o código de convite pelo botão + ao lado do nome e entre com a outra conta.

Alternativa: conecte o repositório ao Netlify; o arquivo `netlify.toml` já aponta para `public`. Não é necessário build da interface. Para hospedar tudo pelo servidor Node, deixe `ILIACORD_API` vazio e use a URL HTTPS do próprio servidor.

## 4. Chamadas em redes diferentes: TURN

Há STUN configurado para conexão direta. Algumas redes bloqueiam conexões diretas, então configure um serviço TURN no servidor para chamadas confiáveis entre redes diferentes:

```text
TURN_URL=turns:seu-servidor-turn:5349
TURN_USERNAME=usuario-do-servico
TURN_PASSWORD=senha-do-servico
```

Use valores reais de um serviço TURN ou instalação coturn. Não foi provisionado um serviço TURN neste projeto. Essas credenciais são disponibilizadas somente a usuários autenticados para o navegador estabelecer chamadas. Use uma conta limitada, rotacione as credenciais e acompanhe o consumo; para uso público amplo, migre para credenciais TURN temporárias.

## 5. Instalar no PC e no celular

Após publicar em HTTPS, abra o site e toque no ícone de download no canto inferior esquerdo.

- **PC, Chrome ou Edge:** escolha instalar o site como aplicativo no menu ou na barra de endereço.
- **Android, Chrome:** menu ⋮ → Adicionar à tela inicial → Instalar (os nomes podem variar).
- **iPhone, Safari:** Compartilhar → Adicionar à Tela de Início.

Isso cria um aplicativo do site, com ícone e janela própria. Não inclui um instalador `.exe`, um `.apk` ou distribuição pela App Store. A instalação mantém as limitações do navegador. Conversas e chamadas exigem internet e o servidor online.

Guia oficial de instalação de PWA: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable

## 6. Captura de tela no celular

O site usa `getDisplayMedia` quando disponível. No PC, o navegador pede que a pessoa escolha a tela, janela ou aba. Em navegadores móveis sem suporte, o site informa a limitação; ainda é possível assistir ao compartilhamento de outra pessoa.

Para transmitir a tela inteira de Android/iPhone seria necessário desenvolver e testar aplicativos nativos: MediaProjection no Android e ReplayKit/Broadcast Extension no iOS, integrados ao WebRTC e ao servidor de sinalização. Um simples APK que abre o site não resolve essa parte. Esses aplicativos nativos não foram implementados.

Referência: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia

## Validação e limites desta versão

Testes locais aprovados para cadastro/login, nomes duplicados, amizade, convites, autorização de canais, persistência de mensagens, reações, exclusão restrita ao autor, perfil, logout e sinalização de chamadas entre clientes Socket.IO. Interface inspecionada no navegador.

Transmissão real de áudio/vídeo entre dois dispositivos, instalação em aparelhos físicos e chamadas atravessando redes móveis não foram verificadas neste ambiente. Faça esse teste após a publicação e a configuração TURN.

Sem recuperação de senha nesta versão: guarde a senha. Não inclui cargos avançados, moderação completa, banimento, notificações push, upload de arquivos gerais, catálogo externo de GIFs, figurinhas personalizadas, áudio do sistema ou infraestrutura para grandes comunidades. As mensagens de texto ficam no banco do servidor e não têm criptografia ponta a ponta.

O Plus é gratuito dentro do aplicativo; a hospedagem, disco e tráfego TURN podem ter custos cobrados pelos respectivos provedores.
