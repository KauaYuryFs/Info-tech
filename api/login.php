<?php

declare(strict_types=1);

require_once __DIR__ . "/auth_common.php";

authStartSession();
authRequireMethod("POST");
authVerifyCsrf();

$email = strtolower(trim(authInputString("email")));
$senhaUsuario = authInputString("senha");

if ($email === "" || $senhaUsuario === "") {
    authJsonResponse(422, [
        "success" => false,
        "message" => "Informe seu e-mail e sua senha."
    ]);
}

if (strlen($email) > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    authJsonResponse(401, [
        "success" => false,
        "message" => "E-mail ou senha inválidos."
    ]);
}

require_once __DIR__ . "/conexao.php";

try {
    $consulta = $conexao->prepare(
        "SELECT id, nome, senha FROM usuarios WHERE email = :email LIMIT 1"
    );
    $consulta->execute(["email" => $email]);
    $usuario = $consulta->fetch();

    if (!$usuario || !is_string($usuario["senha"])
        || !password_verify($senhaUsuario, $usuario["senha"])) {
        authJsonResponse(401, [
            "success" => false,
            "message" => "E-mail ou senha inválidos."
        ]);
    }

    if (!session_regenerate_id(true)) {
        throw new RuntimeException("Unable to regenerate the authenticated session ID.");
    }

    $_SESSION = [
        "user_id" => (int) $usuario["id"],
        "user_name" => (string) $usuario["nome"],
        "csrf_token" => bin2hex(random_bytes(32))
    ];

    authJsonResponse(200, [
        "success" => true,
        "message" => "Login realizado com sucesso.",
        "user" => [
            "id" => (int) $usuario["id"],
            "name" => (string) $usuario["nome"]
        ],
        "csrfToken" => $_SESSION["csrf_token"]
    ]);
} catch (PDOException $error) {
    error_log("User login failed: " . $error->getMessage());
    authJsonResponse(500, [
        "success" => false,
        "message" => "Não foi possível entrar agora. Tente novamente."
    ]);
} catch (RuntimeException $error) {
    error_log($error->getMessage());
    authJsonResponse(500, [
        "success" => false,
        "message" => "Não foi possível iniciar sua sessão. Tente novamente."
    ]);
}
