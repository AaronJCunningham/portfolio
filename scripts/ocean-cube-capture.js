// This helper is served only by the local recording server, never by the site.
const recordPanel = document.createElement('div');
recordPanel.style.cssText = 'position:fixed;z-index:100;left:50%;top:20px;transform:translateX(-50%);background:#fff;padding:16px 24px;border:1px solid #abc;border-radius:8px;font:14px Arial;color:#173c43';
const recordButton = document.createElement('button');
recordButton.textContent = 'Record this page — 20 seconds';
recordPanel.append(recordButton);
document.body.append(recordPanel);

recordButton.addEventListener('click', async () => {
  let stream;
  try {
    recordButton.disabled = true;
    const mimeType = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.42001f', 'video/mp4', 'video/webm;codecs=vp9'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error('No supported recording codec.');
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {frameRate: 30, width: {ideal:1920}, height:{ideal:1080}},
      audio: false, preferCurrentTab: true, selfBrowserSurface: 'include',
    });
    recordPanel.hidden = true;
    document.getElementById('reset').click();
    const video = document.createElement('video');
    video.srcObject = stream; video.muted = true; video.playsInline = true;
    await video.play();
    await new Promise(resolve => setTimeout(resolve, 1600));
    const chunks = [];
    const recorder = new MediaRecorder(stream, {mimeType, videoBitsPerSecond: 12_000_000});
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    const finished = new Promise((resolve,reject) => {recorder.onstop=resolve;recorder.onerror=reject;});
    recorder.start();
    // Save a full-page still from the same capture source for the Works card.
    const poster = document.createElement('canvas');
    poster.width = video.videoWidth; poster.height = video.videoHeight;
    poster.getContext('2d').drawImage(video,0,0);
    poster.toBlob(async blob => {
      if (blob) await fetch('/__poster.jpg',{method:'POST',body:blob});
    },'image/jpeg',0.95);
    await new Promise(resolve=>setTimeout(resolve,20_000));
    if(recorder.state !== 'inactive') recorder.stop();
    await finished;
    stream.getTracks().forEach(track=>track.stop());
    const extension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
    const blob = new Blob(chunks,{type:mimeType});
    const response=await fetch('/__capture.'+extension,{method:'POST',body:blob});
    if(!response.ok)throw new Error('Could not save the recording.');
    recordPanel.hidden=false;
    recordPanel.textContent='Saved 20-second page recording ('+(blob.size/1e6).toFixed(1)+' MB).';
  } catch(error) {
    stream?.getTracks().forEach(track=>track.stop());
    recordPanel.hidden=false;
    recordPanel.textContent='Recording stopped: '+error.message;
  }
});
