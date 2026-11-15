# INFO TECH

Marketplace INFO TECH em HTML, CSS, JavaScript, PHP e MySQL. As páginas devem ser servidas pelo Apache do XAMPP em `http://localhost/infotech/`; não abra os arquivos HTML diretamente.

## Páginas

- `index.html` — vitrine da loja, busca e categorias.
- `carrinho.html` — carrinho de compras com quantidades e resumo.
- `pedidos.html` — histórico de pedidos do usuário autenticado.
- `login.html` — acesso com sessão PHP.
- `cadastro.html` — criação de conta.
- `admin/` — painel administrativo para produtos e categorias (requer uma conta promovida manualmente).

## Estrutura

- `assets/css/styles.css` — identidade visual e layouts responsivos compartilhados.
- `assets/js/app.js` — integração das telas, catálogo, sessão e interações de interface.
- O carrinho de demonstração é persistido no LocalStorage do navegador usando a chave `infotech-cart`.
- `api/produtos.php` — catálogo carregado do banco de dados.
- `api/cadastro.php`, `api/login.php`, `api/logout.php` e `api/sessao.php` — cadastro, autenticação, encerramento e consulta da sessão.
- `api/admin.php` — dashboard e operações administrativas; cada requisição consulta o papel atual do usuário no banco e as operações POST exigem CSRF.
- `api/pedidos.php` — criação transacional de pedidos e histórico privado do cliente.
- `api/auth_common.php` — configuração segura do cookie de sessão e validação CSRF. As requisições POST de autenticação exigem o cabeçalho `X-CSRF-Token` obtido de `api/sessao.php`.

O acesso usa as credenciais configuradas exclusivamente no arquivo PHP de conexão. As senhas são armazenadas com `password_hash()`. A sessão mantém apenas o ID e o nome do usuário, além do token CSRF. O cookie é `HttpOnly`, `SameSite=Lax` e recebe a flag `Secure` quando o site é servido por HTTPS.

As fotografias dos produtos ficam em `assets/img/produtos/`; consulte `assets/img/produtos/CREDITS.txt` para fontes e licenças. Os pedidos são simulações sem pagamento: o servidor consulta os preços e estoques atuais, registra os preços unitários nos itens e decrementa o estoque dentro da mesma transação. Não são solicitados dados de cartão.

O histórico usa `pedidos.data_pedido`, `pedidos.status`, `itens_pedido.quantidade` e `itens_pedido.preco_unitario`, além dos relacionamentos existentes com usuários e produtos. O total é calculado a partir dos itens registrados; nenhuma coluna ou tabela nova é necessária. Produtos ligados a itens de pedidos não podem ser excluídos.

## Preparar acesso administrativo

O painel requer a coluna `usuarios.papel`. A migração abaixo **não é executada automaticamente**: no MySQL Workbench, conecte ao servidor, abra uma aba SQL, selecione o schema `infotech` e execute:

```sql
USE infotech;

ALTER TABLE usuarios
  ADD COLUMN papel ENUM('cliente', 'admin') NOT NULL DEFAULT 'cliente';
```

Todas as contas existentes recebem o papel `cliente`; o cadastro público também não pode escolher esse campo. Para promover uma conta existente, substitua o e-mail pelo endereço exato da sua conta de teste e execute separadamente:

```sql
UPDATE usuarios
SET papel = 'admin'
WHERE email = 'SEU_EMAIL_DE_TESTE'
  AND papel = 'cliente';

SELECT id, nome, email, papel
FROM usuarios
WHERE email = 'SEU_EMAIL_DE_TESTE';
```

Confirme no resultado que apenas a conta desejada recebeu `admin`. Depois, entre com essa conta e acesse `http://localhost/infotech/admin/`. A autorização é conferida no banco tanto ao abrir o painel quanto em todas as chamadas da API; alterações de produtos/categorias também exigem CSRF. A seção Pedidos lista os clientes, produtos, quantidades, totais e status. Produtos ligados a itens de pedidos e categorias ligadas a produtos não podem ser excluídos. O dashboard apresenta a consulta de produtos com `JOIN`, contagem `COUNT`, valor de estoque `SUM(preco * estoque)` e preço médio `AVG(preco)`.

O fluxo de pedidos não requer migração no MySQL: ele usa as tabelas `pedidos` e `itens_pedido` existentes. Para consultar os pedidos no painel, a coluna `usuarios.papel` precisa ter sido adicionada e a conta administrativa precisa ter sido promovida conforme as instruções acima.
