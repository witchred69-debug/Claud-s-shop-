<?php
declare(strict_types=1);

final class Auth {
    public static function requireAdmin(): void {
        // TODO: integriraj sa CMS autentikacijom / sesijom
        // Demo: admin ako je session admin=true
        if (!($_SESSION['admin'] ?? false)) {
            http_response_code(403);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['error' => 'admin only']);
            exit;
        }
    }

    public static function requireSessionGuestOrUser(): void {
        // Minimalno: ako nema sesije, kreiramo kao guest
        if (!isset($_SESSION['sid'])) {
            $_SESSION['sid'] = bin2hex(random_bytes(16));
        }
    }
}
