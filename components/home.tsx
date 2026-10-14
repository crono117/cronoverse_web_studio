"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, ArrowRight, Check, Menu, X, LoaderCircle, MonitorSmartphone, LayoutDashboard, Workflow, MessagesSquare, ClipboardCheck, Puzzle, Languages, FlaskConical, Globe2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

import { DustSurface } from "@/components/dust-surface";
import dynamic from "next/dynamic";
import { HeroScenes } from "@/components/hero-scenes";
import { trackEvent, trackInquirySuccess } from "@/lib/analytics";
import { Captcha, type CaptchaHandle } from "@/components/captcha";
import { LANGUAGE_COOKIE, LANGUAGE_STORAGE_KEY, isLanguage, pageMeta, type Language } from "@/lib/site";

// Form service values, in display order. They match Inquiry.Service in the Django backend.
const ids = ["new", "redesign", "software", "automation", "unsure"] as const;
type ServiceId = typeof ids[number];
type Field = "name" | "email" | "service" | "message";
type FieldError = "required" | "short" | "invalid";

const copy = {
 en: {
  skip:"Skip to content", navLabel:"Main navigation", menuLabel:"Toggle navigation", homeLabel:"Cronoverse home",
  nav:{services:"Services", examples:"Examples", why:"Why us", process:"Process", contact:"Let's talk"},
  studio:"WEB DEVELOPMENT & BUSINESS SOFTWARE · SOUTHERN CALIFORNIA", title:["Your competition is upgrading right\u00a0now.","Are you?"],
  intro:"Customers compare you in seconds, and an outdated site sends them to whoever looks sharper. We build fast, modern websites and custom software that make you the obvious choice.",
  cta:"Start Your Project", explore:"See What We Build", serviceLineLabel:"What we build", serviceLine:["Custom websites","Business applications","Automation","Integrations"],
  photo:"THE GOLDEN STATE. A FRESH PERSPECTIVE.", heroAlt:"Surreal illustrated California palm trees with electric-blue edges and digital fragments above a coral sunset",
  band:"Serving Orange County and businesses throughout Southern California.", bandLang:"English & Español",
  eyebrow:"01 / WHAT WE BUILD", heading:"What does your business need?",
  serviceIntro:"A better website? Less manual work? Software that actually fits how you operate? We build practical digital solutions for businesses ready to improve how they work.",
  services:[
   {id:"new", kicker:"WEBSITES", title:"Websites That Work for Your Business", desc:"Your website should do more than look good. It should explain what you offer, make a strong first impression, and help customers get in touch.", items:["Business websites and landing pages","Website redesigns","Mobile-friendly development","Lead capture and contact forms"], cta:"Build My Website"},
   {id:"software", kicker:"BUSINESS SOFTWARE", title:"Software Built Around Your Business", desc:"Stop forcing your business to work around disconnected spreadsheets and systems. Get tools designed for the way your team actually works.", items:["Inventory and order management","Customer and staff portals","Reporting dashboards","Scheduling and operational tools"], cta:"Explore Custom Software"},
   {id:"automation", kicker:"AUTOMATION & INTEGRATIONS", title:"Connect Your Tools. Cut the Busywork.", desc:"Your systems should work together. We connect applications, synchronize information, and automate repetitive tasks to help your business run more efficiently.", items:["API integrations","Workflow automation","Data synchronization","Internal business tools"], cta:"Simplify My Workflow"},
  ],
  examplesEyebrow:"02 / SEE WHAT'S POSSIBLE", examplesTitle:"Don't just take our word for it. Try it.",
  examplesText:"Explore interactive examples of websites and business tools we can build. Search an inventory, manage sample orders, or explore a sales dashboard.",
  examplesNote:"Interactive demonstrations using sample data.", examplesCta:"Need something like this? Let's build it.",
  whyEyebrow:"03 / WHY CRONOVERSE", whyTitle:"Work directly with the people building your project.",
  whyText:"No confusing agency process. No unnecessary features. We focus on understanding your business, building the right solution, and making sure you know how to use it.",
  whyItems:[
   {title:"Direct communication", text:"Discuss your requirements with the developer working on your project."},
   {title:"A clear plan", text:"Understand the scope, features, and expectations before development begins."},
   {title:"Built around your business", text:"Get the functionality you need without unnecessary complexity."},
   {title:"English & Spanish", text:"Discuss your project in the language you're most comfortable using."},
  ],
  processEyebrow:"04 / HOW WE WORK", processTitle:"From idea to working product.",
  steps:[
   {title:"Tell us what you need.", text:"Explain your business, the problem you're trying to solve, and what you want to accomplish."},
   {title:"We plan and build.", text:"We define the scope, design the experience, and develop your solution with opportunities for feedback."},
   {title:"Launch with confidence.", text:"We test, refine, and help you launch. You'll get a walkthrough of how your new website or application works."},
  ],
  contactEyebrow:"05 / START YOUR PROJECT", contactTitle:"Tell us what you need. We'll figure out how to build it.",
  contactText:["Need a new website? Want to replace an outdated system? Have a business process that takes too much time?","Tell us about your project. We'll discuss what's possible and the next steps."],
  contactNote:"Write to us in English or Spanish, whichever you prefer.",
  formTitle:"Let's discuss your project.", requiredNote:"Fields marked * are required.",
  name:"Your name", business:"Business name", optional:"(optional)", email:"Email address", need:"What do you need help with?", choose:"Choose an option",
  options:["New Website","Website Redesign","Custom Business Software","Automation or Integration","Not Sure Yet"],
  project:"Tell us about your project", namePlaceholder:"Alex Rivera", emailPlaceholder:"you@yourbusiness.com", placeholder:"What does your business do, and what would you like to build or improve?",
  submit:"Send My Project Inquiry", sending:"Sending your inquiry…",
  privacy:"By sending this form, you agree that Cronoverse may contact you about your project. We store your details only to respond to and manage this inquiry.",
  captchaNote:" Protected by Cloudflare Turnstile.",
  successTitle:"Your inquiry has been received.", successText:"Thank you! We'll be in touch about your project.", again:"Send another inquiry",
  errors:{
   name:{required:"Please enter your name.", short:"Please enter at least 2 characters."},
   email:{required:"Please enter your email address.", invalid:"Please enter a valid email address, like name@business.com."},
   service:{required:"Please choose what you need help with."},
   message:{required:"Please tell us about your project.", short:"Please add a little more detail (at least 10 characters)."},
  } as Record<Field, Partial<Record<FieldError, string>>>,
  fixFields:"Please review the highlighted fields.",
  error:"Your inquiry couldn't be sent. Please try again. Your details are still here.",
  invalid:"Some details couldn't be accepted. Please review the form and try again.",
  rate:"You've sent a few inquiries recently. Please try again in an hour.",
  captcha:"We couldn't confirm you're human. Please try again. Your details are still here.",
  footTagline:"Websites, custom software, and business automation.", footArea:"Serving Orange County and businesses throughout Southern California.", footLang:"English & Español.",
  footNavLabel:"Footer navigation", footCta:"Have a project? Let's talk.", top:"Back to top", rights:"Cronoverse. All rights reserved.",
  mobileCta:"Start Your Project",
 },
 es: {
  skip:"Ir al contenido", navLabel:"Navegación principal", menuLabel:"Abrir navegación", homeLabel:"Inicio de Cronoverse",
  nav:{services:"Servicios", examples:"Ejemplos", why:"Por qué nosotros", process:"Proceso", contact:"Hablemos"},
  studio:"DESARROLLO WEB Y SOFTWARE EMPRESARIAL · SUR DE CALIFORNIA", title:["Tu competencia ya se está modernizando.","¿Y tú?"],
  intro:"Tus clientes te comparan en segundos, y un sitio anticuado los manda con quien se ve mejor. Creamos sitios web rápidos y software a medida para que tú seas la opción obvia.",
  cta:"Cuéntanos tu proyecto", explore:"Explora nuestros servicios", serviceLineLabel:"Lo que creamos", serviceLine:["Sitios web","Aplicaciones empresariales","Automatización","Integraciones"],
  photo:"CALIFORNIA. UNA NUEVA PERSPECTIVA.", heroAlt:"Ilustración surrealista de palmeras californianas con bordes azul eléctrico y fragmentos digitales sobre un atardecer coral",
  band:"Atendemos a negocios de Orange County y todo el sur de California.", bandLang:"English & Español",
  eyebrow:"01 / LO QUE CREAMOS", heading:"¿Qué necesita tu negocio?",
  serviceIntro:"¿Un mejor sitio web? ¿Menos tareas manuales? ¿Software que se adapte a tu forma de trabajar? Desarrollamos soluciones digitales prácticas para que tu negocio funcione mejor.",
  services:[
   {id:"new", kicker:"SITIOS WEB", title:"Sitios web que trabajan para tu negocio", desc:"Tu sitio web debe hacer más que verse bien. Debe mostrar claramente lo que ofreces, causar una buena impresión y facilitar que tus clientes te contacten.", items:["Sitios web empresariales y páginas de destino","Rediseño de sitios web","Desarrollo adaptable a móviles","Formularios de contacto y captación de clientes"], cta:"Crear mi sitio web"},
   {id:"software", kicker:"SOFTWARE EMPRESARIAL", title:"Software adaptado a tu negocio", desc:"Deja de depender de hojas de cálculo y sistemas que no se comunican entre sí. Creamos herramientas adaptadas a la forma en que trabaja tu equipo.", items:["Gestión de inventario y pedidos","Portales para clientes y empleados","Paneles de informes y estadísticas","Herramientas de programación y operaciones"], cta:"Explorar software a medida"},
   {id:"automation", kicker:"AUTOMATIZACIÓN E INTEGRACIONES", title:"Conecta tus herramientas. Reduce el trabajo repetitivo.", desc:"Tus sistemas deberían trabajar juntos. Conectamos aplicaciones, sincronizamos información y automatizamos tareas repetitivas para mejorar la eficiencia de tu negocio.", items:["Integraciones mediante API","Automatización de procesos","Sincronización de datos","Herramientas internas de gestión"], cta:"Simplificar mis procesos"},
  ],
  examplesEyebrow:"02 / DESCUBRE LAS POSIBILIDADES", examplesTitle:"No te quedes solo con nuestras palabras. Pruébalo.",
  examplesText:"Explora ejemplos interactivos de sitios web y herramientas empresariales. Busca productos en un inventario, gestiona pedidos de ejemplo o explora un panel de ventas.",
  examplesNote:"Demostraciones interactivas con datos de ejemplo.", examplesCta:"¿Necesitas algo parecido? Hablemos de tu proyecto.",
  whyEyebrow:"03 / POR QUÉ CRONOVERSE", whyTitle:"Habla directamente con quienes desarrollan tu proyecto.",
  whyText:"Sin procesos complicados ni funciones innecesarias. Nos enfocamos en entender tu negocio, desarrollar la solución adecuada y ayudarte a utilizarla.",
  whyItems:[
   {title:"Comunicación directa", text:"Habla sobre tus necesidades con el desarrollador que trabaja en tu proyecto."},
   {title:"Un plan claro", text:"Conoce el alcance, las funciones y las expectativas antes de comenzar."},
   {title:"Diseñado para tu negocio", text:"Obtén las funciones que necesitas sin complicaciones innecesarias."},
   {title:"Atención en inglés y español", text:"Conversemos en el idioma que te resulte más cómodo."},
  ],
  processEyebrow:"04 / CÓMO TRABAJAMOS", processTitle:"De la idea a una solución funcional.",
  steps:[
   {title:"Cuéntanos qué necesitas.", text:"Explícanos a qué se dedica tu negocio, qué problema quieres resolver y cuál es tu objetivo."},
   {title:"Planificamos y desarrollamos.", text:"Definimos el alcance, diseñamos la experiencia y desarrollamos tu solución, incorporando tus comentarios durante el proceso."},
   {title:"Lanzamos tu proyecto.", text:"Realizamos pruebas, ajustamos los detalles y te ayudamos con el lanzamiento. También te explicamos cómo utilizar tu nuevo sitio web o aplicación."},
  ],
  contactEyebrow:"05 / COMIENZA TU PROYECTO", contactTitle:"Cuéntanos qué necesitas. Nosotros te ayudamos a hacerlo realidad.",
  contactText:["¿Necesitas un nuevo sitio web? ¿Quieres reemplazar un sistema antiguo? ¿Hay tareas que consumen demasiado tiempo?","Cuéntanos sobre tu proyecto. Conversaremos sobre las posibilidades y los próximos pasos."],
  contactNote:"Escríbenos en español o en inglés, como prefieras.",
  formTitle:"Hablemos de tu proyecto.", requiredNote:"Los campos marcados con * son obligatorios.",
  name:"Tu nombre", business:"Nombre del negocio", optional:"(opcional)", email:"Correo electrónico", need:"¿En qué podemos ayudarte?", choose:"Elige una opción",
  options:["Nuevo sitio web","Rediseño de sitio web","Software empresarial a medida","Automatización o integración","Aún no estoy seguro"],
  project:"Cuéntanos sobre tu proyecto", namePlaceholder:"Alex Rivera", emailPlaceholder:"tu@tunegocio.com", placeholder:"¿A qué se dedica tu negocio y qué te gustaría crear o mejorar?",
  submit:"Enviar mi consulta", sending:"Enviando tu consulta…",
  privacy:"Al enviar este formulario, aceptas que Cronoverse te contacte sobre tu proyecto. Guardamos tus datos solo para responder y gestionar esta consulta.",
  captchaNote:" Protegido por Cloudflare Turnstile.",
  successTitle:"¡Recibimos tu consulta!", successText:"Gracias por escribirnos. Nos pondremos en contacto para hablar sobre tu proyecto.", again:"Enviar otra consulta",
  errors:{
   name:{required:"Escribe tu nombre.", short:"Escribe al menos 2 caracteres."},
   email:{required:"Escribe tu correo electrónico.", invalid:"Escribe un correo válido, por ejemplo nombre@negocio.com."},
   service:{required:"Elige en qué podemos ayudarte."},
   message:{required:"Cuéntanos sobre tu proyecto.", short:"Agrega un poco más de detalle (al menos 10 caracteres)."},
  } as Record<Field, Partial<Record<FieldError, string>>>,
  fixFields:"Revisa los campos marcados.",
  error:"No pudimos enviar tu consulta. Inténtalo de nuevo; tus datos siguen aquí.",
  invalid:"Algunos datos no son válidos. Revisa el formulario e inténtalo de nuevo.",
  rate:"Ya enviaste varias consultas. Inténtalo de nuevo en una hora.",
  captcha:"No pudimos confirmar que eres una persona. Inténtalo de nuevo; tus datos siguen aquí.",
  footTagline:"Sitios web, software a medida y automatización empresarial.", footArea:"Atendemos a negocios de Orange County y todo el sur de California.", footLang:"English & Español.",
  footNavLabel:"Navegación del pie de página", footCta:"¿Tienes un proyecto? Hablemos.", top:"Volver arriba", rights:"Cronoverse. Todos los derechos reservados.",
  mobileCta:"Cuéntanos tu proyecto",
 }
};
// The five interactive examples (carousel, tables, charts) are the heaviest code on the page.
// They load in their own chunk right after hydration, so they never delay the hero.
const CapabilityShowcase = dynamic(() => import("@/components/capability-showcase").then(m => m.CapabilityShowcase), { ssr: false, loading: () => <div className="capability-showcase showcase-placeholder" aria-hidden="true"/> });
const serviceIcons = [MonitorSmartphone, LayoutDashboard, Workflow];
const whyIcons = [MessagesSquare, ClipboardCheck, Puzzle, Languages];
const navTargets = ["services", "examples", "why", "process"] as const;

