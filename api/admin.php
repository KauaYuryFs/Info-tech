<?php

declare(strict_types=1);

require_once __DIR__ . "/auth_common.php";

authStartSession();
$method = $_SERVER["REQUEST_METHOD"] ?? "";
if ($method !== "GET" && $method !== "POST") {
    header("Allow: GET, POST");
    authJsonResponse(405, [
        "success" => false,
        "message" => "Método de requisição não permitido."
    ]);
}

$userId = $_SESSION["user_id"] ?? null;
if (!is_int($userId)) {
    authJsonResponse(401, [
        "success" => false,
        "message" => "Entre na sua conta para continuar."
    ]);
}

require_once __DIR__ . "/conexao.php";

try {
    $roleQuery = $conexao->prepare("SELECT papel FROM usuarios WHERE id = :id LIMIT 1");
    $roleQuery->execute(["id" => $userId]);
    $role = $roleQuery->fetchColumn();

    if ($role !== "admin") {
        authJsonResponse(403, [
            "success" => false,
            "message" => "Você não tem permissão para acessar o painel administrativo."
        ]);
    }

    if ($method === "GET") {
        header("Cache-Control: no-store");
        if (($_GET["view"] ?? "") === "orders") {
            $ordersQuery = $conexao->query(
                "SELECT o.id, o.usuario_id, u.nome AS cliente, u.email,
                        o.data_pedido, o.status,
                        COALESCE(SUM(i.preco_unitario * i.quantidade), 0) AS total
                 FROM pedidos o
                 INNER JOIN usuarios u ON u.id = o.usuario_id
                 LEFT JOIN itens_pedido i ON i.pedido_id = o.id
                 GROUP BY o.id, o.usuario_id, u.nome, u.email, o.data_pedido, o.status
                 ORDER BY o.data_pedido DESC, o.id DESC"
            );
            $orders = $ordersQuery->fetchAll();
            $itemsQuery = $conexao->query(
                "SELECT i.pedido_id, i.produto_id, p.nome, i.quantidade, i.preco_unitario
                 FROM itens_pedido i
                 INNER JOIN produtos p ON p.id = i.produto_id
                 ORDER BY i.pedido_id DESC, i.id ASC"
            );
            $itemsByOrder = [];
            foreach ($itemsQuery->fetchAll() as $item) {
                $itemsByOrder[(int) $item["pedido_id"]][] = [
                    "productId" => (int) $item["produto_id"],
                    "name" => (string) $item["nome"],
                    "quantity" => (int) $item["quantidade"],
                    "unitPrice" => (string) $item["preco_unitario"]
                ];
            }
            foreach ($orders as &$order) {
                $order["id"] = (int) $order["id"];
                $order["userId"] = (int) $order["usuario_id"];
                unset($order["usuario_id"]);
                $order["total"] = (string) $order["total"];
                $order["items"] = $itemsByOrder[$order["id"]] ?? [];
            }
            unset($order);
            authJsonResponse(200, ["success" => true, "orders" => $orders]);
        }

        $products = $conexao->query(
            "SELECT p.id, p.nome, p.descricao, p.preco, p.estoque, p.imagem,
                    p.categoria_id, c.nome AS categoria
             FROM produtos p
             LEFT JOIN categorias c ON c.id = p.categoria_id
             ORDER BY p.id DESC"
        )->fetchAll();
        $categories = $conexao->query(
            "SELECT id, nome FROM categorias ORDER BY nome"
        )->fetchAll();
        $stats = $conexao->query(
            "SELECT COUNT(*) AS total_produtos,
                    COALESCE(SUM(CASE WHEN estoque <= 5 THEN 1 ELSE 0 END), 0) AS estoque_baixo,
                    COALESCE(SUM(preco * estoque), 0) AS valor_estoque,
                    COALESCE(AVG(preco), 0) AS preco_medio
             FROM produtos"
        )->fetch();
        $stats["total_categorias"] = count($categories);

        authJsonResponse(200, [
            "success" => true,
            "user" => [
                "id" => $userId,
                "name" => (string) ($_SESSION["user_name"] ?? "")
            ],
            "stats" => $stats,
            "products" => $products,
            "categories" => $categories
        ]);
    }

    authVerifyCsrf();
    $action = authInputString("action");

    if ($action === "produto_criar" || $action === "produto_editar") {
        $id = 0;
        if ($action === "produto_editar") {
            $id = filter_var(authInputString("id"), FILTER_VALIDATE_INT, [
                "options" => ["min_range" => 1]
            ]) ?: 0;
            if ($id === 0) {
                authJsonResponse(422, ["success" => false, "message" => "Produto inválido."]);
            }
        }

        $name = trim(authInputString("nome"));
        $description = trim(authInputString("descricao"));
        $price = trim(authInputString("preco"));
        $stockInput = trim(authInputString("estoque"));
        $categoryId = filter_var(authInputString("categoria_id"), FILTER_VALIDATE_INT, [
            "options" => ["min_range" => 1]
        ]) ?: 0;
        $image = trim(authInputString("imagem"));
        $nameLength = authStringLength($name);
        $descriptionLength = authStringLength($description);

        if ($nameLength < 2 || $nameLength > 150) {
            authJsonResponse(422, [
                "success" => false,
                "message" => "O nome deve ter entre 2 e 150 caracteres."
            ]);
        }
        if ($descriptionLength < 0 || $descriptionLength > 5000) {
            authJsonResponse(422, [
                "success" => false,
                "message" => "A descrição pode ter no máximo 5.000 caracteres."
            ]);
        }
        if (!preg_match('/^\d{1,8}(?:\.\d{1,2})?$/D', $price)) {
            authJsonResponse(422, [
                "success" => false,
                "message" => "Informe um preço válido, não negativo e com até duas casas decimais."
            ]);
        }
        if (!preg_match('/^\d{1,10}$/D', $stockInput)) {
            authJsonResponse(422, [
                "success" => false,
                "message" => "Informe uma quantidade de estoque inteira e não negativa."
            ]);
        }
        $stock = filter_var($stockInput, FILTER_VALIDATE_INT, [
            "options" => ["min_range" => 0, "max_range" => 2147483647]
        ]);
        if ($stock === false) {
            authJsonResponse(422, [
                "success" => false,
                "message" => "A quantidade de estoque está fora do limite permitido."
            ]);
        }
        if ($categoryId === 0) {
            authJsonResponse(422, ["success" => false, "message" => "Selecione uma categoria."]);
        }
        if (strlen($image) > 255) {
            authJsonResponse(422, [
                "success" => false,
                "message" => "O caminho da imagem pode ter no máximo 255 caracteres."
            ]);
        }
        if ($image !== "" && !adminValidImage($image)) {
            authJsonResponse(422, [
                "success" => false,
                "message" => "Use uma URL HTTP/HTTPS válida ou um caminho local dentro de assets/."
            ]);
        }

        $categoryQuery = $conexao->prepare("SELECT COUNT(*) FROM categorias WHERE id = :id");
        $categoryQuery->execute(["id" => $categoryId]);
        if ((int) $categoryQuery->fetchColumn() === 0) {
            authJsonResponse(422, [
                "success" => false,
                "message" => "A categoria selecionada não existe mais."
            ]);
        }

        $values = [
            "nome" => $name,
            "descricao" => $description === "" ? null : $description,
            "preco" => $price,
            "estoque" => $stock,
            "categoria_id" => $categoryId,
            "imagem" => $image === "" ? null : $image
        ];

        if ($action === "produto_criar") {
            $query = $conexao->prepare(
                "INSERT INTO produtos (nome, descricao, preco, estoque, categoria_id, imagem)
                 VALUES (:nome, :descricao, :preco, :estoque, :categoria_id, :imagem)"
            );
            $query->execute($values);
            authJsonResponse(201, [
                "success" => true,
                "message" => "Produto cadastrado com sucesso.",
                "id" => (int) $conexao->lastInsertId()
            ]);
        }

        $exists = $conexao->prepare("SELECT COUNT(*) FROM produtos WHERE id = :id");
        $exists->execute(["id" => $id]);
        if ((int) $exists->fetchColumn() === 0) {
            authJsonResponse(404, ["success" => false, "message" => "Produto não encontrado."]);
        }

        $values["id"] = $id;
        $query = $conexao->prepare(
            "UPDATE produtos
             SET nome = :nome, descricao = :descricao, preco = :preco,
                 estoque = :estoque, categoria_id = :categoria_id, imagem = :imagem
             WHERE id = :id"
        );
        $query->execute($values);
        authJsonResponse(200, ["success" => true, "message" => "Produto atualizado com sucesso."]);
    }

    if ($action === "produto_excluir") {
        $id = filter_var(authInputString("id"), FILTER_VALIDATE_INT, [
            "options" => ["min_range" => 1]
        ]) ?: 0;
        if ($id === 0) {
            authJsonResponse(422, ["success" => false, "message" => "Produto inválido."]);
        }
        $references = $conexao->prepare(
            "SELECT COUNT(*) FROM itens_pedido WHERE produto_id = :id"
        );
        $references->execute(["id" => $id]);
        if ((int) $references->fetchColumn() > 0) {
            authJsonResponse(409, [
                "success" => false,
                "message" => "Este produto está associado a pedidos e não pode ser excluído."
            ]);
        }
        $delete = $conexao->prepare("DELETE FROM produtos WHERE id = :id");
        $delete->execute(["id" => $id]);
        if ($delete->rowCount() === 0) {
            authJsonResponse(404, ["success" => false, "message" => "Produto não encontrado."]);
        }
        authJsonResponse(200, ["success" => true, "message" => "Produto excluído com sucesso."]);
    }

    if ($action === "categoria_criar") {
        $name = trim(authInputString("nome"));
        $nameLength = authStringLength($name);
        if ($nameLength < 2 || $nameLength > 100) {
            authJsonResponse(422, [
                "success" => false,
                "message" => "O nome da categoria deve ter entre 2 e 100 caracteres."
            ]);
        }
        $insert = $conexao->prepare("INSERT INTO categorias (nome) VALUES (:nome)");
        $insert->execute(["nome" => $name]);
        authJsonResponse(201, [
            "success" => true,
            "message" => "Categoria adicionada com sucesso."
        ]);
    }

    if ($action === "categoria_excluir") {
        $id = filter_var(authInputString("id"), FILTER_VALIDATE_INT, [
            "options" => ["min_range" => 1]
        ]) ?: 0;
        if ($id === 0) {
            authJsonResponse(422, ["success" => false, "message" => "Categoria inválida."]);
        }
        $references = $conexao->prepare(
            "SELECT COUNT(*) FROM produtos WHERE categoria_id = :id"
        );
        $references->execute(["id" => $id]);
        if ((int) $references->fetchColumn() > 0) {
            authJsonResponse(409, [
                "success" => false,
                "message" => "Esta categoria possui produtos. Reatribua-os antes de excluir."
            ]);
        }
        $delete = $conexao->prepare("DELETE FROM categorias WHERE id = :id");
        $delete->execute(["id" => $id]);
        if ($delete->rowCount() === 0) {
            authJsonResponse(404, ["success" => false, "message" => "Categoria não encontrada."]);
        }
        authJsonResponse(200, ["success" => true, "message" => "Categoria excluída com sucesso."]);
    }

    authJsonResponse(400, ["success" => false, "message" => "Ação administrativa inválida."]);
} catch (PDOException $error) {
    error_log("Administrative request failed: " . $error->getMessage());
    if ($error->getCode() === "42S22") {
        authJsonResponse(503, [
            "success" => false,
            "message" => "O banco ainda não possui o campo papel. Execute primeiro a migração SQL documentada no README."
        ]);
    }
    if ($error->getCode() === "23000") {
        authJsonResponse(409, [
            "success" => false,
            "message" => "Não foi possível concluir a operação porque há registros relacionados ou duplicados."
        ]);
    }
    authJsonResponse(500, [
        "success" => false,
        "message" => "Não foi possível concluir a operação agora."
    ]);
}

function adminValidImage(string $image): bool
{
    if (preg_match('/[\x00-\x20]/', $image) === 1 || str_contains($image, "\\")) {
        return false;
    }

    if (filter_var($image, FILTER_VALIDATE_URL) !== false) {
        $scheme = strtolower((string) parse_url($image, PHP_URL_SCHEME));
        return in_array($scheme, ["http", "https"], true);
    }

    return str_starts_with($image, "assets/")
        && !str_contains($image, "..")
        && !str_starts_with($image, "//");
}
