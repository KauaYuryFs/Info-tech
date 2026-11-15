document.addEventListener("DOMContentLoaded", () => {
  const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const notice = document.querySelector("#notice");
  const toast = document.querySelector("#toast");
  const dialog = document.querySelector("#product-dialog");
  const productForm = document.querySelector("#product-form");
  let state = { products: [], categories: [], stats: {} };
  let noticeTimer;

  const notify = (message) => {
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
  };

  const request = async (method = "GET", fields = {}, query = "") => {
    const options = { method, credentials: "same-origin", cache: "no-store" };
    if (method === "POST") {
      options.headers = {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "X-CSRF-Token": csrfToken
      };
      options.body = new URLSearchParams(fields);
    }
    const response = await fetch(`../api/admin.php${query}`, options);
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("O servidor retornou uma resposta inválida.");
    }
    if (!response.ok || !data.success) {
      if (response.status === 401) window.location.assign("../login.html");
      throw new Error(data.message || "Não foi possível concluir a operação.");
    }
    return data;
  };

  const showError = (message) => {
    notice.textContent = message;
    notice.hidden = false;
  };

  const imagePath = (path) => {
    if (!path) return "../assets/img/produtos/monitor-gamer.jpg";
    try {
      const localPath = path.startsWith("assets/") ? `../${path}` : path;
      const url = new URL(localPath, document.baseURI);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "../assets/img/produtos/monitor-gamer.jpg";
    } catch {
      return "../assets/img/produtos/monitor-gamer.jpg";
    }
  };

  const productCell = (product, compact = false) => {
    const cell = document.createElement("td");
    const item = document.createElement("div");
    item.className = "product-cell";
    const image = document.createElement("img");
    image.src = imagePath(product.imagem);
    image.alt = "";
    image.loading = "lazy";
    image.addEventListener("error", () => {
      image.src = "../assets/img/produtos/monitor-gamer.jpg";
    }, { once: true });
    const text = document.createElement("span");
    text.className = "product-cell-copy";
    const name = document.createElement("strong");
    name.textContent = product.nome;
    text.append(name);
    if (!compact) {
      const id = document.createElement("small");
      id.textContent = `ID #${product.id}`;
      text.append(id);
    }
    item.append(image, text);
    cell.append(item);
    return cell;
  };

  const actionCell = (product) => {
    const cell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "row-actions";
    const edit = document.createElement("button");
    edit.className = "edit-button";
    edit.type = "button";
    edit.dataset.edit = String(product.id);
    edit.textContent = "Editar";
    const remove = document.createElement("button");
    remove.className = "delete-button";
    remove.type = "button";
    remove.dataset.delete = String(product.id);
    remove.textContent = "Excluir";
    actions.append(edit, remove);
    cell.append(actions);
    return cell;
  };

  const appendCell = (row, value, className = "") => {
    const cell = document.createElement("td");
    cell.textContent = value;
    if (className) cell.className = className;
    row.append(cell);
  };

  const productRow = (product, compact = false) => {
    const row = document.createElement("tr");
    if (!compact) appendCell(row, `#${product.id}`, "muted-cell");
    row.append(productCell(product, compact));
    appendCell(row, product.categoria || "Sem categoria");
    appendCell(row, money.format(Number(product.preco)));
    const stockCell = document.createElement("td");
    const stock = document.createElement("span");
    stock.className = `stock-badge${Number(product.estoque) <= 5 ? " is-low" : ""}`;
    stock.textContent = `${product.estoque} un.`;
    stockCell.append(stock);
    row.append(stockCell, actionCell(product));
    return row;
  };

  const renderProducts = () => {
    const filter = document.querySelector("#product-search").value.trim().toLocaleLowerCase("pt-BR");
    const filtered = state.products.filter((product) =>
      `${product.id} ${product.nome} ${product.categoria || ""}`.toLocaleLowerCase("pt-BR").includes(filter)
    );
    const productsTable = document.querySelector("#products-table");
    productsTable.replaceChildren(...filtered.map((product) => productRow(product)));
    document.querySelector("#products-empty").hidden = filtered.length !== 0;
    document.querySelector("#products-count").textContent =
      `${filtered.length} ${filtered.length === 1 ? "produto" : "produtos"}`;

    const recent = state.products.slice(0, 6);
    document.querySelector("#dashboard-products").replaceChildren(
      ...recent.map((product) => productRow(product, true))
    );
  };

  const renderOrders = (orders) => {
    const rows = orders.map((order) => {
      const row = document.createElement("tr");
      appendCell(row, `#${order.id}`, "muted-cell");
      appendCell(row, order.data_pedido || "—");

      const customer = document.createElement("td");
      const customerDetails = document.createElement("span");
      customerDetails.className = "product-cell-copy";
      const customerName = document.createElement("strong");
      customerName.textContent = order.cliente;
      const customerEmail = document.createElement("small");
      customerEmail.textContent = order.email;
      customerDetails.append(customerName, customerEmail);
      customer.append(customerDetails);
      row.append(customer);

      const items = (order.items || []).map((item) => `${item.name} × ${item.quantity}`).join(", ");
      appendCell(row, items || "Sem itens");
      appendCell(row, money.format(Number(order.total)));
      const statusCell = document.createElement("td");
      const status = document.createElement("span");
      status.className = "stock-badge order-status-admin";
      status.textContent = order.status || "pendente";
      status.classList.add(
        `status-${String(order.status || "pendente").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9_-]/g, "")}`
      );
      statusCell.append(status);
      row.append(statusCell);
      return row;
    });
    document.querySelector("#orders-table").replaceChildren(...rows);
    document.querySelector("#orders-empty").hidden = orders.length !== 0;
    document.querySelector("#orders-count").textContent =
      `${orders.length} ${orders.length === 1 ? "pedido" : "pedidos"}`;
  };

  const refreshOrders = async () => {
    try {
      const data = await request("GET", {}, "?view=orders");
      renderOrders(data.orders);
      notice.hidden = true;
    } catch (error) {
      showError(error.message);
    }
  };

  const renderCategories = () => {
    const selector = document.querySelector("#product-category");
    const selected = selector.value;
    const options = [new Option("Selecione uma categoria", "")];
    state.categories.forEach((category) => options.push(new Option(category.nome, String(category.id))));
    selector.replaceChildren(...options);
    if (state.categories.some((category) => String(category.id) === selected)) selector.value = selected;

    const list = document.querySelector("#categories-list");
    list.replaceChildren();
    if (!state.categories.length) {
      const empty = document.createElement("p");
      empty.className = "category-empty";
      empty.textContent = "Nenhuma categoria cadastrada.";
      list.append(empty);
      return;
    }
    state.categories.forEach((category) => {
      const row = document.createElement("div");
      row.className = "category-row";
      const name = document.createElement("strong");
      name.textContent = category.nome;
      const count = document.createElement("span");
      count.textContent = `${state.products.filter((product) => Number(product.categoria_id) === Number(category.id)).length} produtos`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "delete-button";
      remove.dataset.deleteCategory = String(category.id);
      remove.setAttribute("aria-label", `Excluir categoria ${category.nome}`);
      remove.textContent = "Excluir";
      row.append(name, count, remove);
      list.append(row);
    });
  };

  const renderStats = () => {
    document.querySelector("#stat-products").textContent = state.stats.total_produtos ?? "0";
    document.querySelector("#stat-low-stock").textContent = state.stats.estoque_baixo ?? "0";
    document.querySelector("#stat-categories").textContent = state.stats.total_categorias ?? "0";
    document.querySelector("#stat-stock-value").textContent = money.format(Number(state.stats.valor_estoque ?? 0));
    document.querySelector("#stat-average").textContent = money.format(Number(state.stats.preco_medio ?? 0));
  };

  const refresh = async () => {
    try {
      const data = await request();
      state = data;
      renderStats();
      renderProducts();
      renderCategories();
      notice.hidden = true;
    } catch (error) {
      showError(error.message);
    }
  };

  const switchView = (view) => {
    const titles = { dashboard: "Dashboard", products: "Produtos", categories: "Categorias", orders: "Pedidos" };
    document.querySelector("#page-title").textContent = titles[view];
    document.querySelectorAll("[data-section]").forEach((section) => {
      const visible = section.dataset.section === view;
      section.hidden = !visible;
      section.classList.toggle("is-visible", visible);
    });
    document.querySelectorAll(".side-nav [data-view]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.view === view);
    });
    document.querySelector(".sidebar").classList.remove("is-open");
    document.querySelector(".mobile-menu").setAttribute("aria-expanded", "false");
    if (view === "orders") refreshOrders();
  };

  const openProductDialog = (product = null) => {
    productForm.reset();
    productForm.elements.namedItem("id").value = product ? product.id : "";
    document.querySelector("#product-dialog-title").textContent = product ? "Editar produto" : "Adicionar produto";
    if (product) {
      productForm.elements.namedItem("nome").value = product.nome;
      productForm.elements.namedItem("descricao").value = product.descricao || "";
      productForm.elements.namedItem("preco").value = product.preco;
      productForm.elements.namedItem("estoque").value = product.estoque;
      productForm.elements.namedItem("categoria_id").value = product.categoria_id || "";
      productForm.elements.namedItem("imagem").value = product.imagem || "";
    }
    dialog.showModal();
  };

  document.addEventListener("click", async (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.dataset.view) {
      switchView(target.dataset.view);
      return;
    }
    if (target.hasAttribute("data-add-product")) {
      openProductDialog();
      return;
    }
    if (target.hasAttribute("data-close-dialog")) {
      dialog.close();
      return;
    }
    if (target.hasAttribute("data-edit")) {
      const product = state.products.find((item) => Number(item.id) === Number(target.dataset.edit));
      if (product) openProductDialog(product);
      return;
    }
    if (target.hasAttribute("data-delete")) {
      const product = state.products.find((item) => Number(item.id) === Number(target.dataset.delete));
      if (!product || !window.confirm(`Excluir o produto "${product.nome}"? Esta ação não pode ser desfeita.`)) return;
      try {
        const result = await request("POST", { action: "produto_excluir", id: product.id });
        notify(result.message);
        await refresh();
      } catch (error) {
        notify(error.message);
      }
      return;
    }
    if (target.hasAttribute("data-delete-category")) {
      const category = state.categories.find((item) => Number(item.id) === Number(target.dataset.deleteCategory));
      if (!category || !window.confirm(`Excluir a categoria "${category.nome}"?`)) return;
      try {
        const result = await request("POST", { action: "categoria_excluir", id: category.id });
        notify(result.message);
        await refresh();
      } catch (error) {
        notify(error.message);
      }
      return;
    }
    if (target.hasAttribute("data-logout")) {
      target.disabled = true;
      try {
        const response = await fetch("../api/logout.php", {
          method: "POST",
          credentials: "same-origin",
          headers: { "X-CSRF-Token": csrfToken }
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Não foi possível sair.");
        window.location.assign("../index.html");
      } catch (error) {
        target.disabled = false;
        notify(error.message);
      }
      return;
    }
    if (target.classList.contains("mobile-menu")) {
      const open = document.querySelector(".sidebar").classList.toggle("is-open");
      target.setAttribute("aria-expanded", String(open));
    }
  });

  productForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!productForm.reportValidity()) return;
    const submit = productForm.querySelector('[type="submit"]');
    submit.disabled = true;
    const fields = Object.fromEntries(new FormData(productForm).entries());
    const isEdit = Boolean(fields.id);
    fields.action = isEdit ? "produto_editar" : "produto_criar";
    try {
      const result = await request("POST", fields);
      dialog.close();
      notify(result.message);
      await refresh();
    } catch (error) {
      notify(error.message);
    } finally {
      submit.disabled = false;
    }
  });

  document.querySelector("#category-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const result = await request("POST", {
        action: "categoria_criar",
        nome: form.elements.namedItem("nome").value.trim()
      });
      form.reset();
      notify(result.message);
      await refresh();
    } catch (error) {
      notify(error.message);
    } finally {
      submit.disabled = false;
    }
  });

  document.querySelector("#product-search").addEventListener("input", renderProducts);
  refresh();
});
