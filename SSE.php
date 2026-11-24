<?php
declare(strict_types=1);

final class SSE {
    // U demo scopi koristimo memorijski “kanal” (ne radi preko više PHP procesa).
    // Za produkciju: uvedi Redis/pubsub ili poseban SSE server.
    private static array $clients = [];

    public static function stream(callable $noop): void {
        header('Content-Type: text/event-stream; charset=utf-8');
        header('Cache-Control: no-cache');
        header('Connection: keep-alive');

        // Keep-alive
        echo "retry: 3000\n\n";
        @ob_flush(); @flush();

        $id = uniqid('c_', true);
        self::$clients[$id] = true;

        while (true) {
            // Simple keep-alive event
            echo "event: ping\n";
            echo "data: " . json_encode(['t' => time()], JSON_UNESCAPED_UNICODE) . "\n\n";
            @ob_flush(); @flush();
            sleep(20);
        }
    }

    public static function emit(array $event): void {
        // Demo: u stvarnoj deploy varijanti ovo mora ići preko shared pubsub sustava.
        // Ovdje ostaje kao “placeholder” za strukturu.
    }
}
