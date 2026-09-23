import { z } from "zod";
import { inquiryDb } from "@/db/raw";
const schema=z.object({id:z.string().uuid(),name:z.string().trim().min(2).max(100),email:z.string().trim().email().max(254).transform(v=>v.toLowerCase()),business:z.string().trim().max(160).default(""),message:z.string().trim().min(10).max(4000),service:z.enum(["new","redesign","app","unsure"]),language:z.enum(["en","es"]),website:z.string().max(500).optional()});
export async function POST(request:Request){
 if(!request.headers.get("content-type")?.includes("application/json"))return Response.json({error:"Expected JSON"},{status:415});
 const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)return Response.json({error:"Invalid origin"},{status:403});
 let body:unknown;try{const text=await request.text();if(text.length>24000)return Response.json({error:"Too large"},{status:413});body=JSON.parse(text);}catch{return Response.json({error:"Invalid request"},{status:400});}
 const parsed=schema.safeParse(body);if(!parsed.success)return Response.json({error:"Please check your details"},{status:400});const p=parsed.data;
 if(p.website)return Response.json({error:"Please remove the website field"},{status:400});
 try{const db=inquiryDb();const existing=await db.prepare("SELECT id, email FROM inquiries WHERE id = ?").bind(p.id).first<{id:string,email:string}>();if(existing)return existing.email===p.email?Response.json({ok:true}):Response.json({error:"Invalid inquiry ID"},{status:409});const now=Date.now();
 const result=await db.prepare("INSERT INTO inquiries (id, name, email, business, service, message, language, created_at) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM inquiries WHERE email = ? AND created_at > ?) < 3 ON CONFLICT(id) DO NOTHING").bind(p.id,p.name,p.email,p.business,p.service,p.message,p.language,now,p.email,now-3600000).run();
 if(!result.meta.changes)return Response.json({error:"Please try again later"},{status:429,headers:{"Retry-After":"3600"}});return Response.json({ok:true},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("inquiry_save_failed",error instanceof Error?error.name:"UnknownError");return Response.json({error:"Your inquiry could not be saved. Please try again."},{status:503});}
}
