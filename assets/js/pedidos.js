document.addEventListener("DOMContentLoaded", async () => {
  const list = document.querySelector("#orders-list");
  const message = document.querySelector("#orders-message");
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const defaultImage = "assets/img/produtos/monitor-gamer.jpg";
  const orderFromUrl = new URLSearchParams(window.location.search).get("pedido");

  const orderImage = (path) => {
    if (!path) return defaultImage;
    try {
      const url = new URL(path, document.baseURI);
      return ["http:", "https:"].includes(url.protocol) ? url.href : defaultImage;
    } catch {
      return defaultImage;
    }
  };

  const addText = (parent, tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    parent.append(element);
    return element;
  };
  const displayDate = (value) => {
    if (!value) return "Data não disponível";
    const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T"));
    return Number.isNaN(parsed.getTime())
      ? value
      : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
  };

  const renderOrder = (order) => {
    const card = document.createElement("article");
    card.className = `order-card${String(order.id) === orderFromUrl ? " is-highlighted" : ""}`;
    const header = document.createElement("div");
    header.className = "order-card-header";
    const heading = document.createElement("div");
    addText(heading, "span", "order-label", "PEDIDO");
    addText(heading, "strong", "order-number", `#${order.id}`);
    const meta = document.createElement("div");
    addText(meta, "span", "order-date", displayDate(order.data_pedido));
    const status = addText(meta, "span", "order-status", String(order.status || "pendente"));
    status.classList.add(`status-${String(order.status || "pendente").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9_-]/g, "")}`);
    header.append(heading, meta);

    const items = document.createElement("div");
    items.className = "order-items";
    (order.items || []).forEach((item) => {
      const row = document.createElement("div");
      row.className = "order-item";
      const image = document.createElement("img");
      image.className = "order-item-image";
      image.src = orderImage(item.image);
      image.alt = "";
      image.loading = "lazy";
      image.addEventListener("error", () => { image.src = defaultImage; }, { once: true });
      const details = document.createElement("div");
      details.className = "order-item-details";
      addText(details, "strong", "", item.name);
      addText(details, "span", "", `${item.quantity} ${Number(item.quantity) === 1 ? "unidade" : "unidades"} × ${money.format(Number(item.unitPrice))}`);
      addText(row, "strong", "order-item-total", money.format(Number(item.unitPrice) * Number(item.quantity)));
      row.prepend(image, details);
      items.append(row);
    });

    const footer = document.createElement("div");
    footer.className = "order-card-footer";
    addText(footer, "span", "order-payment-note", "Pedido simulado · nenhum pagamento realizado");
    const total = document.createElement("strong");
    total.textContent = `Total: ${money.format(Number(order.total))}`;
    footer.append(total);
    card.append(header, items, footer);
    list.append(card);
  };

  try {
    const response = await fetch("api/pedidos.php", {
      credentials: "same-origin",
      cache: "no-store"
    });
    const data = await response.json();
    if (response.status === 401) {
      window.location.assign("login.html?retorno=pedidos");
      return;
    }
    if (!response.ok || !data.success || !Array.isArray(data.orders)) {
      throw new Error(data.message || "Não foi possível carregar seus pedidos agora.");
    }
    if (data.orders.length === 0) {
      message.textContent = "Você ainda não fez nenhum pedido.";
      const link = document.createElement("a");
      link.className = "button button-primary";
      link.href = "index.html";
      link.textContent = "Explorar produtos";
      message.append(" ", link);
      return;
    }
    message.hidden = true;
    data.orders.forEach(renderOrder);
  } catch (error) {
    message.textContent = error.message;
    message.classList.add("is-error");
  }
});
