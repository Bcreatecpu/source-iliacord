# Atualização completa do IliaCord

## Colocar no GitHub

1. Extraia o ZIP no computador.
2. Abra **Bcreatecpu/source-iliacord**, o repositório conectado ao seu Render.
3. Em **Add file → Upload files**, arraste os arquivos desta pasta **e a pasta public inteira**. Não envie o ZIP nem crie outra pasta envolvendo o projeto.
4. Confirme em **Commit changes**. O Render fará o deploy automaticamente. Se necessário, use **Manual Deploy → Deploy latest commit**.
5. Aguarde **Live**. Abra seu IliaCord e pressione **Ctrl+Shift+R** uma vez.

A raiz deve conter `server.js`, `database.js`, `invites.js`, **`plus.js`**, **`media.js`**, `package.json`, `package-lock.json` e **`public/`**. Dentro de `public/` ficam `index.html`, scripts, estilos e imagens. Preserve os nomes em inglês.

Mantenha no Render as variáveis TURSO_DATABASE_URL e TURSO_AUTH_TOKEN que já funcionam. Não coloque o token no GitHub. Esta atualização adiciona tabelas e campos automaticamente, sem apagar contas ou mensagens. Não é necessário recriar o banco.

Build: `npm ci --omit=dev`. Start: `npm start`.

## O que mudou

- Logo no app, botão inicial, favicon e ícones de instalação.
- Foto do servidor atualizada também na barra lateral.
- Imagens, prints por Ctrl+V, arrastar arquivos, vídeos e áudio. Botão de microfone com prévia antes de anexar.
- Links HTTP/HTTPS clicáveis, com cartões para Medal, YouTube e outros sites. Links diretos de imagens/GIFs aparecem na conversa. O cartão abre o serviço externo; não transforma todos os sites em players internos.
- Sem pausa fixa entre mensagens. Exibição imediata de envio pendente e menos consultas para carregar o histórico. A confirmação ainda depende da internet e do banco.
- Ilia Plus gratuito: **12 combos e 25 itens**, confirmação de aquisição, inventário, equipamentos independentes, asas animadas, órbitas e cristal em CSS 3D, efeitos de perfil e placas de nome.
- Banner de foto/GIF, duas cores e ângulo do degradê, visíveis no perfil para outras pessoas.
- Notificações: avatar abaixo do logo, contador, cartão lateral com nome e mensagem, som e clique para abrir a conversa. O sino permite ajustar som e ativar avisos do navegador.

## Limites desta versão

- Até 4 anexos de 12 MB por mensagem; 200 MB de anexos brutos no aplicativo inteiro. Apagar suas mensagens com anexos libera esse espaço. Vídeos grandes podem ser enviados por link.
- Banner GIF até 1 MB; GIF de avatar/servidor até 500 KB. Fotos são reduzidas automaticamente.
- Vídeo e áudio dependem dos formatos aceitos pelo navegador. Gravar exige microfone e permissão.
- Notificações chegam enquanto o app/site estiver aberto. Ainda não existe push para o aplicativo completamente fechado. Sons dependem da política de reprodução do navegador.
- Os efeitos 3D são animações CSS com perspectiva; respeitam a preferência de movimento reduzido do dispositivo.
- O ícone de um app já instalado pode exigir reinstalação para atualizar, dependendo do sistema.

## Validação feita

Testes locais de conta, amizade, permissões, canais, mensagens, anexos privados, exclusão, inventário, decoração visível para outro usuário, ícone de servidor e notificações. Conferência no navegador da loja, aquisição/equipamento, link Medal, upload/exibição de imagem e abertura de conversa pela notificação. Microfone físico e notificações de sistema no seu aparelho ainda precisam ser conferidos por você.

Os arquivos estão prontos para upload; este pacote não publica sozinho no GitHub ou Render.
