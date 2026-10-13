import type {NextConfig} from 'next';
const publicEnv:Record<string,string>={};
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_PUBLISHABLE_KEY;
if(url)publicEnv.NEXT_PUBLIC_SUPABASE_URL=url;
if(key)publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=key;
const config:NextConfig={distDir:process.env.NODE_ENV==='development'?'.next-dev':'.next',env:publicEnv};
export default config;
