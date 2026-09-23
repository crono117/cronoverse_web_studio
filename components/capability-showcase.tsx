"use client";

import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { ArrowDownUp, ArrowLeft, ArrowRight, ArrowUpRight, Building2, CalendarDays, Check, Headphones, LayoutTemplate, Minus, Package, Plus, Search, Shirt, ShoppingBag, Table2, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";

type Language = "en" | "es";
type DemoProps = { lang: Language };
const words = (lang: Language) => (en: string, es: string) => lang === "en" ? en : es;
const dollars = (value: number, lang: Language) => new Intl.NumberFormat(lang === "en" ? "en-US" : "es-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
const demos = [
  { name: ["Inventory", "Inventario"], title: ["A store that stays in sync.", "Una tienda al día."], hint: ["Find a product and adjust its stock.", "Busca un producto y ajusta su stock."], icon: ShoppingBag, component: InventoryDemo },
  { name: ["Landing page", "Landing page"], title: ["A first impression with personality.", "Una primera impresión con personalidad."], hint: ["Try another color and explore the page.", "Cambia el color y explora la página."], icon: LayoutTemplate, component: LandingDemo },
  { name: ["Business profile", "Perfil"], title: ["Your business, clearly presented.", "Tu negocio, bien presentado."], hint: ["Explore services and preview an appointment.", "Explora servicios y prueba una cita."], icon: Building2, component: ProfileDemo },
  { name: ["Data grid", "Datos"], title: ["Find the details that matter.", "Encuentra los datos que importan."], hint: ["Search, filter, or sort by order total.", "Busca, filtra u ordena por total."], icon: Table2, component: GridDemo },
  { name: ["Charts", "Gráficos"], title: ["Turn numbers into a clear picture.", "Dale claridad a tus números."], hint: ["Change the period or compare sales channels.", "Cambia el período o compara canales de venta."], icon: TrendingUp, component: GraphDemo },
];

export function CapabilityShowcase({ lang }: DemoProps) {
  const t = words(lang), languageIndex = lang === "en" ? 0 : 1;
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!api) return;
    const update = () => setCurrent(api.selectedScrollSnap());
    update(); api.on("select", update); api.on("reInit", update);
    return () => { api.off("select", update); api.off("reInit", update); };
  }, [api]);
  function navigateKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.target as Element).closest("input,button,textarea,select,a,[role=slider],[data-slot=chart],[role=tablist],[role=group][data-slot=toggle-group]")) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      api?.scrollTo(current + (event.key === "ArrowLeft" ? -1 : 1), reducedMotion);
    }
  }
  return <div className="capability-showcase">
    <Carousel setApi={setApi} opts={{ loop: true, watchFocus: false, watchDrag: (_api, event) => !(event.target instanceof Element && event.target.closest("button,input,select,textarea,a,[data-slot=chart]")) }} onKeyDownCapture={navigateKeyboard} aria-label={t("Interactive website examples", "Ejemplos web interactivos")} tabIndex={0}>
      <div className="showcase-topline"><span>{t("THE POSSIBILITIES / TRY IT", "LAS POSIBILIDADES / PRUÉBALO")}</span><span className="showcase-demo-label">{t("Demo · sample data", "Demo · datos de ejemplo")}</span></div>
      <div className="showcase-categories" aria-label={t("Choose an example", "Elige un ejemplo")}>
        {demos.map((demo, i) => <Button type="button" variant="ghost" key={demo.name[0]} aria-pressed={current === i} onClick={() => api?.scrollTo(i, reducedMotion)}><demo.icon size={16}/>{demo.name[languageIndex]}</Button>)}
      </div>
      <CarouselContent className="showcase-track">
        {demos.map((demo, i) => <CarouselItem key={demo.name[0]} className="showcase-slide" inert={i !== current} aria-hidden={i !== current} aria-label={`${i + 1} / ${demos.length}: ${demo.name[languageIndex]}`}>
          <div className="showcase-browser"><div className="showcase-browser-bar"><span aria-hidden="true">○ ○ ○</span><span>{demo.name[languageIndex]}</span><span className="demo-browser-tag">{t("PREVIEW", "VISTA PREVIA")}</span></div><div className="demo-stage"><demo.component lang={lang}/></div></div>
        </CarouselItem>)}
      </CarouselContent>
      <div className="showcase-caption"><div aria-live="polite" aria-atomic="true"><h3>{demos[current].title[languageIndex]}</h3><p>{demos[current].hint[languageIndex]}</p></div><div className="showcase-arrows"><Button type="button" variant="outline" size="icon" aria-label={t("Previous example", "Ejemplo anterior")} onClick={() => api?.scrollPrev(reducedMotion)}><ArrowLeft/></Button><span>{String(current + 1).padStart(2, "0")} / 05</span><Button type="button" variant="outline" size="icon" aria-label={t("Next example", "Siguiente ejemplo")} onClick={() => api?.scrollNext(reducedMotion)}><ArrowRight/></Button></div></div>
    </Carousel>
  </div>;
}

