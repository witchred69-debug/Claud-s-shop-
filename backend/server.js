import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';

const requiredEnv=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','ADMIN_EMAILS'];
const missing=requiredEnv.filter(k=>!process.env[k]);
if(missing.length){console.error('Missing environment variables: '+missing.join(', '));process.exit(1)}
const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
const admins=new Set(process.env.ADMIN_EMAILS.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean));
const origins=(process.env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
const app=express();app.disable('x-powered-by');app.use(helmet());app.use(express.json({limit:'100kb'}));
app.use(cors({origin(o,cb){if(!o||origins.length===0||origins.includes(o))return cb(null,true);cb(new Error('Origin denied'))}}));
app.use('/api',rateLimit({windowMs:60000,limit:100,standardHeaders:'draft-7',legacyHeaders:false}));
const categories=new Set(['Odjeća','Obuća','Kućanske stvari','Alati','Knjige','Antikviteti','Igračke','Stvari za djecu']);
const fail=(res,n,msg)=>res.status(n).json({error:msg});
async function requireAdmin(req,res,next){const m=/^Bearer\s+(.+)$/i.exec(req.get('authorization')||'');if(!m)return fail(res,401,'Prijava je potrebna.');const {data,error}=await supabase.auth.getUser(m[1]);if(error||!data.user?.email||!admins.has(data.user.email.toLowerLowerCase()))return fail(res,403,'Nemate administratorski pristup.');req.admin=data.user;next()}
app.get('/api/health',(_q,r)=>r.json({ok:true}));
app.get('/api/products',async(_q,r)=>{const {data,error}=await supabase.from('products').select('id,category,title,condition,price,description,image_url').eq('active',true).order('created_at',{ascending:false});if(error)return fail(r,500,'Proizvode nije moguće učitati.');r.json(data.map(p=>({id:p.id,category:p.category,title:p.title,condition:p.condition,price:Number(p.price),desc:p.description,img:p.image_url,sold:false})))});
app.get('/api/admin/products',requireAdmin,async(_q,r)=>{const {data,error}=await supabase.from('products').select('*').order('created_at',{ascending:false});if(error)return fail(r,500,'Proizvode nije moguće učitati.');r.json(data)});
app.post('/api/admin/products',requireAdmin,async(req,r)=>{const b=req.body||{};const price=Number(b.price);if(!categories.has(b.category)||typeof b.title!='string'||!b.title.trim()||b.title.length>120||!Number.isFinite(price)||price<0)return fail(r,400,'Provjerite kategoriju, naziv i cijenu.');if(typeof b.img!='string'||(b.img&&!/^https:\/\//i.test(b.img)))return fail(r,400,'Slika mora biti HTTPS poveznica.');const {data,error}=await supabase.from('products').insert({category:b.category,title:b.title.trim(),condition:typeof b.condition=='string'?b.condition.trim().slice(0,80):'Očuvano',price,description:typeof b.desc=='string'?b.desc.slice(0,1000):'',image_url:b.img}).select('*').single();if(error)return fail(r,500,'Proizvod nije moguće spremiti.');r.status(201).json(data)});
app.patch('/api/admin/products/:id',requireAdmin,async(req,r)=>{const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return fail(r,400,'ID nije valjan.');if(typeof req.body?.active!='boolean')return fail(r,400,'Status nije valjan.');const {data,error}=await supabase.from('products').update({active:req.body.active,updated_at:new Date().toISOString()}).eq('id',id).select('*').maybeSingle();if(error)return fail(r,500,'Ažuriranje nije uspjelo.');if(!data)return fail(r,404,'Artikl nije pronađen.');r.json(data)});
app.delete('/api/admin/products/:id',requireAdmin,async(req,r)=>{const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return fail(r,400,'ID nije valjan.');const {error}=await supabase.from('products').delete().eq('id',id);if(error)return fail(r,500,'Brisanje nije uspjelo.');r.status(204).send()});
app.use((e,_q,r,_n)=>fail(r,e.message==='Origin denied'?403:500,e.message==='Origin denied'?'Origin nije dozvoljen.':'Dogodila se neočekivana greška.'));
app.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log("Claud's Shop API listening"));
