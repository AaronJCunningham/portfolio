import CommunityHeader from '@/components/community/CommunityHeader'
import MetaDataHeader from '@/components/metadata/MetaDataHeader'
import GlitchStudio from '@/components/community/tools/GlitchStudio'

export default function GlitchStudioPage() {
  return <>
    <MetaDataHeader exactTitle title="Glitch Studio — Aaron LVX" content="A free tool by Aaron LVX to create videos from up to 32 photos. Choose from two video sizes for social media or Instagram posts and download an MP4." canonical="https://aaronjcunningham.com/community/tools/glitch-studio" image="https://aaronjcunningham.com/tools/glitch-studio/preview.jpg" imageAlt="An example video created from photos using Glitch Studio" />
    <div className="glitch-studio">
      <CommunityHeader />
      <GlitchStudio />
    </div>
  </>
}
