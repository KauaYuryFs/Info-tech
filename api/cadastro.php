<?php

declare(strict_types=1);

require_once __DIR__ . "/auth_common.php";

authStartSession();
authRequireMethod("POST");
authVerifyCsrf();

$nome = trim(authInputString("nome"));
$email = strtolower(trim(authInputString("email")));
$senhaUsuario = authInputString("senha");
$nomeLength = authStringLength($nome);
$senhaLength = authStringLength($senhaUsuario);

if ($nome === "" || $email === "" || $senhaUsuario === "") {
    authJsonResponse(422, [
        "success" => false,
        "message" => "Preencha todos os campos obrigatórios."
    ]);
}

if ($nomeLength < 2 || $nomeLength > 150) {
    authJsonResponse(422, [
        "success" => false,
        "message" => "Informe um nome com pelo menos 2 caracteres."
    ]);
}

if (strlen($email) > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    authJsonResponse(422, [
        "success" => false,
        "message" => "Informe um endereço de e-mail válido."
    ]);
}

if ($senhaLength < 8 || strlen($senhaUsuario) > 4096) {
    authJsonResponse(422, [
        "success" => false,
        "message" => "A senha deve ter pelo menos 8 caracteres."
    ]);
}

require_once __DIR__ . "/conexao.php";

try {
    $consulta = $conexao->prepare("SELECT id FROM usuarios WHERE email = :email LIMIT 1");
    $consulta->execute(["email" => $email]);

    if ($consulta->fetch()) {
        authJsonResponse(409, [
            "success" => false,
            "message" => "Este e-mail já possui uma conta. Tente entrar."
        ]);
    }

    $senhaHash = password_hash($senhaUsuario, PASSWORD_DEFAULT);
    $inserir = $conexao->prepare(
        "INSERT INTO usuarios (nome, email, senha) VALUES (:nome, :email, :senha)"
    );
    $inserir->execute([
        "nome" => $nome,
        "email" => $email,
        "senha" => $senhaHash
    ]);

    authJsonResponse(201, [
        "success" => true,
        "message" => "Conta criada com sucesso. Agora, entre com seu e-mail e senha."
    ]);
} catch (PDOException $error) {
    if ($error->getCode() === "23000") {
        authJsonResponse(409, [
            "success" => false,
            "message" => "Este e-mail já possui uma conta. Tente entrar."
        ]);
    }

    error_log("User registration failed: " . $error->getMessage());
    authJsonResponse(500, [
        "success" => false,
        "message" => "Não foi possível criar sua conta agora. Tente novamente."
    ]);
}