const products = [
  { name: ["Studio headphones", "Audífonos Studio"], sku: "AU-101", price: 89, stock: 12, icon: Headphones },
  { name: ["Everyday tote", "Bolso Everyday"], sku: "BG-204", price: 24, stock: 4, icon: ShoppingBag },
  { name: ["Coast tee", "Camiseta Coast"], sku: "TS-310", price: 32, stock: 18, icon: Shirt },
  { name: ["Desk organizer", "Organizador de escritorio"], sku: "DK-042", price: 38, stock: 7, icon: Package },
];
function InventoryDemo({ lang }: DemoProps) {
  const t = words(lang), index = lang === "en" ? 0 : 1;
  const [query, setQuery] = useState("");
  const [stock, setStock] = useState(products.map(p => p.stock));
  const [notice, setNotice] = useState<{ product: number; stock: number } | null>(null);
  const visible = products.map((product, i) => ({ ...product, i })).filter(p => `${p.name[index]} ${p.sku}`.toLowerCase().includes(query.toLowerCase()));
  function adjust(i: number, change: number) {
    const next = Math.min(99, Math.max(0, stock[i] + change));
    setStock(values => values.map((value, j) => j === i ? next : value));
    setNotice({ product: i, stock: next });
  }
  return <div className="inventory-demo"><div className="demo-heading"><div><span className="demo-kicker">PACIFIC SUPPLY</span><h4>{t("Product inventory", "Inventario de productos")}</h4></div><span className="inventory-total"><strong>{stock.reduce((a, b) => a + b, 0)}</strong>{t("units", "unidades")}</span></div>
    <div className="demo-search"><Search size={17}/><Input aria-label={t("Search products", "Buscar productos")} placeholder={t("Search products or SKU…", "Buscar productos o SKU…")} value={query} onChange={e => setQuery(e.target.value)}/></div>
    <div className="stock-list">{visible.map(product => <div className="stock-row" key={product.sku}><span className="stock-icon"><product.icon size={21}/></span><div><strong>{product.name[index]}</strong><span>{product.sku} · {dollars(product.price, lang)}{stock[product.i] < 5 && <em>{t("Low stock", "Stock bajo")}</em>}</span></div><div className="stock-stepper"><Button type="button" variant="ghost" size="icon-sm" disabled={stock[product.i] === 0} aria-label={`${t("Decrease stock for", "Reducir stock de")} ${product.name[index]}`} onClick={() => adjust(product.i, -1)}><Minus size={14}/></Button><span>{stock[product.i]}</span><Button type="button" variant="ghost" size="icon-sm" disabled={stock[product.i] === 99} aria-label={`${t("Increase stock for", "Aumentar stock de")} ${product.name[index]}`} onClick={() => adjust(product.i, 1)}><Plus size={14}/></Button></div></div>)}</div>
    {!visible.length && <p className="demo-empty">{t("No matching products. Try another search.", "No hay productos. Prueba otra búsqueda.")}</p>}
    <p className="demo-note" role="status">{notice ? `${products[notice.product].name[index]}: ${notice.stock} ${t("in stock", "en stock")}` : t("Try + / − to update the available stock.", "Prueba + / − para actualizar el stock disponible.")}</p>
  </div>;
}

