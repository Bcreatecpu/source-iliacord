# Turso + Render Free

Código adaptado e testado localmente. A conexão remota aguarda sua conta Turso.

1. Crie um banco SQLite/libSQL no plano Free em https://app.turso.tech.
2. No Render > Environment, configure TURSO_DATABASE_URL (URL do banco), TURSO_AUTH_TOKEN (token de leitura/escrita), REQUIRE_REMOTE_DB=true, TRUST_PROXY=1 e NODE_VERSION=24.15.0.
3. Nunca publique o token no GitHub, no chat ou em public/config.js.
4. Antes do deploy: se já existem contas ou mensagens no site, preserve o banco SQLite atual. O banco novo começa vazio; esta mudança não copia os dados automaticamente. Não atualize antes de resolver essa exportação. O banco local no PC é independente do Render.
5. Depois de preservar os dados, envie ao GitHub server.js, database.js, package.json, package-lock.json e render.yaml deste pacote.
6. Faça deploy e teste cadastro/login. Confira a conta no Turso e reinicie o serviço para validar persistência real.

Enviar render.yaml não configura sozinho as variáveis de um serviço já existente. Use o painel Environment. Não é necessário disco pago. O banco remoto é obrigatório com REQUIRE_REMOTE_DB=true; falhas não causam troca silenciosa para disco temporário.

Os testes locais de contas, amizades, mensagens, perfil, permissões e sinalização passaram. Turso real ainda não foi testado. Render Free ainda suspende por inatividade e tem limites; TURN continua separado.

https://docs.turso.tech/sdk/ts/quickstart
https://render.com/docs/free
