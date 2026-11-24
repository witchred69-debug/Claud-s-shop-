<?php
declare(strict_types=1);

final class Router {
    private array $routes = [];

    public function add(string $method, string $path, callable $handler): void {
        $this->routes[] = [$method, $path, $handler];
    }

    public function dispatch(string $method, string $path): void {
        foreach ($this->routes as [$m, $p, $h]) {
            if ($m === $method && $p === $path) {
                $h();
                return;
            }
        }
        http_response_code(404);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'route not found'], JSON_UNESCAPED_UNICODE);
    }
}