function LandingDemo({ lang }: DemoProps) {
  const t = words(lang);
  const [theme, setTheme] = useState("blue");
  const [details, setDetails] = useState(false);
  return <div className="landing-demo"><div className="demo-toolbar"><span>{t("Make it yours", "Dale tu estilo")}</span><ToggleGroup type="single" value={theme} onValueChange={v => v && setTheme(v)} aria-label={t("Landing page accent", "Color de la landing page")}><ToggleGroupItem value="blue">{t("Blue", "Azul")}</ToggleGroupItem><ToggleGroupItem value="coral">Coral</ToggleGroupItem></ToggleGroup></div>
    <div className={`landing-preview landing-${theme}`}><div className="landing-mini-brand">COAST / STUDIO <span>EST. 2026</span></div><div className="landing-mini-hero"><img src="/hero-digital-palms.png" alt="" loading="lazy"/><div><span className="demo-kicker">{t("MADE FOR WHAT'S NEXT", "CREADO PARA LO QUE VIENE")}</span><h4>{t("Stand out.\nMake waves.", "Destaca.\nDeja huella.")}</h4><p>{t("A fresh perspective for your next big idea.", "Una nueva mirada para tu próxima gran idea.")}</p><Button type="button" aria-expanded={details} className="landing-demo-cta" onClick={() => setDetails(v => !v)}>{details ? t("Back to the vision", "Volver a la visión") : t("Explore the vision", "Explora la visión")}<ArrowUpRight size={16}/></Button></div></div><div className="landing-mini-bottom" role="status">{details ? t("A clear story. A bold design. An invitation to connect.", "Una historia clara. Un diseño audaz. Una invitación a conectar.") : t("DESIGN WITH PURPOSE · SOUTHERN CALIFORNIA", "DISEÑO CON PROPÓSITO · SUR DE CALIFORNIA")}</div></div>
  </div>;
}

function ProfileDemo({ lang }: DemoProps) {
  const t = words(lang);
  const [booking, setBooking] = useState(false);
  const [slot, setSlot] = useState("");
  return <div className="profile-demo"><div className="profile-cover"><span>PS</span><Building2 size={37} strokeWidth={1}/></div><div className="profile-summary"><h4>Pacific Studio</h4><p>{t("Independent design studio · Orange County", "Estudio de diseño independiente · Orange County")}</p></div>
    <Tabs defaultValue="services"><TabsList aria-label={t("Business profile details", "Detalles del negocio")}><TabsTrigger value="services">{t("Services", "Servicios")}</TabsTrigger><TabsTrigger value="about">{t("About", "Nosotros")}</TabsTrigger></TabsList><TabsContent value="services"><div className="profile-services">{[t("Brand identity", "Identidad de marca"), t("Website design", "Diseño web"), t("Digital strategy", "Estrategia digital")].map(label => <span key={label}><Check size={15}/>{label}</span>)}</div></TabsContent><TabsContent value="about"><p className="profile-about">{t("A small creative studio helping local businesses tell a clearer story, online and beyond. English and Spanish welcome.", "Un pequeño estudio creativo que ayuda a negocios locales a contar su historia en línea y más allá. Hablamos español e inglés.")}</p></TabsContent></Tabs>
    <Button type="button" className="profile-book" onClick={() => setBooking(v => !v)} aria-expanded={booking}><CalendarDays size={16}/>{booking ? t("Close availability", "Cerrar horarios") : t("Explore availability", "Ver horarios")}</Button>
    {booking && <div className="profile-booking"><div className="profile-slots">{["10:00 AM", "1:00 PM", "3:30 PM"].map(time => <Button type="button" key={time} variant="outline" aria-pressed={slot === time} onClick={() => setSlot(time)}>{time}</Button>)}</div><p role="status">{slot ? `${t("Selected", "Seleccionado")}: ${slot}. ${t("Demo only — no appointment booked.", "Solo es una demo; no se reservó una cita.")}` : t("Choose a sample time to preview a booking.", "Elige un horario de ejemplo para probar una reserva.")}</p></div>}
  </div>;
}

