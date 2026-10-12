import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makePeriod,scoreWeek,emptyEntry,virtualTime,projection} from './engine.ts';
test('excesso não mascara métricas ignoradas; revisões são derivadas',()=>{const p=makePeriod('Teste','2026-01-01T00:00:00Z');const e=emptyEntry('2026-01-01');e.leads=600;e.calls=4;e.reviews=3;p.weeks[0].entries=[e];const s=scoreWeek(p.weeks[0]);assert.equal(s.metrics.find(m=>m.id==='reviews')?.ratio,.75);assert.ok(s.scores.Comercial!<.6);});
test('relógio contínuo, limites e projeções de estoque',()=>{const p=makePeriod('Teste','2026-01-01T00:00:00Z');const start=Date.parse(p.start);assert.equal(virtualTime(p,start+42*86400000).progress,.5);assert.equal(virtualTime(p,start-1).progress,0);assert.equal(virtualTime(p,Date.parse(p.end)).virtual.getUTCMonth(),11);assert.equal(projection({...p.goals[3],value:24500},.5),24775);});
test('snapshots são independentes',()=>{const p=makePeriod('Teste','2026-01-01T00:00:00Z');p.weeks[1].metrics[0].target=80;assert.equal(p.weeks[0].metrics[0].target,60);});
