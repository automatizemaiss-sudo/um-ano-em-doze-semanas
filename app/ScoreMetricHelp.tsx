'use client';

import {useId, useState} from 'react';

export function ScoreMetricHelp({metric,name,aggregate}:{metric:'trainingCombined'|'studyUpdates';name:string;aggregate:boolean}){
 const id=useId();
 const [showOnTap,setShowOnTap]=useState(false);

 return <span className="score-metric-help" data-expanded={showOnTap}>
  <button type="button" aria-label={`Como é calculado: ${name}`} aria-describedby={id}
   onClick={()=>setShowOnTap(open=>!open)}
   onBlur={()=>setShowOnTap(false)}>?</button>
  <span className="score-metric-tooltip" role="tooltip" id={id}>
   {metric==='trainingCombined'?<>
    <span>Musculação rende 7,5 pontos por sessão, até 22,5. O primeiro cardio estruturado rende 15 pontos. A partir de 4 musculações ou 2 cardios, some um único bônus de 12,5 pontos.</span>
    <span>Contam como cardio corrida, bicicleta, caminhada cardiovascular estruturada, futsal e aeróbico estruturado. Divida o total de pontos pela meta de 50 para obter o percentual.</span>
   </>:<>
    <span>A rotina diária vale 70%. Divida as atualizações concluídas pelas previstas nos dias selecionados, com até três por dia (The News, Superhuman e Instagram). “Sem edição” em News ou Superhuman reduz o total previsto. O cumprimento diário tem limite de 100%.</span>
    <span>A sessão semanal no X vale 30% e conta integralmente quando marcada como concluída. Se o total de atualizações diárias previstas for zero, a sessão no X vale 100%.</span>
   </>}
   {aggregate&&<span>Neste recorte, o percentual do indicador é a soma dos realizados dividida pela soma das metas das semanas incluídas.</span>}
  </span>
 </span>;
}
