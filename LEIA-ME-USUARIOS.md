# EcoFila com contas de usuário

Esta é uma cópia independente. O projeto original não foi modificado.

## Perfis implementados

- Cidadão: cadastro, login, denúncias vinculadas à conta, consulta e cancelamento das próprias denúncias ainda não concluídas.
- Operador: acesso ao atendimento, leitura das denúncias e atualização para Em Análise, Em Atendimento e Resolvido, com observação obrigatória e histórico registrado no banco.
- Administrador: todas as ações do operador e gerenciamento dos perfis das contas cadastradas. Não pode alterar o próprio perfil.
- Visitante: consulta pública de mapa, estatísticas e protocolos. Para denunciar, precisa entrar.

Não há conta ou senha pública padrão. Cadastros públicos sempre recebem o perfil cidadão. Senhas são armazenadas com scrypt e salt; sessões usam cookies HttpOnly com validade de um dia. Permissões são verificadas no servidor.

## Rodar uma cópia separada

1. Crie um banco separado importando `schema.sql` no Workbench. O nome padrão desta cópia é `ecofila_usuarios`.
2. Copie `.env.example` para `.env` e configure a conexão MySQL.
3. Configure `ADMIN_EMAIL` e `ADMIN_PASSWORD` (pelo menos 10 caracteres) para criar o primeiro administrador na inicialização. Não publique o `.env`.
4. Na pasta desta cópia, execute `npm install` e `npm start`.
5. Abra `http://localhost:3000`. Use o servidor; não abra o HTML diretamente. Frontend e API devem ser publicados juntos na mesma origem para esta versão.
6. Entre com o administrador. Cadastre uma segunda conta pela tela e altere seu perfil para Operador em Atendimento → Usuários e permissões.

As tabelas de contas, sessões, autoria e histórico são criadas automaticamente ao iniciar. Se configurar um banco já existente, os dados dele serão utilizados; mantenha um banco separado para testes. Denúncias antigas e exemplos não são associados automaticamente a contas.

## Render

Publique esta pasta como um serviço separado para preservar o site atual. Build: `npm install`; Start: `npm start`. Configure as variáveis de conexão com um banco de testes separado, `HOST=0.0.0.0`, `NODE_ENV=production`, `ADMIN_EMAIL` e `ADMIN_PASSWORD`. Acesse o endereço HTTPS do novo serviço. Não é necessário apontar o frontend para a API antiga.

Após criar o primeiro administrador, remova ADMIN_PASSWORD da configuração do serviço. Ela serve somente para criar uma conta que ainda não existe; não redefine a senha de contas existentes.

## Verificação para a apresentação

1. Cadastre cidadãos A e B em navegadores ou perfis diferentes. Envie uma denúncia com A. B não deve vê-la em Minhas denúncias nem conseguir cancelá-la.
2. Entre como operador e registre um atendimento. O cidadão deve visualizar a situação atual ao abrir Minhas denúncias.
3. Cancele uma denúncia de A ainda aberta. O protocolo deve permanecer com situação Cancelado. Denúncias resolvidas não podem ser canceladas nem reabertas por esta interface.
4. Entre como administrador e altere o perfil de B. Cidadãos não podem acessar a administração, inclusive diretamente pela API.

## Limites desta versão de protótipo

Recuperação de senha, confirmação de e-mail, gestão de equipes e rotas, anexos da solução e notificações não foram implementados. O rastreamento de caminhões e os gráficos demonstrativos existentes permanecem como no projeto original. Esta entrega não foi publicada no Render.
