let products = [];
const productById = new Map();
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const CART_STORAGE_KEY = "infotech-cart";
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[character]);
const DEFAULT_PRODUCT_IMAGE = "assets/img/produtos/monitor-gamer.jpg";
const imageUrl = (path) => {
  if (!path) return DEFAULT_PRODUCT_IMAGE;
  try {
    const url = new URL(path, document.baseURI);
    return ["http:", "https:"].includes(url.protocol) ? url.href : DEFAULT_PRODUCT_IMAGE;
  } catch {
    return DEFAULT_PRODUCT_IMAGE;
  }
};
const productCard = (product) => `
  <article class="product-card">
    <div class="product-image-wrap">
      <button class="product-favorite" type="button" aria-label="Adicionar ${escapeHTML(product.nome)} aos favoritos" aria-pressed="false" data-favorite="${product.id}">♡</button>
      <a href="#produto" class="product-image-link" data-product="${product.id}" aria-label="Ver ${escapeHTML(product.nome)}"><img src="${imageUrl(product.imagem)}" alt="${escapeHTML(product.nome)}" loading="lazy"></a>
    </div>
    <div class="product-info">
      <span class="product-category">${escapeHTML(product.categoria)}</span>
      <a href="#produto" class="product-name" data-product="${product.id}">${escapeHTML(product.nome)}</a>
      <p class="product-description">${escapeHTML(product.descricao || "Descrição não disponível.")}</p>
      <strong class="product-price">${money.format(product.preco)}</strong>
      <span class="product-stock${product.estoque > 0 ? "" : " out-of-stock"}">${product.estoque > 0 ? `${product.estoque} em estoque` : "Indisponível"}</span>
      <button class="add-cart" type="button" data-cart="${product.id}" ${product.estoque > 0 ? "" : "disabled"}><span>＋</span> Adicionar ao carrinho</button>
    </div>
  </article>`;

