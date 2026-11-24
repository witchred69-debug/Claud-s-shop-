<?php
declare(strict_types=1);

final class Store {

    public static function categories(): array {
        return [
            ['id' => 1, 'title' => 'Privatna kolekcija'],
            ['id' => 2, 'title' => 'Najnovije'],
        ];
    }

    public static function products(string $q, ?string $categoryId): array {
        // Demo podaci (kasnije puni iz CMS tablica)
        $products = [
            [
                'id' => 101,
                'title' => "Odabrani komad A",
                'categoryId' => 1,
                'image' => 'https://picsum.photos/400?1',
                'variants' => [
                    ['id'=>1001,'size'=>'S','price'=>39.90,'availability'=>'available'],
                    ['id'=>1002,'size'=>'M','price'=>39.90,'availability'=>'not_available'],
                    ['id'=>1003,'size'=>'L','price'=>39.90,'availability'=>'available'],
                ]
            ],
            [
                'id' => 102,
                'title' => "Odabrani komad B",
                'categoryId' => 1,
                'image' => 'https://picsum.photos/400?2',
                'variants' => [
                    ['id'=>2001,'size'=>'S','price'=>49.90,'availability'=>'available'],
                    ['id'=>2002,'size'=>'M','price'=>49.90,'availability'=>'available'],
                ]
            ],
        ];

        if ($categoryId) {
            $cid = (int)$categoryId;
            $products = array_values(array_filter($products, fn($p) => $p['categoryId'] === $cid));
        }
        if ($q !== '') {
            $qLower = mb_strtolower($q);
            $products = array_values(array_filter($products, function($p) use ($qLower) {
                return mb_strpos(mb_strtolower($p['title']), $qLower) !== false;
            }));
        }

        return $products;
    }

    public static function availabilityByProductIds(array $ids): array {
        // Demo: vraća availability per variant kroz hardcoded proizvode
        $all = self::products('', null);
        $needed = array_values(array_filter($all, fn($p) => in_array($p['id'], $ids, true)));

        $out = [];
        foreach ($needed as $p) {
            foreach ($p['variants'] as $v) {
                $out[$v['id']] = ['availability' => $v['availability']];
            }
        }
        return ['byVariantId' => $out];
    }

    public static function getCartFromRequest(): array {
        $cart = $_SESSION['cart'] ?? ['items'=>[]];
        return $cart;
    }

    private static function findVariant(int $variantId): ?array {
        $products = self::products('', null);
        foreach ($products as $p) {
            foreach ($p['variants'] as $v) {
                if ((int)$v['id'] === $variantId) {
                    return $v + ['productId'=>$p['id'], 'productTitle'=>$p['title']];
                }
            }
        }
        return null;
    }

    public static function cartAdd(int $variantId, int $qty): array {
        $variant = self::findVariant($variantId);
        if (!$variant) {
            return ['ok'=>false, 'error'=>'Variant not found'];
        }

        // Server-truth re-check
        $availability = $variant['availability'];
        $isAvailable = $availability === 'available';
        if (!$isAvailable) {
            return ['ok'=>false, 'error'=>'not available', 'variantId'=>$variantId, 'availability'=>$availability];
        }

        $cart = $_SESSION['cart'] ?? ['items'=>[]];
        $itemId = uniqid('ci_', true);

        // Cijenu prikazujemo u košarici (po tvojoj zadnjoj poruci)
        $cart['items'][] = [
            'itemId' => $itemId,
            'variantId' => $variantId,
            'productId' => (int)$variant['productId'],
            'productTitle' => (string)$variant['productTitle'],
            'size' => (string)$variant['size'],
            'qty' => $qty,
            'unitPrice' => (float)$variant['price'],
            'availability' => $availability,
        ];

        $_SESSION['cart'] = $cart;
        return ['ok'=>true, 'cart'=>self::getCartFromRequest()];
    }

    public static function cartRemove(int $itemId): array {
        $cart = $_SESSION['cart'] ?? ['items'=>[]];
        $cart['items'] = array_values(array_filter($cart['items'], fn($it) => (int)$it['itemId'] !== (int)$itemId));
        $_SESSION['cart'] = $cart;
        return ['ok'=>true, 'cart'=>self::getCartFromRequest()];
    }

    public static function validateCartServerTruth(): array {
        $cart = $_SESSION['cart'] ?? ['items'=>[]];
        $errors = [];

        foreach ($cart['items'] as &$it) {
            $variant = self::findVariant((int)$it['variantId']);
            if (!$variant) {
                $errors[] = ['itemId'=>$it['itemId'], 'reason'=>'variant missing'];
                continue;
            }
            $it['availability'] = $variant['availability'];
            $it['unitPrice'] = (float)$variant['price'];

            if ($variant['availability'] !== 'available') {
                $errors[] = ['itemId'=>$it['itemId'], 'reason'=>'not available', 'availability'=>$variant['availability']];
            }
        }

        return ['ok'=>count($errors)===0, 'errors'=>$errors, 'cart'=>$cart];
    }

    public static function checkoutInit(): array {
        $validation = self::validateCartServerTruth();
        if (!$validation['ok']) {
            return ['ok'=>false, 'error'=>'Cart not valid', 'details'=>$validation['errors']];
        }

        $cart = $validation['cart'];

        $subtotal = 0.0;
        foreach ($cart['items'] as $it) {
            $subtotal += ((float)$it['unitPrice'] * (int)$it['qty']);
        }

        return [
            'ok' => true,
            'order' => [
                'subtotal' => round($subtotal, 2),
                'currency' => 'EUR',
                'paymentMethods' => [
                    ['id'=>'card', 'title'=>'Kartica'],
                    ['id'=>'paypal', 'title'=>'PayPal'],
                    ['id'=>'bank', 'title'=>'Bankovni prijenos'],
                ]
            ],
            'cart' => $cart
        ];
    }

    public static function checkoutConfirm(string $paymentMethod): array {
        $validation = self::validateCartServerTruth();
        if (!$validation['ok']) {
            return ['ok'=>false, 'error'=>'Cart changed. Please retry.', 'details'=>$validation['errors']];
        }

        // Demo: order success
        $_SESSION['cart'] = ['items'=>[]];

        return [
            'ok'=>true,
            'orderId' => 'ORD-' . random_int(10000, 99999),
            'paymentMethod' => $paymentMethod,
            'tracking' => [
                'status' => 'processing',
                'trackingUrl' => null
            ]
        ];
    }

    public static function adminSetVariantAvailability(int $variantId, bool $available): void {
        // Demo: u realnom: UPDATE u bazi.
        // Ovdje ostaje placeholder jer demo nema DB.
        // SSE emit se poziva iz index.php.
    }
}
