<?php

declare(strict_types=1);

require_once __DIR__ . "/auth_common.php";

authStartSession();
authRequireMethod("POST");
authVerifyCsrf();

$_SESSION = [];
$cookie = session_get_cookie_params();
setcookie(session_name(), "", [
    "expires" => time() - 42000,
    "path" => $cookie["path"],
    "domain" => $cookie["domain"],
    "secure" => $cookie["secure"],
    "httponly" => $cookie["httponly"],
    "samesite" => $cookie["samesite"] ?? "Lax"
]);
session_destroy();

authJsonResponse(200, [
    "success" => true,
    "message" => "Você saiu da sua conta."
]);
