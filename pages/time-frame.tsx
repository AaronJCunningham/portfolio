import dynamic from 'next/dynamic'
import MetaDataHeader from '@/components/metadata/MetaDataHeader'

const OneFrame = dynamic(() => import('@/components/one-frame/OneFrame'), {ssr: false})

export default function TimeFramePage() {
  return <>
    <MetaDataHeader exactTitle title="One Frame — An impossible GPU expedition" content="Become a signal inside a GPU. Fly through memory canyons, wake a convoy of parallel lanes, and bring one frame to life. A playable world by Aaron J. Cunningham." canonical="https://aaronjcunningham.com/time-frame" image="https://aaronjcunningham.com/images/one-frame/preview.jpg" imageAlt="One Frame: a playable signal-courier flight through a copper-lit GPU city" />
    <OneFrame />
  </>
}
