import Head from "next/head";

export default function OceanCubePage() {
  return (
    <>
      <Head>
        <title>Six seas — Ocean cube</title>
        <meta name="description" content="An impossible ocean. Six faces, six directions of gravity." />
      </Head>
      <iframe
        title="Six seas — interactive ocean cube"
        src="/experiments/ocean-cube/index.html"
        style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0, zIndex: 100 }}
      />
    </>
  );
}
