<?php

declare(strict_types=1);

function authStartSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    ini_set("session.use_strict_mode", "1");
    ini_set("session.use_only_cookies", "1");

    $isHttps = isset($_SERVER["HTTPS"])
        && $_SERVER["HTTPS"] !== ""
        && strtolower($_SERVER["HTTPS"]) !== "off";

    session_set_cookie_params([
        "lifetime" => 0,
        "path" => "/",
        "secure" => $isHttps,
        "httponly" => true,
        "samesite" => "Lax"
    ]);

    session_start();

    if (empty($_SESSION["csrf_token"])) {
        $_SESSION["csrf_token"] = bin2hex(random_bytes(32));
    }
}

function authJsonResponse(int $status, array $data): void
{
    http_response_code($status);
    header("Content-Type: application/json; charset=utf-8");
    header("Cache-Control: no-store");
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function authRequireMethod(string $method): void
{
    if (($_SERVER["REQUEST_METHOD"] ?? "") !== $method) {
        header("Allow: " . $method);
        authJsonResponse(405, [
            "success" => false,
            "message" => "Método de requisição não permitido."
        ]);
    }
}

function authVerifyCsrf(): void
{
    $submittedToken = $_SERVER["HTTP_X_CSRF_TOKEN"] ?? "";
    $sessionToken = $_SESSION["csrf_token"] ?? "";

    if (!is_string($submittedToken) || !is_string($sessionToken)
        || $submittedToken === "" || !hash_equals($sessionToken, $submittedToken)) {
        authJsonResponse(403, [
            "success" => false,
            "message" => "Sua sessão expirou. Atualize a página e tente novamente."
        ]);
    }
}

function authInputString(string $key): string
{
    $value = $_POST[$key] ?? "";
    return is_string($value) ? $value : "";
}

function authStringLength(string $value): int
{
    $matched = preg_match_all("/./us", $value, $characters);
    return $matched === false ? -1 : $matched;
}
