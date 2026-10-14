"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import TreeInfoPanel, { treeEntries, treeVeils } from "../TreeInfoPanel";
const Scene = dynamic(() => import("./proof-scene"), { ssr: false });
export type PerformanceState={time:number};
const subscribe = (fn: () => void) => { const m = matchMedia("(prefers-reduced-motion: reduce)"); m.addEventListener("change", fn); return () => m.removeEventListener("change", fn); };
class SceneBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
 state = {failed: false};static getDerivedStateFromError() { return {failed: true}; }
 render() { return this.state.failed ? <p className="art-unavailable">The live scene could not load. Please refresh to try again.</p> : this.props.children; }
}
export default function ProofOfBelief() {
 const reduced=useSyncExternalStore(subscribe,()=>matchMedia("(prefers-reduced-motion: reduce)").matches,()=>false);
 const [pauseOverride,setPauseOverride]=useState<boolean|null>(null),[ready,setReady]=useState(false),[sound,setSound]=useState(false);
 const [hoveredId,setHoveredId]=useState<string|null>(null);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const activeId=hoveredId??selectedId;
 const resetInfo=useCallback(()=>{setHoveredId(null);setSelectedId(null);},[]);
 const performance=useRef<PerformanceState>({time:0});
 const audio=useRef<{context:AudioContext;gain:GainNode;tones:OscillatorNode[]}|null>(null);
 const paused=pauseOverride??reduced;
 const onReady=useCallback(()=>setReady(true),[]);
 useEffect(()=>{let frame=0;const tick=()=>{const p=performance.current;if(audio.current){const {context,gain,tones}=audio.current;gain.gain.setTargetAtTime(sound&&!paused?.045:0,context.currentTime,.7);tones[1].frequency.setTargetAtTime(82.41+Math.sin(p.time*.15)*.7,context.currentTime,.5);}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[sound,paused]);
 useEffect(()=>()=>{audio.current?.context.close();},[]);
 async function toggleSound(){if(!audio.current){const context=new AudioContext(),gain=context.createGain(),filter=context.createBiquadFilter();filter.type="lowpass";filter.frequency.value=600;gain.gain.value=0;filter.connect(gain);gain.connect(context.destination);const tones=[55,82.41,110.12].map((frequency,i)=>{const o=context.createOscillator();o.type=i===1?"triangle":"sine";o.frequency.value=frequency;o.connect(filter);o.start();return o;});audio.current={context,gain,tones};}await audio.current.context.resume();setSound(v=>!v);}
 return <main className="art-stage performance performance--still performance--study" data-ready={ready} data-paused={paused} data-inspecting={activeId??"overview"} data-selected={selectedId??"none"}>
  <div className="art-stage__canvas" role="group" tabIndex={0} aria-label="Interactive Tree of Life" aria-describedby="tree-navigation-hint" onPointerLeave={()=>setHoveredId(null)} onBlur={()=>setHoveredId(null)} onKeyDown={event=>{
   const index=treeEntries.findIndex(part=>part.id===activeId);
   if(event.key==="Escape"){event.preventDefault();resetInfo();}
   else if(["ArrowRight","ArrowDown","ArrowLeft","ArrowUp","Home","End"].includes(event.key)){
    event.preventDefault();
    const next=event.key==="Home"?0:event.key==="End"?treeEntries.length-1:index<0?0:(index+(["ArrowLeft","ArrowUp"].includes(event.key)?-1:1)+treeEntries.length)%treeEntries.length;
    setHoveredId(null);setSelectedId(treeEntries[next].id);
   }
  }}>
   <SceneBoundary><Scene performance={performance} paused={paused} reducedMotion={reduced} hoveredId={hoveredId} selectedId={selectedId} onReady={onReady} onInspect={setHoveredId} onSelect={setSelectedId}/></SceneBoundary>
   <div className="tree-veils" role="group" aria-label="The three veils of negative existence, above Kether">
    {treeVeils.map(veil=><button key={veil.id} type="button" className="tree-veils__button" aria-label={`${veil.title} — ${veil.subtitle}`} aria-pressed={selectedId===veil.id} onPointerEnter={()=>setHoveredId(veil.id)} onPointerLeave={()=>setHoveredId(null)} onFocus={()=>setHoveredId(veil.id)} onBlur={()=>setHoveredId(null)} onClick={()=>setSelectedId(veil.id)}><span className="tree-veils__name">{veil.title}</span><span className="tree-veils__meaning">{veil.number===1?"Nothing":veil.number===2?"Limitless":"Limitless Light"}</span></button>)}
   </div>
  </div>
  <TreeInfoPanel activeId={activeId} reducedMotion={reduced} pinned={selectedId!==null&&activeId===selectedId} onReset={resetInfo} mobileControls={<><Link href="/community/tools">← tools</Link><button onClick={toggleSound} aria-pressed={sound}>sound {sound?"on":"off"}</button><button onClick={()=>setPauseOverride(!paused)} aria-pressed={paused} aria-label={paused?"Resume particles":"Pause particles"}>{paused?"resume":"pause"}</button></>}/>
  <div className="performance-side" aria-hidden="true">synthetic study / 001 — tree of life</div>
  <header className="art-bar art-stage__bar"><Link href="/community/tools">↖ community / tools</Link><span>tarot on the tree of life</span></header>
  <footer className="art-stage__footer"><div><h1>TREE OF LIFE</h1><p>ten sephiroth. twenty-two paths.</p></div><div className="art-controls"><button onClick={toggleSound} aria-pressed={sound}>sound {sound?"on":"off"}</button><button onClick={()=>setPauseOverride(!paused)} aria-pressed={paused} aria-label={paused?"Resume particles":"Pause particles"}>{paused?"resume":"pause"}</button><details><summary>about</summary><p>Tarot on the Tree of Life.<br/><br/>Explore the ten sephiroth and twenty-two paths. Hover, tap, or focus the tree and use the arrow keys to read about each part.<br/><br/>Visual treatment adapted from NULL’s Proof of Belief.</p></details></div></footer>
 </main>;
}
