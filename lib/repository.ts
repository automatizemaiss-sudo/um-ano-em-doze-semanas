import {createClient} from '@supabase/supabase-js';
import type {State} from './engine';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabase=url&&key?createClient(url,key):null;
export async function loadRemote(userId:string):Promise<State|null>{if(!supabase)return null;const {data,error}=await supabase.from('dashboard_states').select('state').eq('user_id',userId).maybeSingle();if(error)throw error;return data?.state||null;}
export async function saveRemote(userId:string,state:State){if(!supabase)return;const {error}=await supabase.from('dashboard_states').upsert({user_id:userId,state,updated_at:new Date().toISOString()});if(error)throw error;}
