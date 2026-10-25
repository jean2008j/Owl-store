import { create } from "zustand";
import { toast } from "sonner";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  CATALOG_VERSION,
  cloneSeed,
  defaultSettings,
  normalizeContent,
  type Lang,
  type SiteContent,
  type CartLine,
  type Order,
  type Product,
  type Settings,
  type Size,
} from "@/lib/store/catalog";

import {
  isSupabaseConfigured,
  deleteProductFromDatabase,
  upsertSiteContentToDatabase,
  upsertPaymentSettings,
  updateOrderStatusInDatabase,
  upsertProductToDatabase,
} from "@/lib/db-service";

const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();
function syncProduct(id: string) {
  clearTimeout(syncTimers.get(id));
  syncTimers.set(
    id,
    setTimeout(() => {
      const product = useOwl.getState().products.find((item) => item.id === id);
      if (!product) return;
      void upsertProductToDatabase(product).then((res) => {
        if (res && !res.ok) toast.error(`المنتج ما انحفظ بقاعدة البيانات: ${res.message}`);
      });
    }, 700),
  );
}

let contentTimer: ReturnType<typeof setTimeout> | undefined;
function syncContent() {
  clearTimeout(contentTimer);
  contentTimer = setTimeout(() => {
    void upsertSiteContentToDatabase(useOwl.getState().settings.content);
  }, 900);
}

let paymentTimer: ReturnType<typeof setTimeout> | undefined;
function syncPayment() {
  clearTimeout(paymentTimer);
  paymentTimer = setTimeout(() => {
    const { shamCashId, shamCashName, shamCashQr } = useOwl.getState().settings;
    void upsertPaymentSettings({ shamCashId, shamCashName, shamCashQr }).then((res) => {
      if (res && !res.ok) toast.error(`إعدادات شام كاش ما انحفظت بقاعدة البيانات: ${res.message}`);
    });
  }, 900);
}

type OwlState = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;
  updateContent: (lang: Lang, patch: Partial<SiteContent>) => void;
  settings: Settings;
  products: Product[];
  cart: CartLine[];
  orders: Order[];
  adminUnlocked: boolean;
  secretUnlocked: boolean; // in memory only: the customer must enter the code on every visit
  secretAccess: string;
  catalogVersion: number;
  hydrated: boolean;
  cartOpen: boolean;
  searchOpen: boolean;
  setCartOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setHydrated: (hydrated: boolean) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  addProduct: (product: Product) => void;
  removeProduct: (id: string) => void;
  restoreCatalog: () => void;
  addLine: (line: CartLine) => void;
  setQty: (line: CartLine, qty: number) => void;
  removeLine: (line: CartLine) => void;
  clearCart: () => void;
  placeOrder: (order: Order) => void;
  setOrderStatus: (ref: string, status: Order["status"]) => Promise<{ ok: boolean; message?: string }>;
  unlockSecret: (code: string, rows?: Product[]) => void;
  lockSecret: () => void;
  unlockAdmin: () => void;
  lockAdmin: () => void;
};

const sameLine = (a: CartLine, b: CartLine) =>
  a.productId === b.productId &&
  a.size === b.size &&
  a.fit === b.fit &&
  a.colorId === b.colorId;

function memoryStorage() {
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

const browserStorage = {
  getItem: (name: string) => localStorage.getItem(name),
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      /* quota — keep the in-memory order */
      toast.error("مساحة التخزين بالمتصفح ممتلئة، ممكن المنتج يختفي بعد تحديث الصفحة. صوره كبيرة.");
    }
  },
  removeItem: (name: string) => localStorage.removeItem(name),
};

