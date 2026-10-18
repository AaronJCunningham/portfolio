import CommunityHeader from '@/components/community/CommunityHeader'
import MetaDataHeader from '@/components/metadata/MetaDataHeader'
import GlitchStudio from '@/components/community/tools/GlitchStudio'

export default function GlitchStudioPage() {
  return <>
    <MetaDataHeader exactTitle title="Glitch Studio — Aaron LVX" content="Create a free video from up to 32 photos, entirely in your browser. Choose from two sizes for social media or Instagram posts and save an MP4. Your photos stay on your device." canonical="https://aaronjcunningham.com/community/tools/glitch-studio" image="https://aaronjcunningham.com/tools/glitch-studio/preview.jpg" imageAlt="An example video created from photos using Glitch Studio" />
    <div className="glitch-studio">
      <CommunityHeader />
      <GlitchStudio />
    </div>
  </>
}