const orders = [
  { id: "#1048", customer: "Coast Coffee", total: 280, paid: true },
  { id: "#1049", customer: "Studio North", total: 640, paid: false },
  { id: "#1050", customer: "Pacific Goods", total: 195, paid: true },
  { id: "#1051", customer: "Mesa Market", total: 420, paid: false },
  { id: "#1052", customer: "Sunset Supply", total: 350, paid: true },
];
function GridDemo({ lang }: DemoProps) {
  const t = words(lang);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<"asc" | "desc" | null>(null);
  const rows = orders.filter(row => (filter === "all" || !row.paid) && `${row.id} ${row.customer}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort ? (sort === "asc" ? a.total - b.total : b.total - a.total) : 0);
  return <div className="grid-demo"><div className="demo-heading"><div><span className="demo-kicker">{t("THE ORDER DESK", "CENTRAL DE PEDIDOS")}</span><h4>{t("Every detail, in view.", "Cada detalle, a la vista.")}</h4></div><Table2 size={24}/></div><div className="demo-search"><Search size={17}/><Input aria-label={t("Search orders", "Buscar pedidos")} placeholder={t("Search a customer or order…", "Buscar cliente o pedido…")} value={query} onChange={e => setQuery(e.target.value)}/></div><div className="demo-toolbar"><ToggleGroup type="single" value={filter} onValueChange={v => v && setFilter(v)} aria-label={t("Order status", "Estado del pedido")}><ToggleGroupItem value="all">{t("All orders", "Todos")}</ToggleGroupItem><ToggleGroupItem value="pending">{t("Pending", "Pendientes")}</ToggleGroupItem></ToggleGroup><span aria-live="polite">{rows.length} {rows.length === 1 ? t("result", "resultado") : t("results", "resultados")}</span></div>
    <Table className="demo-orders-table"><TableHeader><TableRow><TableHead>{t("Customer", "Cliente")}</TableHead><TableHead>{t("Status", "Estado")}</TableHead><TableHead aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : "none"}><button type="button" className="demo-sort" onClick={() => setSort(v => v === "asc" ? "desc" : "asc")}>{t("Total", "Total")}<ArrowDownUp size={14}/></button></TableHead></TableRow></TableHeader><TableBody>{rows.map(row => <TableRow key={row.id}><TableCell><strong>{row.customer}</strong><small>{row.id}</small></TableCell><TableCell><span className={`order-status ${row.paid ? "paid" : "pending"}`}>{row.paid ? t("Paid", "Pagado") : t("Pending", "Pendiente")}</span></TableCell><TableCell>{dollars(row.total, lang)}</TableCell></TableRow>)}</TableBody></Table>
    {!rows.length && <p className="demo-empty">{t("No matching orders. Try another search or filter.", "No hay pedidos. Prueba otra búsqueda o filtro.")}</p>}
  </div>;
}

const sales = [
  { online: 1800, store: 1400 }, { online: 2200, store: 1800 }, { online: 2000, store: 1600 }, { online: 2700, store: 2000 }, { online: 3100, store: 2300 }, { online: 3400, store: 2200 },
  { online: 2800, store: 2400 }, { online: 3100, store: 2000 }, { online: 2700, store: 2200 }, { online: 4300, store: 2800 }, { online: 5200, store: 2600 }, { online: 6100, store: 3200 },
];
function GraphDemo({ lang }: DemoProps) {
  const t = words(lang), gradientId = useId().replace(/:/g, "");
  const [period, setPeriod] = useState("6");
  const [channels, setChannels] = useState(["online", "store"]);
  const data = sales.map((row, i) => ({ ...row, month: new Intl.DateTimeFormat(lang === "en" ? "en-US" : "es-US", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, i, 1))) })).slice(-Number(period));
  const total = data.reduce((sum, row) => sum + (channels.includes("online") ? row.online : 0) + (channels.includes("store") ? row.store : 0), 0);
  return <div className="graph-demo"><div className="demo-heading"><div><span className="demo-kicker">{t("SAMPLE SALES", "VENTAS DE EJEMPLO")}</span><h4 aria-live="polite">{dollars(total, lang)}</h4></div><ToggleGroup type="single" value={period} onValueChange={v => v && setPeriod(v)} aria-label={t("Chart period", "Período del gráfico")}><ToggleGroupItem value="6">6 {t("months", "meses")}</ToggleGroupItem><ToggleGroupItem value="12">12 {t("months", "meses")}</ToggleGroupItem></ToggleGroup></div>
    <ChartContainer className="demo-chart" config={{ online: { label: t("Online", "En línea"), color: "#175ddd" }, store: { label: t("In store", "En tienda"), color: "#c83f5c" } }} aria-label={t("Sample monthly sales in US dollars. Use the controls to change the period and channels.", "Ventas mensuales de ejemplo en dólares. Usa los controles para cambiar período y canales.")}>
      <AreaChart data={data} accessibilityLayer margin={{ left: 0, right: 9, top: 18, bottom: 0 }}><defs><linearGradient id={`${gradientId}-online`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#175ddd" stopOpacity={.28}/><stop offset="100%" stopColor="#175ddd" stopOpacity={.015}/></linearGradient><linearGradient id={`${gradientId}-store`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c83f5c" stopOpacity={.14}/><stop offset="100%" stopColor="#c83f5c" stopOpacity={.01}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#dce3ed"/><XAxis dataKey="month" tickLine={false} axisLine={false} minTickGap={18} tick={{ fontSize: 12 }}/><YAxis tickLine={false} axisLine={false} width={43} tickFormatter={v => `$${v / 1000}k`} tick={{ fontSize: 12 }}/><ChartTooltip formatter={(value, name) => [dollars(Number(value ?? 0), lang), name === "online" ? t("Online", "En línea") : t("In store", "En tienda")]} contentStyle={{ border: "1px solid #d1dbea", borderRadius: 4, fontSize: 13, color: "#19263c" }}/>{channels.includes("online") && <Area type="monotone" dataKey="online" stroke="#175ddd" strokeWidth={2.5} fill={`url(#${gradientId}-online)`} isAnimationActive={false}/>} {channels.includes("store") && <Area type="monotone" dataKey="store" stroke="#c83f5c" strokeWidth={2.5} fill={`url(#${gradientId}-store)`} isAnimationActive={false}/>}</AreaChart>
    </ChartContainer>
    <ToggleGroup className="chart-channel-controls" type="multiple" value={channels} onValueChange={v => v.length && setChannels(v)} aria-label={t("Visible sales channels", "Canales de venta visibles")}><ToggleGroupItem value="online"><span className="chart-series-mark online"/>{t("Online", "En línea")}</ToggleGroupItem><ToggleGroupItem value="store"><span className="chart-series-mark store"/>{t("In store", "En tienda")}</ToggleGroupItem></ToggleGroup><p className="demo-note">{t("Hover or tap the chart to inspect a month.", "Pasa el cursor o toca el gráfico para ver un mes.")}</p>
  </div>;
}
