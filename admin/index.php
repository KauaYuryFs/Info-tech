<?php

declare(strict_types=1);

require_once __DIR__ . "/../api/auth_common.php";

authStartSession();
$userId = $_SESSION["user_id"] ?? null;
if (!is_int($userId)) {
    header("Location: ../login.html");
    exit;
}

require_once __DIR__ . "/../api/conexao.php";

try {
    $query = $conexao->prepare("SELECT papel FROM usuarios WHERE id = :id LIMIT 1");
    $query->execute(["id" => $userId]);
    $role = $query->fetchColumn();
} catch (PDOException $error) {
    error_log("Admin page authorization check failed: " . $error->getMessage());
    http_response_code($error->getCode() === "42S22" ? 503 : 500);
    $setupMessage = $error->getCode() === "42S22"
        ? "O painel precisa do campo papel na tabela usuarios. Execute a migração SQL indicada no README e promova manualmente uma conta."
        : "Não foi possível verificar as permissões agora.";
    ?><!doctype html>
    <html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Painel indisponível | Info Tech</title>
    <body style="font:16px Arial,sans-serif;max-width:680px;margin:12vh auto;padding:24px;color:#172554">
      <h1>Painel administrativo indisponível</h1><p><?= htmlspecialchars($setupMessage, ENT_QUOTES, "UTF-8") ?></p>
      <a href="../index.html">Voltar à loja</a>
    </body></html><?php
    exit;
}

if ($role !== "admin") {
    http_response_code(403);
    ?><!doctype html>
    <html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Acesso restrito | Info Tech</title>
    <body style="font:16px Arial,sans-serif;max-width:680px;margin:12vh auto;padding:24px;color:#172554">
      <h1>Acesso restrito</h1><p>Sua conta não tem permissão para acessar o painel administrativo.</p>
      <a href="../index.html">Voltar à loja</a>
    </body></html><?php
    exit;
}

$adminName = (string) ($_SESSION["user_name"] ?? "Administrador");
$csrfToken = (string) $_SESSION["csrf_token"];
?><!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#172554">
  <meta name="csrf-token" content="<?= htmlspecialchars($csrfToken, ENT_QUOTES, "UTF-8") ?>">
  <title>Painel administrativo | Info Tech</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="admin.css">
  <script src="admin.js" defer></script>
