import MetaDataHeader from '@/components/metadata/MetaDataHeader'
import InsideTheGPU from '@/components/community/tools/InsideTheGPU'

export default function InsideTheGPUPage() {
  return <>
    <MetaDataHeader exactTitle title="Inside the GPU — Aaron LVX" content="Walk through the hidden world that draws one frame. Seven interactive chambers, thousands of parallel jobs, and one image. A free GPU field trip, entirely in your browser." canonical="https://aaronjcunningham.com/community/tools/inside-the-gpu" image="https://aaronjcunningham.com/tools/inside-the-gpu/preview.jpg" imageAlt="Inside the GPU: a luminous frame emerging from seven chambers of a graphics pipeline" />
    <InsideTheGPU />
  </>
}
