<?php

$host = "localhost";
$porta = 3306;
$banco = "infotech";
$usuario = "infotech_app";
$senha = "furtado2004";

try {
    $conexao = new PDO(
        "mysql:host=$host;port=$porta;dbname=$banco;charset=utf8mb4",
        $usuario,
        $senha,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );

} catch (PDOException $erro) {
    error_log($erro->getMessage());
    http_response_code(500);
    exit("Erro ao conectar ao banco de dados.");
}