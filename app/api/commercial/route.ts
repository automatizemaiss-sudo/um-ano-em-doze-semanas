import {NextResponse} from 'next/server';
export async function GET(){
 try{
  const response=await fetch('https://docs.google.com/spreadsheets/d/1q_pvlMaACjKrC2RGnm2NNetmYjyDC-HAnB0qAuxHLzU/gviz/tq?tqx=out:csv&sheet=Resultados&range=N:AG',{cache:'no-store',signal:AbortSignal.timeout(12000)});
  const csv=await response.text();
  if(!response.ok||csv.trim().startsWith('<'))throw new Error('A planilha exige autenticação. Importe o CSV de Resultados para atualizar sem alterar o compartilhamento.');
  return new NextResponse(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Cache-Control':'no-store'}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Falha ao ler a fonte.'},{status:502});}
}
