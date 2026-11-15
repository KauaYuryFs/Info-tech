
<?php

require_once __DIR__ . "/conexao.php";

$consulta = $conexao->query(
    "SELECT COUNT(*) FROM produtos"
);

$total = $consulta->fetchColumn();

echo "Conexao realizada com sucesso!";
echo "<br>";
echo "Produtos cadastrados: " . $total;