</head>
<body>
  <div class="admin-shell">
    <aside class="sidebar">
      <a class="admin-brand" href="../index.html" aria-label="Info Tech, voltar à loja">
        <span class="brand-mark">i<span>t</span></span><span>INFO<strong>TECH</strong></span>
      </a>
      <span class="side-label">GERENCIAMENTO</span>
      <nav class="side-nav" aria-label="Menu administrativo">
        <button class="nav-item is-active" type="button" data-view="dashboard"><span>▦</span>Dashboard</button>
        <button class="nav-item" type="button" data-view="products"><span>▤</span>Produtos</button>
        <button class="nav-item" type="button" data-view="categories"><span>◇</span>Categorias</button>
        <button class="nav-item" type="button" data-view="orders"><span>▧</span>Pedidos</button>
      </nav>
      <div class="sidebar-bottom">
        <a class="store-link" href="../index.html"><span>↗</span>Voltar à loja</a>
        <button class="nav-item logout-button" type="button" data-logout><span>↪</span>Sair</button>
      </div>
    </aside>

    <main class="admin-main">
      <header class="topbar">
        <button class="mobile-menu" type="button" aria-label="Abrir menu" aria-expanded="false">☰</button>
        <div><span class="eyebrow">CENTRAL DE CONTROLE</span><h1 id="page-title">Dashboard</h1></div>
        <div class="admin-profile"><span class="profile-avatar"><?= htmlspecialchars(strtoupper(substr($adminName, 0, 1)), ENT_QUOTES, "UTF-8") ?></span><span><small>Administrador</small><strong><?= htmlspecialchars($adminName, ENT_QUOTES, "UTF-8") ?></strong></span></div>
      </header>

      <div class="page-content">
        <div class="notice" id="notice" role="status" aria-live="polite" hidden></div>
        <section class="view-section is-visible" data-section="dashboard">
          <div class="welcome-row"><div><h2>Visão geral</h2><p>Acompanhe os principais números da sua loja.</p></div><button class="primary-button" type="button" data-add-product><span>＋</span>Adicionar produto</button></div>
          <div class="stat-grid">
            <article class="stat-card"><span class="stat-icon blue">▤</span><div><span>Total de produtos</span><strong id="stat-products">—</strong><small>Itens no catálogo</small></div></article>
            <article class="stat-card"><span class="stat-icon amber">⌁</span><div><span>Estoque baixo</span><strong id="stat-low-stock">—</strong><small>Até 5 unidades</small></div></article>
            <article class="stat-card"><span class="stat-icon violet">◇</span><div><span>Categorias</span><strong id="stat-categories">—</strong><small>Categorias cadastradas</small></div></article>
          </div>
          <div class="query-grid">
            <article class="query-card"><span>Valor total do estoque <b>SUM</b></span><strong id="stat-stock-value">—</strong><small>Soma de preço × quantidade</small></article>
            <article class="query-card"><span>Preço médio <b>AVG</b></span><strong id="stat-average">—</strong><small>Média de preço dos produtos</small></article>
          </div>
          <div class="table-card">
            <div class="table-heading"><div><h2>Produtos recentes</h2><p>Catálogo atualizado do banco de dados.</p></div><button class="text-button" type="button" data-view="products">Ver todos <span>→</span></button></div>
            <div class="table-scroll"><table><thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Ações</th></tr></thead><tbody id="dashboard-products"></tbody></table></div>
          </div>
        </section>

        <section class="view-section" data-section="products" hidden>
          <div class="welcome-row"><div><h2>Produtos</h2><p>Gerencie o catálogo da loja.</p></div><button class="primary-button" type="button" data-add-product><span>＋</span>Adicionar produto</button></div>
          <div class="table-card">
            <div class="table-heading product-tools"><div><h2>Todos os produtos</h2><p id="products-count">Carregando produtos...</p></div><label class="table-search"><span>⌕</span><input id="product-search" type="search" placeholder="Buscar produto..." aria-label="Buscar produto"></label></div>
            <div class="table-scroll"><table><thead><tr><th>ID</th><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Ações</th></tr></thead><tbody id="products-table"></tbody></table></div>
            <p class="table-empty" id="products-empty" hidden>Nenhum produto encontrado.</p>
          </div>
        </section>

        <section class="view-section" data-section="categories" hidden>
          <div class="welcome-row"><div><h2>Categorias</h2><p>Organize os produtos por departamento.</p></div></div>
          <div class="category-layout">
            <form class="category-form" id="category-form">
              <span class="form-eyebrow">NOVA CATEGORIA</span><h2>Adicionar categoria</h2>
              <label for="category-name">Nome da categoria</label><input id="category-name" name="nome" type="text" maxlength="100" required placeholder="Ex.: Periféricos">
              <button class="primary-button" type="submit">Adicionar categoria <span>→</span></button>
            </form>
            <div class="table-card category-card"><div class="table-heading"><div><h2>Categorias cadastradas</h2><p>Produtos vinculados precisam ser reatribuídos antes da exclusão.</p></div></div><div class="category-list" id="categories-list"></div></div>
          </div>
        </section>

        <section class="view-section" data-section="orders" hidden>
          <div class="welcome-row"><div><h2>Pedidos</h2><p>Pedidos simulados registrados pelos clientes.</p></div></div>
          <div class="table-card">
            <div class="table-heading"><div><h2>Todos os pedidos</h2><p id="orders-count">Carregando pedidos...</p></div></div>
            <div class="table-scroll"><table><thead><tr><th>Pedido</th><th>Data</th><th>Cliente</th><th>Produtos e quantidades</th><th>Total</th><th>Status</th></tr></thead><tbody id="orders-table"></tbody></table></div>
            <p class="table-empty" id="orders-empty" hidden>Nenhum pedido realizado ainda.</p>
          </div>
        </section>
      </div>
    </main>
  </div>

  <dialog class="product-dialog" id="product-dialog">
    <form class="product-form" id="product-form">
      <div class="dialog-heading"><div><span class="form-eyebrow">CATÁLOGO DA LOJA</span><h2 id="product-dialog-title">Adicionar produto</h2></div><button class="icon-button" type="button" data-close-dialog aria-label="Fechar">×</button></div>
      <input type="hidden" name="id">
      <label for="product-name">Nome do produto</label><input id="product-name" name="nome" type="text" maxlength="150" required>
      <label for="product-description">Descrição</label><textarea id="product-description" name="descricao" rows="3" maxlength="5000"></textarea>
      <div class="field-row"><div><label for="product-price">Preço (R$)</label><input id="product-price" name="preco" type="number" min="0" max="99999999.99" step="0.01" required></div><div><label for="product-stock">Estoque</label><input id="product-stock" name="estoque" type="number" min="0" max="2147483647" step="1" required></div></div>
      <label for="product-category">Categoria</label><select id="product-category" name="categoria_id" required><option value="">Selecione uma categoria</option></select>
      <label for="product-image">Imagem (URL HTTP/HTTPS ou caminho local)</label><input id="product-image" name="imagem" type="text" maxlength="255" placeholder="assets/img/produtos/produto.jpg">
      <div class="dialog-actions"><button class="secondary-button" type="button" data-close-dialog>Cancelar</button><button class="primary-button" type="submit">Salvar produto <span>→</span></button></div>
    </form>
  </dialog>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
</body>
</html>