document.addEventListener("DOMContentLoaded", () => {
  const toast = document.querySelector("#toast");
  let productsState = "loading";
  let toastTimer;
  const notify = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3000);
  };
  let csrfToken = "";
  const renderAccount = (user) => {
    const isStorefront = document.querySelector("#product-grid") !== null;
    document.querySelectorAll("[data-account-link]").forEach((link) => {
      const greeting = link.querySelector("[data-account-greeting]");
      const label = link.querySelector("[data-account-label]");
      if (greeting) greeting.textContent = user ? "Olá," : "Olá, visitante";
      if (label) label.textContent = user ? user.name : "Minha conta";
      const returnPage = window.location.pathname.endsWith("/pedidos.html") ? "pedidos" : "index";
      link.href = user ? (returnPage === "pedidos" ? "pedidos.html" : "index.html") : "login.html";
      link.setAttribute("aria-label", user ? `Conta de ${user.name}` : "Entrar na minha conta");
    });

    document.querySelectorAll(".logout-action").forEach((button) => button.remove());
    document.querySelectorAll(".admin-panel-action").forEach((link) => link.remove());
    if (!user) return;

    const headerActions = document.querySelector(".header-actions");
    if (!headerActions) return;
    if (isStorefront && user.isAdmin === true) {
      const adminLink = document.createElement("a");
      adminLink.className = "header-action admin-panel-action";
      adminLink.href = "admin/";
      adminLink.setAttribute("aria-label", "Painel Admin");

      const icon = document.createElement("span");
      icon.className = "action-icon";
      icon.textContent = "▦";
      const label = document.createElement("span");
      const caption = document.createElement("small");
      caption.textContent = "Administração";
      const title = document.createElement("strong");
      title.textContent = "Painel Admin";
      label.append(caption, title);
      adminLink.append(icon, label);

      const accountLink = headerActions.querySelector("[data-account-link]");
      if (accountLink) accountLink.after(adminLink);
      else headerActions.prepend(adminLink);
    }

    const logout = document.createElement("button");
    logout.className = "header-action logout-action";
    logout.type = "button";
    logout.dataset.logout = "";
    logout.setAttribute("aria-label", "Sair da conta");
    logout.innerHTML = '<span class="action-icon">↪</span><span><small>Sessão ativa</small><strong>Sair</strong></span>';
    headerActions.append(logout);
  };
  const sessionPromise = fetch("api/sessao.php", { credentials: "same-origin" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`A verificação da sessão respondeu com status ${response.status}.`);
      const data = await response.json();
      if (typeof data.csrfToken !== "string" || !data.csrfToken) {
        throw new Error("A resposta da sessão não contém um token de segurança.");
      }
      csrfToken = data.csrfToken;
      renderAccount(data.authenticated && data.user ? data.user : null);
      return data;
    })
    .catch((error) => {
      console.error("Falha ao verificar a sessão:", error);
      return null;
    });
  const postAuthRequest = async (endpoint, fields = {}) => {
    const sessionResponse = await fetch("api/sessao.php", {
      credentials: "same-origin",
      cache: "no-store"
    });
    if (!sessionResponse.ok) {
      throw new Error("Não foi possível validar sua sessão. Atualize a página e tente novamente.");
    }
    const session = await sessionResponse.json();
    if (typeof session.csrfToken !== "string" || !session.csrfToken) {
      throw new Error("Não foi possível validar sua sessão. Atualize a página e tente novamente.");
    }
    csrfToken = session.csrfToken;
    renderAccount(session.authenticated && session.user ? session.user : null);

    const response = await fetch(`api/${endpoint}.php`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "X-CSRF-Token": csrfToken
      },
      body: new URLSearchParams(fields)
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("Não foi possível processar a resposta do servidor. Tente novamente.");
    }
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Não foi possível concluir a solicitação.");
    }
    return data;
  };

  if (new URLSearchParams(window.location.search).get("cadastro") === "sucesso") {
    notify("Cadastro realizado com sucesso. Entre com seu e-mail e senha.");
    window.history.replaceState(null, "", window.location.pathname);
  }

  const loadCart = () => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved === null) return [];
      const cart = JSON.parse(saved);
      if (!Array.isArray(cart) || cart.some((item) =>
        !item || !Number.isSafeInteger(item.productId) || item.productId < 0 ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1
      )) throw new Error("Os dados salvos do carrinho são inválidos.");
      return cart;
    } catch (error) {
      notify("Não foi possível ler o carrinho salvo. Verifique as configurações de armazenamento do navegador.");
      console.error("Falha ao carregar o carrinho:", error);
      return null;
    }
  };
  const saveCart = (cart) => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      const count = document.querySelector(".cart-count");
      if (count) count.textContent = String(cart.reduce((total, item) => total + item.quantity, 0));
      return true;
    } catch (error) {
      notify("Não foi possível salvar o carrinho. Verifique o armazenamento disponível no navegador.");
      console.error("Falha ao salvar o carrinho:", error);
      return false;
    }
  };
  const syncCartBadge = () => {
    const cart = loadCart();
    const count = document.querySelector(".cart-count");
    if (cart && count) count.textContent = String(cart.reduce((total, item) => total + item.quantity, 0));
  };

  const grid = document.querySelector("#product-grid");
  const bestsellers = document.querySelector("#bestseller-grid");
  const cartItems = document.querySelector("#cart-items");
  syncCartBadge();
  let selectedCategory = "Todos";
  let query = "";
  const normalizeCategory = (category) => category.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const addCategories = () => {
    const categories = [...new Set(products.map((product) => product.categoria))];
    const pills = document.querySelector(".filter-pills");
    const nav = document.querySelector(".category-nav-inner");
    categories.forEach((category) => {
      if (pills && ![...pills.querySelectorAll("[data-category]")].some((item) => normalizeCategory(item.dataset.category) === normalizeCategory(category))) {
        const pill = document.createElement("button");
        pill.className = "filter-pill";
        pill.type = "button";
        pill.dataset.category = category;
        pill.textContent = category;
        pills.append(pill);
      }
      if (nav && ![...nav.querySelectorAll("[data-category]")].some((item) => normalizeCategory(item.dataset.category) === normalizeCategory(category))) {
        const link = document.createElement("a");
        link.href = "#produtos";
        link.dataset.category = category;
        link.textContent = category;
        nav.append(link);
      }
    });
  };
  const render = () => {
    const filtered = products.filter((product) =>
      (selectedCategory === "Todos" || normalizeCategory(product.categoria) === normalizeCategory(selectedCategory)) &&
      `${product.nome} ${product.descricao} ${product.categoria}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))
    );
    if (grid) {
      grid.innerHTML = filtered.map(productCard).join("");
      const empty = document.querySelector("#empty-state");
      if (empty) {
        empty.hidden = filtered.length > 0;
        if (!products.length) {
          empty.textContent = productsState === "error"
            ? "Não foi possível carregar os produtos agora. Tente novamente em alguns instantes."
            : productsState === "empty"
              ? "Ainda não há produtos cadastrados. Volte em breve para conferir as novidades."
              : "Carregando produtos...";
        } else {
          empty.textContent = "Nenhum produto encontrado. Tente outra busca.";
        }
      }
    }
    if (bestsellers) bestsellers.innerHTML = products.slice(0, 4).map(productCard).join("");
  };
  render();

  const renderCart = () => {
    if (!cartItems) return;
    const cart = loadCart();
    if (cart === null) {
      cartItems.innerHTML = '<p class="cart-message">Não foi possível carregar seu carrinho. Atualize a página ou verifique o armazenamento do navegador.</p>';
      return;
    }
    const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
    const countLabel = document.querySelector("#cart-item-count");
    if (countLabel) countLabel.textContent = `${itemCount} ${itemCount === 1 ? "item" : "itens"}`;
    if (cart.length === 0) {
      cartItems.innerHTML = '<div class="cart-empty"><span>♧</span><strong>Seu carrinho está vazio</strong><p>Encontre algo especial para o seu setup.</p><a class="button button-primary" href="index.html">Explorar produtos <span>→</span></a></div>';
    } else {
      const notice = productsState === "error"
        ? '<p class="cart-message">Não foi possível atualizar os produtos. Os itens salvos no carrinho foram mantidos.</p>'
        : "";
      cartItems.innerHTML = notice + cart.map(({ productId, quantity }) => {
        const product = productById.get(productId);
        if (!product) {
          return `<article class="cart-item">
            <div class="cart-item-details"><strong>Produto indisponível</strong><span class="cart-item-unit-price">Este item não está mais disponível no catálogo.</span></div>
            <div class="cart-item-controls"><button class="remove-cart-item" type="button" data-remove="${productId}">Remover</button></div>
          </article>`;
        }
        return `<article class="cart-item">
          <img class="cart-item-image" src="${imageUrl(product.imagem)}" alt="${escapeHTML(product.nome)}">
          <div class="cart-item-details"><span class="product-category">${escapeHTML(product.categoria)}</span><strong>${escapeHTML(product.nome)}</strong><span class="cart-item-unit-price">${money.format(product.preco)} cada</span></div>
          <div class="cart-item-controls"><div class="quantity-control" aria-label="Quantidade de ${escapeHTML(product.nome)}"><button type="button" data-quantity="-1" data-product-id="${productId}" aria-label="Diminuir quantidade">−</button><span>${quantity}</span><button type="button" data-quantity="1" data-product-id="${productId}" aria-label="Aumentar quantidade" ${quantity >= product.estoque ? "disabled" : ""}>+</button></div><strong class="cart-item-total">${money.format(product.preco * quantity)}</strong><button class="remove-cart-item" type="button" data-remove="${productId}">Remover</button></div>
        </article>`;
      }).join("");
    }
    const subtotal = cart.reduce((total, item) => {
      const product = productById.get(item.productId);
      return total + (product ? product.preco * item.quantity : 0);
    }, 0);
    const subtotalElement = document.querySelector("#cart-subtotal");
    const totalElement = document.querySelector("#cart-total");
    if (subtotalElement) subtotalElement.textContent = money.format(subtotal);
    if (totalElement) totalElement.textContent = money.format(subtotal);
  };

  const loadProducts = async () => {
    try {
      const response = await fetch("api/produtos.php");
      if (!response.ok) throw new Error(`A API respondeu com status ${response.status}.`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("A resposta da API não contém uma lista de produtos.");

      const loadedProducts = data.map((item) => {
        const product = {
          id: Number(item.id),
          nome: String(item.nome ?? "").trim(),
          descricao: String(item.descricao ?? "").trim(),
          preco: Number(item.preco),
          estoque: Number(item.estoque),
          imagem: typeof item.imagem === "string" && item.imagem.trim() ? item.imagem.trim() : null,
          categoria: String(item.categoria ?? "").trim()
        };
        if (!Number.isSafeInteger(product.id) || product.id < 1 ||
          !product.nome || !product.categoria || !Number.isFinite(product.preco) || product.preco < 0 ||
          !Number.isSafeInteger(product.estoque) || product.estoque < 0) {
          throw new Error("A API retornou um produto com dados inválidos.");
        }
        return product;
      });
      if (new Set(loadedProducts.map((product) => product.id)).size !== loadedProducts.length) {
        throw new Error("A API retornou produtos com identificadores repetidos.");
      }

      products = loadedProducts;
      productById.clear();
      products.forEach((product) => productById.set(product.id, product));
      productsState = products.length ? "loaded" : "empty";
      addCategories();
      render();
      renderCart();
    } catch (error) {
      products = [];
      productById.clear();
      productsState = "error";
      console.error("Falha ao carregar os produtos:", error);
      render();
      renderCart();
    }
  };
  if (grid || cartItems) loadProducts();

  document.addEventListener("error", (event) => {
    const image = event.target;
    if (image instanceof HTMLImageElement && image.closest(".product-image-wrap, .hero-product-image, .promo-visual, .cart-item")) {
      if (image.closest(".product-image-wrap, .cart-item") &&
        image.dataset.fallbackApplied !== "true" &&
        image.src !== new URL(DEFAULT_PRODUCT_IMAGE, document.baseURI).href) {
        image.dataset.fallbackApplied = "true";
        image.src = DEFAULT_PRODUCT_IMAGE;
        return;
      }
      image.classList.add("image-unavailable");
      image.alt = "Imagem do produto indisponível";
    }
  }, true);

  document.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target.closest("button, a") : null;
    if (!target) return;
    if (target.hasAttribute("data-logout")) {
      event.preventDefault();
      target.disabled = true;
      postAuthRequest("logout")
        .then(() => {
          csrfToken = "";
          renderAccount(null);
          notify("Você saiu da sua conta.");
          window.setTimeout(() => window.location.assign("index.html"), 500);
        })
        .catch((error) => {
          console.error("Falha ao encerrar a sessão:", error);
          notify(error.message);
          target.disabled = false;
        });
      return;
    }
    const category = target.dataset.category;
    if (category) {
      event.preventDefault();
      selectedCategory = category;
      query = "";
      const search = document.querySelector("#site-search");
      if (search) search.value = "";
      document.querySelectorAll(".filter-pill").forEach((pill) => pill.classList.toggle("active", pill.dataset.category === category));
      render();
      document.querySelector("#produtos")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (target.hasAttribute("data-clear-filter")) {
      selectedCategory = "Todos";
      query = "";
      document.querySelectorAll(".filter-pill").forEach((pill) => pill.classList.toggle("active", pill.dataset.category === "Todos"));
      render();
      return;
    }
    if (target.dataset.cart !== undefined) {
      const productId = Number(target.dataset.cart);
      const product = productById.get(productId);
      if (!product) {
        notify("Não foi possível adicionar esse produto ao carrinho.");
        return;
      }
      if (product.estoque < 1) {
        notify("Este produto está indisponível no momento.");
        return;
      }
      const cart = loadCart();
      if (!cart) return;
      const existing = cart.find((item) => item.productId === productId);
      if (existing && existing.quantity >= product.estoque) {
        notify("A quantidade disponível deste produto já está no carrinho.");
        return;
      }
      const nextCart = existing
        ? cart.map((item) => item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item)
        : [...cart, { productId, quantity: 1 }];
      if (saveCart(nextCart)) {
        renderCart();
        notify(`${product.nome} adicionado ao carrinho.`);
      }
      return;
    }
    if (target.dataset.quantity !== undefined) {
      const productId = Number(target.dataset.productId);
      const cart = loadCart();
      if (!cart) return;
      const quantityChange = Number(target.dataset.quantity);
      const existing = cart.find((item) => item.productId === productId);
      const product = productById.get(productId);
      if (quantityChange > 0 && product && existing && existing.quantity >= product.estoque) {
        notify("A quantidade disponível deste produto já está no carrinho.");
        return;
      }
      const nextCart = cart.map((item) => item.productId === productId
        ? { ...item, quantity: Math.max(1, item.quantity + quantityChange) }
        : item);
      if (saveCart(nextCart)) renderCart();
      return;
    }
    if (target.dataset.remove !== undefined) {
      const productId = Number(target.dataset.remove);
      const cart = loadCart();
      if (!cart) return;
      if (saveCart(cart.filter((item) => item.productId !== productId))) {
        renderCart();
        notify("Produto removido do carrinho.");
      }
      return;
    }
    if (target.hasAttribute("data-checkout")) {
      const checkoutButton = target;
      if (checkoutButton.disabled) return;
      const cart = loadCart();
      if (!cart || cart.length === 0) {
        notify("Adicione produtos ao carrinho antes de finalizar o pedido.");
        return;
      }

      checkoutButton.disabled = true;
      const originalLabel = checkoutButton.innerHTML;
      checkoutButton.textContent = "Processando pedido...";
      try {
        const sessionResponse = await fetch("api/sessao.php", {
          credentials: "same-origin",
          cache: "no-store"
        });
        if (!sessionResponse.ok) throw new Error("Não foi possível verificar sua sessão. Tente novamente.");
        const session = await sessionResponse.json();
        if (!session.authenticated) {
          notify("Entre na sua conta para finalizar o pedido.");
          window.setTimeout(() => window.location.assign("login.html?retorno=carrinho"), 500);
          return;
        }
        if (typeof session.csrfToken !== "string" || !session.csrfToken) {
          throw new Error("Sua sessão precisa ser atualizada. Recarregue a página e tente novamente.");
        }

        const response = await fetch("api/pedidos.php", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            "X-CSRF-Token": session.csrfToken
          },
          body: new URLSearchParams({
            items: JSON.stringify(cart.map(({ productId, quantity }) => ({ productId, quantity })))
          })
        });
        let result;
        try {
          result = await response.json();
        } catch {
          throw new Error("Não foi possível processar a resposta do servidor.");
        }
        if (response.status === 401) {
          notify("Entre na sua conta para finalizar o pedido.");
          window.setTimeout(() => window.location.assign("login.html?retorno=carrinho"), 500);
          return;
        }
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Não foi possível finalizar seu pedido.");
        }

        try {
          localStorage.removeItem(CART_STORAGE_KEY);
          syncCartBadge();
        } catch (error) {
          console.error("O pedido foi registrado, mas não foi possível limpar o carrinho local:", error);
        }
        renderCart();
        notify(result.message);
        window.setTimeout(() => window.location.assign(`pedidos.html?pedido=${result.order.id}`), 650);
      } catch (error) {
        console.error("Falha ao finalizar o pedido:", error);
        notify(error.message);
      } finally {
        if (document.body.contains(checkoutButton)) {
          checkoutButton.disabled = false;
          checkoutButton.innerHTML = originalLabel;
        }
      }
      return;
    }
    if (target.dataset.favorite !== undefined) {
      const active = target.getAttribute("aria-pressed") !== "true";
      target.setAttribute("aria-pressed", String(active));
      target.textContent = active ? "♥" : "♡";
      const count = document.querySelector(".favorite-count");
      if (count) count.textContent = String(Math.max(0, Number(count.textContent) + (active ? 1 : -1)));
      notify(active ? "Produto adicionado aos favoritos." : "Produto removido dos favoritos.");
      return;
    }
    if (target.dataset.product !== undefined) {
      event.preventDefault();
      notify("Detalhes do produto estarão disponíveis em breve.");
      return;
    }
    if (target.dataset.toast) {
      event.preventDefault();
      notify(target.dataset.toast);
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.key === CART_STORAGE_KEY || event.key === null) {
      syncCartBadge();
      renderCart();
    }
  });

  document.querySelectorAll(".filter-pill").forEach((pill) => pill.addEventListener("click", () => {
    selectedCategory = pill.dataset.category;
    document.querySelectorAll(".filter-pill").forEach((item) => item.classList.toggle("active", item === pill));
    render();
  }));
  const searchForm = document.querySelector(".search-form");
  const searchInput = document.querySelector("#site-search");
  if (searchForm && searchInput) {
    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      selectedCategory = "Todos";
      query = searchInput.value.trim();
      document.querySelectorAll(".filter-pill").forEach((pill) => pill.classList.toggle("active", pill.dataset.category === "Todos"));
      render();
      document.querySelector("#produtos")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    searchInput.addEventListener("input", () => {
      if (!searchInput.value.trim()) {
        query = "";
        render();
      }
    });
  }

  document.querySelectorAll("[data-password-toggle]").forEach((button) => button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.passwordToggle);
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
    button.setAttribute("aria-label", input.type === "password" ? "Mostrar senha" : "Ocultar senha");
    button.classList.toggle("is-visible", input.type === "text");
  }));
  document.querySelectorAll("[data-auth-form]").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const isSignup = form.dataset.authForm === "signup";
    const password = form.elements.namedItem("senha");
    const confirmation = form.elements.namedItem("confirm-password");
    if (isSignup && password.value !== confirmation.value) {
      confirmation.setCustomValidity("As senhas não coincidem.");
      confirmation.reportValidity();
      confirmation.addEventListener("input", () => confirmation.setCustomValidity(""), { once: true });
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const originalButton = submitButton ? submitButton.innerHTML : "";
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = isSignup ? "Criando sua conta..." : "Entrando...";
    }

    try {
      const fields = isSignup
        ? {
          nome: form.elements.namedItem("nome").value,
          email: form.elements.namedItem("email").value,
          senha: password.value
        }
        : {
          email: form.elements.namedItem("email").value,
          senha: password.value
        };
      const data = await postAuthRequest(isSignup ? "cadastro" : "login", fields);

      if (isSignup) {
        form.reset();
        window.location.assign("login.html?cadastro=sucesso");
        return;
      }

      csrfToken = data.csrfToken;
      renderAccount(data.user);
      form.reset();
      const returnPage = new URLSearchParams(window.location.search).get("retorno");
      window.location.assign(returnPage === "carrinho"
        ? "carrinho.html"
        : returnPage === "pedidos"
          ? "pedidos.html"
          : "index.html");
    } catch (error) {
      console.error(`Falha no ${isSignup ? "cadastro" : "login"}:`, error);
      notify(error.message);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButton;
      }
    }
  }));
});
