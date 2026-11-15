<?php

declare(strict_types=1);

require_once __DIR__ . "/auth_common.php";

authRequireMethod("GET");
authStartSession();

$userId = $_SESSION["user_id"] ?? null;
$userName = $_SESSION["user_name"] ?? null;
$authenticated = is_int($userId) && is_string($userName);
$isAdmin = false;

if ($authenticated) {
    require_once __DIR__ . "/conexao.php";

    try {
        $roleQuery = $conexao->prepare("SELECT papel FROM usuarios WHERE id = :id LIMIT 1");
        $roleQuery->execute(["id" => $userId]);
        $isAdmin = $roleQuery->fetchColumn() === "admin";
    } catch (PDOException $error) {
        error_log("Session role lookup failed: " . $error->getMessage());
        authJsonResponse(500, [
            "success" => false,
            "message" => "Não foi possível verificar sua sessão agora."
        ]);
    }
}

$response = [
    "authenticated" => $authenticated,
    "csrfToken" => $_SESSION["csrf_token"]
];

if ($authenticated) {
    $response["user"] = [
        "id" => $userId,
        "name" => $userName,
        "isAdmin" => $isAdmin
    ];
}

authJsonResponse(200, $response);
