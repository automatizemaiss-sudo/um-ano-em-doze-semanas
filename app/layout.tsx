import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'12 semanas · Seu placar de execução',description:'Visão, objetivos, execução e resultados. Seu ano em 12 semanas.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>;}
