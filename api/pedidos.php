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
        "message" => "Entre na sua conta para acessar seus pedidos."
    ]);
}

if ($method === "POST") {
    authVerifyCsrf();
}

require_once __DIR__ . "/conexao.php";

try {
    if ($method === "GET") {
        header("Cache-Control: no-store");
        $ordersQuery = $conexao->prepare(
            "SELECT o.id, o.data_pedido, o.status,
                    COALESCE(SUM(i.preco_unitario * i.quantidade), 0) AS total
             FROM pedidos o
             LEFT JOIN itens_pedido i ON i.pedido_id = o.id
             WHERE o.usuario_id = :usuario_id
             GROUP BY o.id, o.data_pedido, o.status
             ORDER BY o.data_pedido DESC, o.id DESC"
        );
        $ordersQuery->execute(["usuario_id" => $userId]);
        $orders = $ordersQuery->fetchAll();

        $itemsQuery = $conexao->prepare(
            "SELECT o.id AS pedido_id, i.produto_id, p.nome, p.imagem,
                    i.quantidade, i.preco_unitario
             FROM pedidos o
             INNER JOIN itens_pedido i ON i.pedido_id = o.id
             INNER JOIN produtos p ON p.id = i.produto_id
             WHERE o.usuario_id = :usuario_id
             ORDER BY o.id DESC, i.id ASC"
        );
        $itemsQuery->execute(["usuario_id" => $userId]);
        $itemsByOrder = [];
        foreach ($itemsQuery->fetchAll() as $item) {
            $itemsByOrder[(int) $item["pedido_id"]][] = [
                "productId" => (int) $item["produto_id"],
                "name" => (string) $item["nome"],
                "image" => $item["imagem"],
                "quantity" => (int) $item["quantidade"],
                "unitPrice" => (string) $item["preco_unitario"]
            ];
        }

        foreach ($orders as &$order) {
            $order["id"] = (int) $order["id"];
            $order["total"] = (string) $order["total"];
            $order["items"] = $itemsByOrder[$order["id"]] ?? [];
        }
        unset($order);

        authJsonResponse(200, ["success" => true, "orders" => $orders]);
    }

    $itemsJson = authInputString("items");
    try {
        $submittedItems = json_decode($itemsJson, true, 16, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        authJsonResponse(422, [
            "success" => false,
            "message" => "O carrinho não contém uma lista de produtos válida."
        ]);
    }

    if (!is_array($submittedItems) || $submittedItems === [] || count($submittedItems) > 50) {
        authJsonResponse(422, [
            "success" => false,
            "message" => "Adicione de 1 a 50 produtos diferentes para finalizar o pedido."
        ]);
    }

    $quantities = [];
    foreach ($submittedItems as $item) {
        if (!is_array($item)
            || !isset($item["productId"], $item["quantity"])
            || !is_int($item["productId"])
            || !is_int($item["quantity"])
            || $item["productId"] < 1
            || $item["quantity"] < 1
            || $item["quantity"] > 2147483647) {
            authJsonResponse(422, [
                "success" => false,
                "message" => "Um dos produtos ou quantidades do carrinho é inválido."
            ]);
        }

        $productId = $item["productId"];
        $quantities[$productId] = ($quantities[$productId] ?? 0) + $item["quantity"];
        if ($quantities[$productId] > 2147483647) {
            authJsonResponse(422, [
                "success" => false,
                "message" => "A quantidade de um produto está fora do limite permitido."
            ]);
        }
    }

    ksort($quantities, SORT_NUMERIC);
    $conexao->beginTransaction();

    $productQuery = $conexao->prepare(
        "SELECT id, nome, preco, estoque
         FROM produtos
         WHERE id = :id
         FOR UPDATE"
    );
    $updateStock = $conexao->prepare(
        "UPDATE produtos
         SET estoque = estoque - :quantidade
         WHERE id = :id AND estoque >= :estoque_minimo"
    );
    $insertOrder = $conexao->prepare(
        "INSERT INTO pedidos (usuario_id) VALUES (:usuario_id)"
    );
    $insertItem = $conexao->prepare(
        "INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario)
         VALUES (:pedido_id, :produto_id, :quantidade, :preco_unitario)"
    );

    $lockedProducts = [];
    foreach ($quantities as $productId => $quantity) {
        $productQuery->execute(["id" => $productId]);
        $product = $productQuery->fetch();
        if (!$product) {
            $conexao->rollBack();
            authJsonResponse(409, [
                "success" => false,
                "message" => "Um produto do carrinho não está mais disponível. Atualize o carrinho."
            ]);
        }
        if ((int) $product["estoque"] < $quantity) {
            $conexao->rollBack();
            authJsonResponse(409, [
                "success" => false,
                "message" => "Estoque insuficiente para “" . (string) $product["nome"] . "”. Atualize a quantidade no carrinho."
            ]);
        }
        $lockedProducts[$productId] = $product;
    }

    $insertOrder->execute(["usuario_id" => $userId]);
    $orderId = (int) $conexao->lastInsertId();

    foreach ($quantities as $productId => $quantity) {
        $product = $lockedProducts[$productId];
        $updateStock->execute([
            "quantidade" => $quantity,
            "id" => $productId,
            "estoque_minimo" => $quantity
        ]);
        if ($updateStock->rowCount() !== 1) {
            $conexao->rollBack();
            authJsonResponse(409, [
                "success" => false,
                "message" => "O estoque mudou enquanto o pedido era processado. Atualize o carrinho."
            ]);
        }
        $insertItem->execute([
            "pedido_id" => $orderId,
            "produto_id" => $productId,
            "quantidade" => $quantity,
            "preco_unitario" => $product["preco"]
        ]);
    }

    $totalQuery = $conexao->prepare(
        "SELECT COALESCE(SUM(preco_unitario * quantidade), 0)
         FROM itens_pedido
         WHERE pedido_id = :pedido_id"
    );
    $totalQuery->execute(["pedido_id" => $orderId]);
    $total = (string) $totalQuery->fetchColumn();

    $conexao->commit();
    authJsonResponse(201, [
        "success" => true,
        "message" => "Pedido realizado com sucesso. Nenhum pagamento foi efetuado.",
        "order" => [
            "id" => $orderId,
            "total" => $total,
            "status" => "pendente"
        ]
    ]);
} catch (PDOException $error) {
    if ($conexao->inTransaction()) {
        $conexao->rollBack();
    }
    error_log("Order request failed: " . $error->getMessage());
    if ($error->getCode() === "23000") {
        authJsonResponse(409, [
            "success" => false,
            "message" => "Não foi possível registrar um produto do pedido. Atualize o carrinho e tente novamente."
        ]);
    }
    authJsonResponse(500, [
        "success" => false,
        "message" => "Não foi possível processar o pedido agora. Nenhuma cobrança foi realizada."
    ]);
}