function makeInquiryId(){
 if(typeof crypto.randomUUID === "function") return crypto.randomUUID();
 const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
// Mirrors the server's checks (lib/inquiry-intake.ts) so most problems are caught before sending.
function validate(data:FormData, service:string){
 const errors:Partial<Record<Field,FieldError>>={};
 const name=String(data.get("name")||"").trim(), email=String(data.get("email")||"").trim(), message=String(data.get("message")||"").trim();
 if(!name)errors.name="required";else if(name.length<2)errors.name="short";
 if(!email)errors.email="required";else if(!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)||email.length>254)errors.email="invalid";
 if(!service)errors.service="required";
 if(!message)errors.message="required";else if(message.length<10)errors.message="short";
 return errors;
}

// Approved brand artwork in public/brand (see ASSETS.md). The image already spells "cronoverse", so no text wordmark sits beside it.
const BRAND_LOGO="/brand/svg/cronoverse-logo-on-dark.svg";
// Footer lockup with the descriptor, per language; null falls back to BRAND_LOGO. Spanish lockup not supplied yet:
// set es to "/brand/svg/cronoverse-lockup-es-on-dark.svg" once that file is added.
const FOOTER_LOCKUP:Record<Language,string|null>={en:"/brand/svg/cronoverse-lockup-on-dark.svg",es:null};

