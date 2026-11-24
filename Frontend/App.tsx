import { useEffect, useMemo, useState } from "react";

type Variant = { id: number; size: string; price: number; availability: "available" | "not_available" };
type Product = { id: number; title: string; image: string; categoryId: number; variants: Variant[] };

type CartItem = {
  itemId: string;
  variantId: number;
  productTitle: string;
  size: string;
  qty: number;
  unitPrice: number;
  availability: "available" | "not_available";
};

const API = (path: string) => path; // proxy radi /api u viteu

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Load products
  useEffect(() => {
    fetch(API("/api/products"))
      .then(r => r.json())
      .then(setProducts)
      .catch(console.error);

    fetch(API("/api/cart"))
      .then(r => r.json())
      .then((d) => setCartItems(d.items ?? []))
      .catch(() => {});
  }, []);

  // SSE real-time: update availability per variant
  useEffect(() => {
    const es = new EventSource(API("/api/realtime/events"));
    es.addEventListener("ping", () => {});
    es.onmessage = () => {};

    // Ako želiš da stvarno primiš emitovane events, treba emit implementacija preko produkcijskog kanala.
    // Ovdje ostaje placeholder struktura:
    // es.addEventListener("variant.updated", (e) => { ... })

    return () => es.close();
  }, []);

  const cart = useMemo(() => {
    const subtotal = cartItems.reduce((s, it) => s + it.unitPrice * it.qty, 0);
    return { subtotal };
  }, [cartItems]);

  const addToCart = async (variantId: number, qty: number) => {
    const res = await fetch(API("/api/cart/items"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId, qty })
    });
    const data = await res.json();
    if (!data.ok) {
      alert(data.error ?? "Not available");
      return;
    }
    setCartItems(data.cart.items ?? []);
  };

  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const doCheckout = async () => {
    setCheckoutBusy(true);
    const init = await (await fetch(API("/api/checkout/init"), { method: "POST" })).json();
    if (!init.ok) {
      alert("Checkout error: " + (init.error ?? "cart invalid"));
      setCheckoutBusy(false);
      return;
    }

    const confirm = await (await fetch(API("/api/checkout/confirm"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentMethod: "card" })
    })).json();

    if (confirm.ok) {
      alert("Narudžba uspješna: " + confirm.orderId);
      setCartItems([]);
    } else {
      alert("Greška: " + (confirm.error ?? "checkout failed"));
    }
    setCheckoutBusy(false);
  };

  return (
    <div style={{ padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ textAlign: "center" }}>Cloud’s Shop</h1>
      <p style={{ textAlign: "center" }}>Odabrani komadi iz privatne kolekcije</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, alignItems: "start" }}>
        <div>
          <h2>Proizvodi</h2>
          {products.map(p => (
            <div key={p.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <img src={p.image} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 10 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{p.title}</div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    {p.variants.map(v => {
                      const disabled = v.availability !== "available";
                      return (
                        <button
                          key={v.id}
                          onClick={() => addToCart(v.id, 1)}
                          disabled={disabled}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 999,
                            border: "1px solid #111",
                            background: disabled ? "#f3f3f3" : "#111",
                            color: disabled ? "#444" : "#fff",
                            cursor: disabled ? "not-allowed" : "pointer"
                          }}
                          title={disabled ? "Not available" : "Add to cart"}
                        >
                          {v.size} • {v.availability === "available" ? "available" : "not_available"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

            </div>
          ))}
        </div>

        <aside style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
          <h2>Košarica</h2>

          {cartItems.length === 0 ? (
            <div>Košarica je prazna.</div>
          ) : (
            <>
              {cartItems.map(it => (
                <div key={it.itemId} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #eee" }}>
                  <div><b>{it.productTitle}</b></div>
                  <div>Veličina: {it.size}</div>
                  <div>Cijena: {it.unitPrice.toFixed(2)} €</div>
                  <div>Dostupnost: {it.availability}</div>
                </div>
              ))}

              <div style={{ fontWeight: 800, marginTop: 8 }}>
                Ukupno: {cart.subtotal.toFixed(2)} €
              </div>

              <button
                onClick={doCheckout}
                disabled={checkoutBusy}
                style={{
                  marginTop: 12,
                  width: "100%",
                  padding: "12px 10px",
                  borderRadius: 10,
                  border: "none",
                  background: "#111",
                  color: "#fff",
                  cursor: "pointer",
                  opacity: checkoutBusy ? 0.7 : 1
                }}
              >
                {checkoutBusy ? "Provjera..." : "Završi narudžbu"}
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
