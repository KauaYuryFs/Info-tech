
<?php

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");

require_once __DIR__ . "/conexao.php";

try {
    $sql = "SELECT
                p.id,
                p.nome,
                p.descricao,
                p.preco,
                p.estoque,
                p.imagem,
                c.nome AS categoria
            FROM produtos p
            LEFT JOIN categorias c
                ON p.categoria_id = c.id
            ORDER BY p.id DESC";

    $consulta = $conexao->query($sql);

    $produtos = $consulta->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(
        $produtos,
        JSON_UNESCAPED_UNICODE
    );

} catch (PDOException $erro) {
    error_log($erro->getMessage());
    http_response_code(500);

    echo json_encode([
        "erro" => "Nao foi possivel carregar os produtos."
    ]);
}
