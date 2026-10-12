import {createClient} from '@supabase/supabase-js';
import type {State} from './engine';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabase=url&&key?createClient(url,key):null;
export async function loadRemote(userId:string):Promise<State|null>{if(!supabase)return null;const {data,error}=await supabase.from('dashboard_states').select('state').eq('user_id',userId).maybeSingle();if(error)throw error;return data?.state||null;}
export async function saveRemote(userId:string,state:State){if(!supabase)return;const {error}=await supabase.from('dashboard_states').upsert({user_id:userId,state,updated_at:new Date().toISOString()});if(error)throw error;}

let sessionPromise:Promise<string>|null=null;
export function ensureSession():Promise<string>{
 if(!supabase)return Promise.reject(new Error('Supabase não configurado'));
 if(!sessionPromise)sessionPromise=(async()=>{
  const {data,error}=await supabase!.auth.getSession();if(error)throw error;
  if(data.session)return data.session.user.id;
  const result=await supabase!.auth.signInAnonymously();if(result.error)throw result.error;
  if(!result.data.user)throw new Error('Sessão não criada');return result.data.user.id;
 })().catch(error=>{sessionPromise=null;throw error;});
 return sessionPromise;
}
