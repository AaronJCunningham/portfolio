import {BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality, canEncodeVideo} from 'mediabunny'
import {createFilm} from '../../../services/glitch-studio/engine/engine.mjs'
import {createRecipe} from '../../../services/glitch-studio/engine/recipe.mjs'
import {makeSequence} from '../../../services/glitch-studio/sequence.mjs'
import {BROWSER_HELP, FORMATS, LIMITS, probeSupport, validateFiles} from './support.mjs'

export type GlitchFormat = keyof typeof FORMATS
export type Progress = {stage:'preparing' | 'rendering' | 'encoding'; percent:number}
export type Support = {supported:boolean; reason:string; formats:string[]}
export type RenderResult = {blob:Blob; width:number; height:number; frames:number; fps:number; seconds:number}

const BITRATE = 8_000_000
const fontUrl = '/tools/glitch-studio/mono.woff2'
const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 0))

export async function checkBrowserSupport(): Promise<Support> {
  // WebGPU types are kept local: the site's other pages do not depend on WebGPU.
  const gpu = (navigator as Navigator & {gpu?:{requestAdapter:() => Promise<null | {requestDevice:() => Promise<{destroy:() => void}>}>}}).gpu
  return probeSupport({
    secure:window.isSecureContext,
    gpu:Boolean(gpu),
    videoEncoder:typeof VideoEncoder !== 'undefined' && typeof OffscreenCanvas !== 'undefined',
    probeGpu:async () => {
      const adapter = await gpu?.requestAdapter()
      if(!adapter)throw new Error('No graphics adapter')
      const device = await adapter.requestDevice()
      device.destroy()
    },
    probeEncoding:({width,height}:{width:number;height:number}) => canEncodeVideo('avc', {width,height,frameRate:30,quality:new Quality({bitrate:BITRATE})}),
  })
}

async function loadPhoto(file:File, signal:AbortSignal):Promise<ImageBitmap> {
  signal.throwIfAborted()
  let original:ImageBitmap
  try {original = await createImageBitmap(file, {imageOrientation:'from-image'})}
  catch {throw new Error(`“${file.name}” could not be read. Choose a different JPG, PNG or WebP image.`)}
  try {
    signal.throwIfAborted()
    if(original.width*original.height>LIMITS.pixels)throw new Error(`“${file.name}” is larger than 24 megapixels. Resize it before adding it.`)
    const scale = Math.min(1, 1280/Math.max(original.width, original.height))
    // Release each decoded full-size photo before preparing the next one.
    return await createImageBitmap(original, {resizeWidth:Math.max(1,Math.round(original.width*scale)), resizeHeight:Math.max(1,Math.round(original.height*scale)), resizeQuality:'high'})
  } finally {original.close()}
}

/** All image processing, effects and MP4 encoding happen locally. No upload or server fallback. */
export async function renderBrowserVideo({files,format,title,signal,onProgress}: {
  files:File[]; format:GlitchFormat; title:string; signal:AbortSignal; onProgress:(progress:Progress)=>void
}):Promise<RenderResult> {
  validateFiles(files)
  if(!Object.hasOwn(FORMATS,format))throw new Error('Choose one of the video sizes shown.')
  if(title.length>36)throw new Error('Keep the text overlay to 36 characters.')
  signal.throwIfAborted()
  const {width,height} = FORMATS[format]
  if(!await canEncodeVideo('avc',{width,height,frameRate:30,quality:new Quality({bitrate:BITRATE})}))throw new Error('MP4 export is unavailable for this size. '+BROWSER_HELP)
  signal.throwIfAborted()
  const seed = crypto.getRandomValues(new Uint32Array(1))[0]
  const assets = files.map((_,index)=>({name:`photo-${index}`,src:'',index}))
  const recipe = createRecipe(makeSequence(files.length,32,seed),assets,title.trim())
  // OffscreenCanvas is never composited into the page, so frames cannot be cleared
  // between GPU submission and encoding when the UI repaints.
  const canvas = new OffscreenCanvas(width,height)
  let film:Awaited<ReturnType<typeof createFilm>> | undefined
  let output:Output<Mp4OutputFormat,BufferTarget> | undefined
  let video:CanvasSource | undefined
  let finished = false
  let loaded = 0
  const started = performance.now()
  const abortOutput = () => {void output?.cancel().catch(()=>{})}
  signal.addEventListener('abort',abortOutput,{once:true})
  try {
    onProgress({stage:'preparing',percent:0})
    film = await createFilm(canvas,width,height,recipe,{
      fontUrl, signal,
      loadImage:async (asset:{index:number}) => {
        const bitmap = await loadPhoto(files[asset.index],signal)
        loaded++
        onProgress({stage:'preparing',percent:Math.round(loaded/files.length*5)})
        return bitmap
      },
    })
    signal.throwIfAborted()
    const target = new BufferTarget()
    output = new Output({format:new Mp4OutputFormat({fastStart:'in-memory'}),target})
    video = new CanvasSource(canvas,{codec:'avc',quality:new Quality({bitrate:BITRATE}),keyFrameInterval:2})
    output.addVideoTrack(video,{frameRate:recipe.fps})
    await output.start()
    for(let frame=0;frame<recipe.frames;frame++) {
      signal.throwIfAborted()
      await film.frame(frame)
      await video.add(frame/recipe.fps,1/recipe.fps)
      if(frame%6===0) {
        onProgress({stage:'rendering',percent:5+Math.floor((frame+1)/recipe.frames*90)})
        await yieldToBrowser()
      }
    }
    onProgress({stage:'encoding',percent:97})
    video.close()
    await output.finalize()
    signal.throwIfAborted()
    if(!target.buffer?.byteLength)throw new Error('The browser returned an empty video. Please try again.')
    const blob = new Blob([target.buffer],{type:'video/mp4'})
    finished = true
    return {blob,width,height,frames:recipe.frames,fps:recipe.fps,seconds:(performance.now()-started)/1000}
  } finally {
    signal.removeEventListener('abort',abortOutput)
    if(!finished)await output?.cancel().catch(()=>{})
    film?.dispose()
    canvas.width=1;canvas.height=1
  }
}