export const useOwl = create<OwlState>()(
  persist(
    (set) => ({
      lang: "en",
      setLang: (lang) => set({ lang }),
      theme: "dark",
      setTheme: (theme) => set({ theme }),
      updateContent: (lang, patch) => {
        set((state) => ({
          settings: {
            ...state.settings,
            content: {
              ...state.settings.content,
              [lang]: { ...state.settings.content[lang], ...patch },
            },
          },
        }));
        syncContent();
      },
      settings: defaultSettings,
      products: cloneSeed(),
      cart: [],
      orders: [],
      adminUnlocked: false,
      secretUnlocked: false,
      secretAccess: "",
      catalogVersion: CATALOG_VERSION,
      hydrated: false,
      cartOpen: false,
      searchOpen: false,
      setCartOpen: (cartOpen) =>
        set(cartOpen ? { cartOpen: true, searchOpen: false } : { cartOpen: false }),
      setSearchOpen: (searchOpen) =>
        set(searchOpen ? { searchOpen: true, cartOpen: false } : { searchOpen: false }),
      setHydrated: (hydrated) => set({ hydrated }),
      updateSettings: (patch) => {
        set((state) => ({ settings: { ...state.settings, ...patch } }));
        if ("shamCashId" in patch || "shamCashName" in patch || "shamCashQr" in patch) syncPayment();
      },
      updateProduct: (id, patch) => {
        set((state) => ({
          products: state.products.map((product) =>
            product.id === id ? { ...product, ...patch } : product,
          ),
        }));
        syncProduct(id);
      },
      addProduct: (product) => {
        set((state) => ({ products: [product, ...state.products] }));
        syncProduct(product.id);
      },
      removeProduct: (id) => {
        set((state) => ({
          products: state.products.filter((product) => product.id !== id),
          cart: state.cart.filter((line) => line.productId !== id),
        }));
        void deleteProductFromDatabase(id);
      },
      restoreCatalog: () =>
        set((state) => ({
          products: cloneSeed(),
          settings: {
            ...defaultSettings,
            shamCashId: state.settings.shamCashId,
            shamCashName: state.settings.shamCashName,
            shamCashQr: state.settings.shamCashQr,
            telegramBotToken: state.settings.telegramBotToken,
            telegramChatId: state.settings.telegramChatId,
            adminPin: state.settings.adminPin,
            secretCode: state.settings.secretCode,
          },
          catalogVersion: CATALOG_VERSION,
        })),
      addLine: (line) =>
        set((state) => {
          const index = state.cart.findIndex((item) => sameLine(item, line));
          const cart = [...state.cart];
          if (index >= 0) {
            cart[index] = { ...cart[index], qty: cart[index].qty + line.qty };
          } else {
            cart.push(line);
          }
          return { cart, cartOpen: true, searchOpen: false };
        }),
      setQty: (line, qty) =>
        set((state) => ({
          cart:
            qty <= 0
              ? state.cart.filter((item) => !sameLine(item, line))
              : state.cart.map((item) => (sameLine(item, line) ? { ...item, qty } : item)),
        })),
      removeLine: (line) =>
        set((state) => ({
          cart: state.cart.filter((item) => !sameLine(item, line)),
        })),
      clearCart: () => set({ cart: [] }),
      placeOrder: (order) =>
        set((state) => ({
          orders: [order, ...state.orders].slice(0, 30),
          cart: [],
          cartOpen: false,
          products: state.products.map((product) => {
            const lines = order.items.filter((item) => item.productId === product.id);
            if (!lines.length) return product;
            const next: Record<Size, number> = { ...product.stock };
            const byColor = product.colorStock ? { ...product.colorStock } : undefined;
            for (const item of lines) {
              next[item.size] = Math.max(0, (next[item.size] ?? 0) - item.qty);
              if (byColor && item.colorId && byColor[item.colorId]) {
                const row = { ...byColor[item.colorId] };
                row[item.size] = Math.max(0, (row[item.size] ?? 0) - item.qty);
                byColor[item.colorId] = row;
              }
            }
            return { ...product, stock: next, ...(byColor ? { colorStock: byColor } : {}) };
          }),
        })),
      setOrderStatus: async (ref, status) => {
        const before = useOwl.getState().orders.find((order) => order.ref === ref);
        if (before?.status === "cancelled" && status !== "cancelled") {
          return { ok: false, message: "الطلب الملغى لا يمكن إعادته. أنشئ طلبًا جديدًا." };
        }
        const res = await updateOrderStatusInDatabase(ref, status);
        if (!res?.ok) return { ok: false, message: res?.message };
        set((state) => ({
          orders: state.orders.map((order) =>
            order.ref === ref ? { ...order, status } : order,
          ),
          // Local (no database) mode: give the stock of a cancelled order back. With Supabase the trigger does it and products are re-fetched.
          products:
            !isSupabaseConfigured && status === "cancelled" && before && before.status !== "cancelled"
              ? state.products.map((product) => {
                  const lines = before.items.filter((item) => item.productId === product.id);
                  if (!lines.length) return product;
                  const next: Record<Size, number> = { ...product.stock };
                  const byColor = product.colorStock ? { ...product.colorStock } : undefined;
                  for (const item of lines) {
                    next[item.size] = (next[item.size] ?? 0) + item.qty;
                    if (byColor && item.colorId && byColor[item.colorId]) {
                      const row = { ...byColor[item.colorId] };
                      row[item.size] = (row[item.size] ?? 0) + item.qty;
                      byColor[item.colorId] = row;
                    }
                  }
                  return { ...product, stock: next, ...(byColor ? { colorStock: byColor } : {}) };
                })
              : state.products,
        }));
        return { ok: true };
      },
      unlockSecret: (code, rows) =>
        set((state) => {
          if (!rows) return { secretUnlocked: true, secretAccess: code };
          const ids = new Set(rows.map((row) => row.id));
          return {
            secretUnlocked: true,
            secretAccess: code,
            products: [...state.products.filter((product) => !ids.has(product.id)), ...rows],
          };
        }),
      lockSecret: () =>
        set((state) => {
          // Pieces from the secret section must not stay in the bag (or in memory with Supabase) once it is locked.
          const secretIds = new Set(state.products.filter((product) => product.secret).map((product) => product.id));
          return {
            secretUnlocked: false,
            secretAccess: "",
            cart: state.cart.filter((line) => !secretIds.has(line.productId)),
            products: isSupabaseConfigured
              ? state.products.filter((product) => !product.secret)
              : state.products,
          };
        }),
      unlockAdmin: () => set({ adminUnlocked: true }),
      lockAdmin: () => set({ adminUnlocked: false }),
    }),
    {
      name: "owl-store",
      skipHydration: true,
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? memoryStorage() : browserStorage,
      ),
      // Older saved data has no per-language content — fill it from the defaults.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<OwlState>;
        const savedSettings = (saved.settings ?? {}) as Partial<Settings>;
        return {
          ...current,
          ...saved,
          settings: {
            ...current.settings,
            ...savedSettings,
            content: normalizeContent(savedSettings.content),
          },
        };
      },
      partialize: (state) => ({
        lang: state.lang,
        theme: state.theme,
        settings: state.settings,
        // with Supabase the secret products are never kept on the visitor's device
        products: isSupabaseConfigured
          ? state.products.filter((product) => !product.secret)
          : state.products,
        // with Supabase the secret pieces are not kept on the device, so they are not kept in the saved bag either
        cart: isSupabaseConfigured
          ? state.cart.filter(
              (line) => !state.products.find((product) => product.id === line.productId)?.secret,
            )
          : state.cart,
        // the receipt photo (big base64) goes to Telegram only; keeping it here fills the browser storage
        orders: state.orders.map((order) => ({ ...order, receiptDataUrl: "" })),
        adminUnlocked: state.adminUnlocked,
        catalogVersion: state.catalogVersion,
      }),
    },
  ),
);

export function lineQtyInCart(cart: CartLine[], line: Omit<CartLine, "qty">) {
  return cart.find(
    (item) =>
      item.productId === line.productId &&
      item.size === line.size &&
      item.fit === line.fit &&
      item.colorId === line.colorId,
  )?.qty ?? 0;
}
