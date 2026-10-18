import Head from 'next/head'
import {useState} from 'react'
import GlitchStudio from '@/components/community/tools/GlitchStudio'

// Local QA only. Production returns 404, and the public tool has no fixture controls.
export function getServerSideProps() {
  return process.env.NODE_ENV==='development'?{props:{}}:{notFound:true}
}

const samples=['lvx-shared-portrait.jpg','lvx-sweatshirt-portrait.jpg','lvx-polo-portrait.jpg','lvx-polo-ivy.jpg','lvx-sweatshirt-column.jpg','lvx-sweatshirt-side.jpg']
export default function GlitchStudioCheck() {
  const [message,setMessage]=useState('Select a fixture, then use Create my video below.')
  const [verification,setVerification]=useState('')
  const [started,setStarted]=useState(0)
  async function fixtures(count:number,corrupt=false) {
    const input=document.querySelector<HTMLInputElement>('input[type=file]')
    if(!input || input.disabled)return
    const transfer=new DataTransfer()
    for(let i=0;i<count;i++) {
      const blob=corrupt?new Blob(['not an image'],{type:'image/jpeg'}):await fetch(`/images/shop/${samples[i%samples.length]}`).then(r=>r.blob())
      transfer.items.add(new File([blob],corrupt?'corrupt.jpg':`sample-${i}.jpg`,{type:'image/jpeg'}))
    }
    document.querySelector<HTMLButtonElement>('.glitch-studio__text-button')?.textContent==='Clear images' && document.querySelector<HTMLButtonElement>('.glitch-studio__text-button')?.click()
    input.files=transfer.files
    input.dispatchEvent(new Event('change',{bubbles:true}))
    setVerification('');setStarted(performance.now());setMessage(`Loaded ${count} ${corrupt?'corrupt':'sample'} photos through the real file input.`)
  }
  async function verify() {
    setVerification('Inspecting MP4…')
    try {
      const link=document.querySelector<HTMLAnchorElement>('.glitch-studio__download')
      if(!link?.href.startsWith('blob:'))throw new Error('Expected a local blob download.')
      const blob=await fetch(link.href).then(r=>r.blob())
      const {Input,BlobSource,MP4,VideoSampleSink}=await import('mediabunny')
      const input=new Input({source:new BlobSource(blob),formats:[MP4]})
      try {
        const track=await input.getPrimaryVideoTrack()
        if(!track)throw new Error('Missing video track.')
        const stats=await track.computePacketStats()
        const duration=await input.computeDuration()
        if(track.codec!=='avc' || track.displayWidth!==1080 || ![1920,1350].includes(track.displayHeight))throw new Error('Expected a 1080-wide H.264 export in one of the two supported sizes.')
        if(stats.packetCount!==1114 || Math.abs(duration-1114/30)>1/30)throw new Error('The export is missing frames or has the wrong duration.')
        const sink=new VideoSampleSink(track)
        let inspected=0
        for(const second of [0,5,15,30,37]) {
          const sample=await sink.getSample(second)
          if(!sample)throw new Error('Missing decoded sample at '+second)
          const canvas=new OffscreenCanvas(48,48)
          sample.draw(canvas.getContext('2d')!,0,0,48,48);sample.close()
          const pixels=canvas.getContext('2d')!.getImageData(0,0,48,48).data
          let min=255,max=0
          for(let i=0;i<pixels.length;i+=4){min=Math.min(min,pixels[i]);max=Math.max(max,pixels[i])}
          if(max-min<8)throw new Error('Blank or flat frame at '+second)
          inspected++
        }
        const resources=performance.getEntriesByType('resource') as PerformanceResourceTiming[]
        const rendererRequests=resources.filter(r=>/(:4319|\/jobs\/|\/health(?:$|\?))/.test(r.name)).map(r=>r.name)
        if(rendererRequests.length)throw new Error('Unexpected server request: '+rendererRequests.join(', '))
        setVerification(JSON.stringify({result:'PASS',codec:track.codec,width:track.displayWidth,height:track.displayHeight,duration,packets:stats.packetCount,bytes:blob.size,decodedNonblankFrames:inspected,rendererRequests,elapsedSinceFixtures:Math.round((performance.now()-started)/1000)},null,2))
      } finally {input.dispose()}
    } catch(error){setVerification('FAIL: '+(error as Error).message)}
  }
  return <>
    <Head><meta name="robots" content="noindex,nofollow"/><title>Glitch Studio — local export verification</title></Head>
    <div style={{padding:24,background:'#eee',color:'#111',position:'relative',zIndex:2}}>
      <p>Local browser export verification</p>
      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
        <button onClick={()=>void fixtures(6)}>Load six photos</button>
        <button onClick={()=>void fixtures(1)}>Load one photo</button>
        <button onClick={()=>void fixtures(32)}>Load 32 photos</button>
        <button onClick={()=>void fixtures(1,true)}>Load corrupt photo</button>
        <button onClick={()=>void verify()}>Verify downloaded MP4</button>
      </div>
      <p role="status">{message}</p><pre style={{whiteSpace:'pre-wrap',color:'#111'}}>{verification}</pre>
    </div>
    <div className="community-theme"><div className="glitch-studio"><GlitchStudio/></div></div>
  </>
}