export function Home({initialLang}:{initialLang:Language}){
 const [lang,setLang]=useState<Language>(initialLang); const [menu,setMenu]=useState(false); const [service,setService]=useState<ServiceId|"">("");
 const [status,setStatus]=useState<"idle"|"sending"|"success"|"error"|"invalid"|"rate"|"captcha"|"fields">("idle"); const [errors,setErrors]=useState<Partial<Record<Field,FieldError>>>({});
 const [captchaKey,setCaptchaKey]=useState(""); const [mobileCta,setMobileCta]=useState(false);
 const captcha=useRef<CaptchaHandle>(null); const form=useRef<HTMLFormElement>(null); const successRef=useRef<HTMLDivElement>(null);
 const requestId=useRef(""); const requestPayload=useRef(""); const sending=useRef(false); const t=copy[lang];
 // Visitors from before the language cookie existed only have the localStorage choice: carry it over once.
 useEffect(()=>{if(new URLSearchParams(location.search).has("lang")||document.cookie.split(";").some(c=>c.trim().startsWith(LANGUAGE_COOKIE+"=")))return;let saved="";try{saved=localStorage.getItem(LANGUAGE_STORAGE_KEY)||"";}catch{}if(isLanguage(saved)&&saved!==initialLang)language(saved,false);else if(isLanguage(saved))remember(saved);},[]);// eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{document.documentElement.lang=lang;document.title=pageMeta[lang].title;document.querySelector('meta[name="description"]')?.setAttribute("content",pageMeta[lang].description);},[lang]);
 useEffect(()=>{setCaptchaKey(document.body.dataset.turnstileSitekey||"");},[]);
 useEffect(()=>{if(status==="success")successRef.current?.focus();},[status]);
 useEffect(()=>{if(!menu)return;const close=(e:KeyboardEvent)=>{if(e.key==="Escape")setMenu(false);};addEventListener("keydown",close);return()=>removeEventListener("keydown",close);},[menu]);
 // The small-screen "Start your project" bar shows only between the hero and the contact section.
 useEffect(()=>{const targets=["top","contact","site-footer"].map(id=>document.getElementById(id)).filter((el):el is HTMLElement=>!!el);if(!("IntersectionObserver" in window)||!targets.length)return;const seen=new Map<Element,boolean>();const io=new IntersectionObserver(entries=>{for(const e of entries)seen.set(e.target,e.isIntersecting);setMobileCta(targets.every(el=>seen.get(el)===false));});targets.forEach(el=>io.observe(el));return()=>io.disconnect();},[]);
 function remember(v:Language){try{localStorage.setItem(LANGUAGE_STORAGE_KEY,v);}catch{}document.cookie=`${LANGUAGE_COOKIE}=${v}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==="https:"?"; Secure":""}`;}
 function language(v:Language,track=true){if(v===lang&&track)return;setLang(v);remember(v);const url=new URL(location.href);if(v==="es")url.searchParams.set("lang","es");else url.searchParams.delete("lang");history.replaceState(history.state,"",url);if(track)trackEvent("language_change",{language:v});}
 function chooseService(v:string){if(!(ids as readonly string[]).includes(v))return;setService(v as ServiceId);setErrors(e=>({...e,service:undefined}));trackEvent("contact_form_start",{form_name:"project_inquiry"},"inquiry");}
 function recheck(){if(!Object.values(errors).some(Boolean)||!form.current)return;const next=validate(new FormData(form.current),service);setErrors(e=>Object.fromEntries(Object.keys(e).map(k=>[k,next[k as Field]])));}
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  // A ref, not state, so a fast double-click cannot start a second request before the re-render.
  if(sending.current)return;
  const data=new FormData(e.currentTarget);
  const found=validate(data,service);
  setErrors(found);
  const first=(["name","email","service","message"] as Field[]).find(f=>found[f]);
  if(first){setStatus("fields");document.getElementById(first)?.focus();return;}
  const payload={name:data.get("name"),email:data.get("email"),business:data.get("business"),message:data.get("message"),website:data.get("website"),service,language:lang};
  const snapshot=JSON.stringify(payload);
  // Reuse the ID for an unchanged retry, and create a new ID if the visitor edits the form.
  if(!requestId.current||requestPayload.current!==snapshot){requestId.current=makeInquiryId();requestPayload.current=snapshot;}
  sending.current=true; setStatus("sending");
  try{
   let token:string|null=null;
   if(captchaKey){token=await(captcha.current?.token()??Promise.resolve(null));if(!token){captcha.current?.reset();setStatus("captcha");return;}}
   const body=JSON.stringify({id:requestId.current,...payload,...(token?{captchaToken:token}:{})});
   // The same ID makes a retry safe (no duplicate inquiry), so a transient 503 or a dropped
   // connection is retried a couple of times before the visitor sees an error.
   let r:Response|undefined;
   for(let attempt=0;attempt<3;attempt++){
    if(attempt)await new Promise(done=>setTimeout(done,attempt*700));
    try{r=await fetch("/api/inquiries",{method:"POST",headers:{"Content-Type":"application/json"},body});}catch{r=undefined;}
    if(r&&r.status!==503)break;
   }
   if(!r){setStatus("error");return;}
   const reply=(await r.json().catch(()=>null)) as {ok?:unknown;error?:unknown}|null;
   // Success means Django acknowledged storage: the proxy relays only 200/201 with {ok:true}.
   const saved=(r.status===200||r.status===201)&&reply?.ok===true;
   if(!saved&&r.status===403&&reply?.error==="Captcha failed"){captcha.current?.reset();setStatus("captcha");return;}
   setStatus(saved?"success":r.status===429?"rate":r.status===400?"invalid":"error");
   if(saved&&!String(data.get("website")||"").trim())trackInquirySuccess(requestId.current,service,lang);
  }catch{setStatus("error");}
  finally{sending.current=false;}
 }
 function fieldProps(f:Field){return {"aria-invalid":errors[f]?true:undefined,"aria-describedby":errors[f]?`${f}-error`:undefined};}
 function fieldError(f:Field){const key=errors[f];return key?<span className="field-error" id={`${f}-error`}>{t.errors[f][key]}</span>:null;}

 useEffect(()=>{const ctx=(document as Document & {modelContext?:{registerTool:(tool:object,options:object)=>void|Promise<void>}}).modelContext;if(!ctx)return;const life=new AbortController();try{void Promise.resolve(ctx.registerTool({name:"start_project_inquiry",description:"Open the project inquiry form and optionally select a service. Does not submit an inquiry.",inputSchema:{type:"object",properties:{service:{type:"string",enum:ids}},additionalProperties:false},annotations:{readOnlyHint:false},execute:async(input:unknown)=>{if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("Expected an object");const value=(input as {service?:string}).service;if(Object.keys(input).some(k=>k!=="service")||(value!==undefined&&!(ids as readonly string[]).includes(value)))throw new Error("Invalid service");if(value)setService(value as ServiceId);document.getElementById("contact")?.scrollIntoView({behavior:"instant"});await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));return{status:"form_opened",submitted:false};}},{signal:life.signal})).catch(()=>{});}catch{}return()=>life.abort();},[]);
 const formMessage=status==="fields"?t.fixFields:status==="rate"?t.rate:status==="captcha"?t.captcha:status==="invalid"?t.invalid:status==="error"?t.error:"";
 return <>
  <a className="skip-link" href="#main">{t.skip}</a>
  <div className="dark-intro" id="top">
   <header className="site-header wrap"><a className="brand-link" href="#top" aria-label={t.homeLabel}><img className="brand-logo" src={BRAND_LOGO} alt="Cronoverse" width="240" height="57"/></a><nav className="desktop-nav" aria-label={t.navLabel}>{navTargets.map(k=><a key={k} href={`#${k}`}>{t.nav[k]}</a>)}</nav><div className="header-actions"><div className="language-control" role="group" aria-label="Language / Idioma"><button type="button" lang="en" aria-pressed={lang==="en"} aria-label="English" onClick={()=>language("en")}>EN</button><span aria-hidden="true">/</span><button type="button" lang="es" aria-pressed={lang==="es"} aria-label="Español" onClick={()=>language("es")}>ES</button></div><a className="header-cta" href="#contact">{t.nav.contact}<ArrowUpRight size={17} aria-hidden="true"/></a><button className="menu-toggle" type="button" aria-expanded={menu} aria-controls="mobile-nav" aria-label={t.menuLabel} onClick={()=>setMenu(!menu)}>{menu?<X aria-hidden="true"/>:<Menu aria-hidden="true"/>}</button></div></header>
   {menu&&<nav id="mobile-nav" className="mobile-nav" aria-label={t.navLabel}>{navTargets.map(k=><a key={k} onClick={()=>setMenu(false)} href={`#${k}`}>{t.nav[k]}</a>)}<a onClick={()=>setMenu(false)} href="#contact">{t.nav.contact}</a></nav>}
   <main id="main"><section className="hero wrap" aria-labelledby="hero-title"><div className="hero-copy"><p className="eyebrow"><span className="tiny-line"/>{t.studio}</p><h1 id="hero-title">{t.title[0]}<br/><span>{t.title[1]}</span></h1><p className="hero-description">{t.intro}</p><div className="hero-actions"><a className="button button-electric" href="#contact" onClick={()=>trackEvent("hero_cta_click",{cta:"start_project"})}><DustSurface variant="button" phase={2.5}/>{t.cta}<ArrowUpRight size={20} aria-hidden="true"/></a><a className="text-link" href="#services" onClick={()=>trackEvent("hero_cta_click",{cta:"see_services"})}>{t.explore}<ArrowRight size={16} aria-hidden="true"/></a></div><ul className="hero-services" aria-label={t.serviceLineLabel}>{t.serviceLine.map(item=><li key={item}>{item}</li>)}</ul></div><div className="hero-visual"><HeroScenes lang={lang} alt={t.heroAlt} photo={t.photo}/></div></section><div className="region-band"><div className="wrap"><span>{t.band}</span><span><Globe2 size={15} strokeWidth={1.5} aria-hidden="true"/>{t.bandLang}</span></div></div></main>
  </div>
  <section className="services-section section-pad" id="services" aria-labelledby="services-title"><div className="wrap"><div className="section-heading"><div><p className="eyebrow">{t.eyebrow}</p><h2 id="services-title">{t.heading}</h2></div><p className="section-description">{t.serviceIntro}</p></div><div className="service-grid">{t.services.map((item,i)=>{const Icon=serviceIcons[i];return <article className="service-card" key={item.id} aria-labelledby={`service-${item.id}`}><div className="service-top"><Icon size={28} strokeWidth={1.3} aria-hidden="true"/><span>0{i+1} · {item.kicker}</span></div><h3 id={`service-${item.id}`}>{item.title}</h3><p>{item.desc}</p><ul>{item.items.map(entry=><li key={entry}><Check size={16} aria-hidden="true"/>{entry}</li>)}</ul><a className="service-link" href="#contact" onClick={()=>{chooseService(item.id);trackEvent("service_cta_click",{service:item.id});}}>{item.cta}<ArrowUpRight size={18} aria-hidden="true"/></a></article>})}</div></div></section>
  <section className="approach-section section-pad" id="examples" aria-labelledby="examples-title"><div className="wrap approach-grid"><CapabilityShowcase lang={lang}/><div className="approach-copy"><p className="eyebrow">{t.examplesEyebrow}</p><h2 id="examples-title">{t.examplesTitle}</h2><p>{t.examplesText}</p><p className="demo-disclaimer"><FlaskConical size={16} aria-hidden="true"/>{t.examplesNote}</p><a className="examples-cta" href="#contact">{t.examplesCta}<ArrowUpRight size={18} aria-hidden="true"/></a></div></div></section>
  <section className="why-section section-pad" id="why" aria-labelledby="why-title"><div className="wrap"><div className="section-heading"><div><p className="eyebrow">{t.whyEyebrow}</p><h2 id="why-title">{t.whyTitle}</h2></div><p className="section-description">{t.whyText}</p></div><ul className="why-grid">{t.whyItems.map((item,i)=>{const Icon=whyIcons[i];return <li key={i}><Icon size={24} strokeWidth={1.4} aria-hidden="true"/><h3>{item.title}</h3><p>{item.text}</p></li>})}</ul></div></section>
  <section className="process-section section-pad" id="process" aria-labelledby="process-title"><div className="wrap"><p className="eyebrow">{t.processEyebrow}</p><h2 id="process-title">{t.processTitle}</h2><ol className="process-grid">{t.steps.map((step,i)=><li key={i}><span className="step-number" aria-hidden="true">0{i+1}</span><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol></div></section>
  <section className="contact-section section-pad" id="contact" aria-labelledby="contact-title"><div className="wrap contact-grid"><div className="contact-copy"><p className="eyebrow">{t.contactEyebrow}</p><h2 id="contact-title">{t.contactTitle}<span className="dust-underline" aria-hidden="true"><DustSurface variant="line" color="var(--signal)" phase={1}/></span></h2>{t.contactText.map(p=><p key={p}>{p}</p>)}<div className="contact-language"><Globe2 size={20} aria-hidden="true"/><span>{t.contactNote}</span></div><ArrowUpRight className="contact-arrow" size={116} strokeWidth={.7} aria-hidden="true"/></div><div className="form-panel">{status==="success"?<div className="success-panel" role="status" tabIndex={-1} ref={successRef}><span className="success-check"><Check size={30} aria-hidden="true"/></span><h3>{t.successTitle}</h3><p>{t.successText}</p><button className="button button-dark" type="button" onClick={()=>{setStatus("idle");setService("");setErrors({});requestId.current="";requestPayload.current=""}}>{t.again}<ArrowRight size={17} aria-hidden="true"/></button></div>:<form ref={form} onSubmit={submit} onInputCapture={()=>{trackEvent("contact_form_start",{form_name:"project_inquiry"},"inquiry");recheck();}} className="inquiry-form" noValidate aria-labelledby="form-title"><div className="form-heading"><h3 id="form-title">{t.formTitle}</h3><p>{t.requiredNote}</p></div><div className="form-row"><div className="field"><label htmlFor="name">{t.name}<span className="req" aria-hidden="true"> *</span><Input id="name" name="name" required minLength={2} maxLength={100} autoComplete="name" placeholder={t.namePlaceholder} {...fieldProps("name")}/></label>{fieldError("name")}</div><div className="field"><label htmlFor="business">{t.business} <span className="optional">{t.optional}</span><Input id="business" name="business" maxLength={160} autoComplete="organization"/></label></div></div><div className="field"><label htmlFor="email">{t.email}<span className="req" aria-hidden="true"> *</span><Input id="email" name="email" type="email" inputMode="email" required maxLength={254} autoComplete="email" spellCheck={false} placeholder={t.emailPlaceholder} {...fieldProps("email")}/></label>{fieldError("email")}</div><div className="field-label"><label id="service-label" htmlFor="service">{t.need}<span className="req" aria-hidden="true"> *</span></label><Select value={service} onValueChange={chooseService} name="service" required><SelectTrigger id="service" aria-labelledby="service-label" aria-required="true" className="service-select" {...fieldProps("service")}><SelectValue placeholder={t.choose}/></SelectTrigger><SelectContent>{t.options.map((option,i)=><SelectItem key={ids[i]} value={ids[i]}>{option}</SelectItem>)}</SelectContent></Select>{fieldError("service")}</div><div className="field"><label htmlFor="message">{t.project}<span className="req" aria-hidden="true"> *</span><Textarea id="message" name="message" required minLength={10} maxLength={4000} rows={5} placeholder={t.placeholder} {...fieldProps("message")}/></label>{fieldError("message")}</div><div className="honey" aria-hidden="true"><label htmlFor="website">Website<Input id="website" name="website" tabIndex={-1} autoComplete="off"/></label></div>{captchaKey&&<Captcha ref={captcha} siteKey={captchaKey} lang={lang}/>}<p className="form-error" role="alert">{formMessage}</p><button type="submit" disabled={status==="sending"} className="button button-dark submit-button">{status==="sending"?t.sending:t.submit}{status==="sending"?<LoaderCircle className="spinner" size={19} aria-hidden="true"/>:<ArrowUpRight size={19} aria-hidden="true"/>}</button><p className="privacy-note">{t.privacy}{captchaKey&&t.captchaNote}</p></form>}</div></div></section>
  <footer className="site-footer" id="site-footer"><div className="wrap"><div className="footer-top"><div className="footer-brand"><a className="brand-link footer-logo" href="#top" aria-label={t.homeLabel}><picture>{FOOTER_LOCKUP[lang]&&<source media="(min-width: 420px)" srcSet={FOOTER_LOCKUP[lang]!}/>}<img className="brand-logo" src={BRAND_LOGO} alt="Cronoverse" width="360" height="85" loading="lazy"/></picture></a><p className="footer-tagline">{t.footTagline}</p><p>{t.footArea}</p><p>{t.footLang}</p></div><nav className="footer-nav" aria-label={t.footNavLabel}>{navTargets.map(k=><a key={k} href={`#${k}`}>{t.nav[k]}</a>)}<a href="#contact">{t.nav.contact}</a></nav><div className="footer-actions"><a className="footer-cta" href="#contact">{t.footCta}<ArrowUpRight size={18} aria-hidden="true"/></a><a className="footer-back" href="#top">{t.top}<ArrowUpRight size={16} aria-hidden="true"/></a></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} {t.rights}</span><span>Orange County · Southern California · English & Español</span></div></div></footer>
  {mobileCta&&<a className="mobile-cta" href="#contact" onClick={()=>trackEvent("hero_cta_click",{cta:"mobile_bar"})}>{t.mobileCta}<ArrowUpRight size={18} aria-hidden="true"/></a>}
 </>;
}
