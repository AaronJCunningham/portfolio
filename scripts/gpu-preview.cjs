// Optional macOS artwork regeneration: node scripts/gpu-preview.cjs
// Uses existing TypeScript and system sips; no packages or network.
// The poster depicts the actual teaching renderer, not a browser screenshot.
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { execFileSync } = require('node:child_process')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const model = { exports: {} }
new Function('exports', ts.transpileModule(fs.readFileSync(path.join(root, 'src/components/community/tools/gpu-pipeline-model.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(model.exports)
const frame = model.exports.createFrame(96, 60)
const count = model.exports.operationCounts(frame).total.toLocaleString('en-US')
const colors = new Map(frame.winners.map(f => [f.pixel, f.color]))
const project = (x, y) => [900 + x * 6.2 - y * 2.7, 160 + x * 1.25 + y * 6.1]
const ink = [.953,.933,.922], accent = [.98,.463,.325], muted = [.61,.655,.66]
let commands = '1 0 0 -1 0 1000 cm\n'
const fill = color => { commands += `${color.join(' ')} rg\n` }
const line = (points, color, width = 1) => {
  commands += `${color.join(' ')} RG ${width} w ${points.map(([x,y],i)=>`${x} ${y} ${i ? 'l' : 'm'}`).join(' ')} S\n`
}
const polygon = (points, color) => {
  fill(color); commands += points.map(([x,y],i)=>`${x} ${y} ${i ? 'l' : 'm'}`).join(' ') + ' h f\n'
}
const quad = (x,y,dx,dy,color) => polygon([[x,y],[x+dx,y],[x+dx,y+dy],[x,y+dy]].map(([a,b])=>project(a,b)),color)
const text = (value,x,y,size,color=ink,font='F1') => {
  fill(color); commands += `BT /${font} ${size} Tf 1 0 0 -1 ${x} ${y} Tm (${value.replace(/[\\()]/g,'\\$&')}) Tj ET\n`
}
fill([.0314,.0471,.0549]); commands += '0 0 1600 1000 re f\n'
line([[64,100],[1536,100]],[.14,.2,.21]); line([[64,902],[1536,902]],[.14,.2,.21])
const ellipse = Array.from({length:121},(_,i)=>[1110+370*Math.cos(i*Math.PI/60),398+340*Math.sin(i*Math.PI/60)])
line(ellipse,[.30,.20,.16])
for(let i=0;i<25;i++) line([[580+i*36,840],[780+i*24,700],[780+i*24,640]],[.10,.16,.17])
quad(-2,-2,100,64,[.5,.34,.24]); quad(-1.6,-1.6,99.2,63.2,[.055,.08,.095])
for(let i=0;i<frame.width*frame.height;i++) {
  const color=colors.get(i) ?? [.015,.024,.03]
  quad(i%frame.width,frame.height-1-Math.floor(i/frame.width),.87,.87,color.map(v=>Math.pow(Math.min(1,v),1/2.2)))
}
text('AARON LVX / INTERACTIVE FIELD TRIP 003',64,66,19)
text('FROM DRAW CALL TO DISPLAY',64,226,15,accent,'F2')
text('Inside',58,370,144); text('the',58,505,144); text('GPU.',278,505,144,accent)
text('A journey through one frame.',64,558,22,muted)
text('FRAME 001 / 96 x 60',930,140,13,muted,'F2')
text(count,64,757,104)
text('WORK ITEMS. ONE FRAME.',68,806,23,accent)
text('Actual teaching-scene counts / not hardware instructions',68,845,15,muted)
text('COMMAND > VERTICES > RASTERIZE > SHADE > DEPTH > BLEND > PRESENT',64,950,17,muted,'F2')
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1600 1000] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>',
  `<< /Length ${Buffer.byteLength(commands)} >>\nstream\n${commands}endstream`,
]
let pdf='%PDF-1.4\n', offsets=[0]
objects.forEach((object,i)=>{ offsets.push(Buffer.byteLength(pdf)); pdf+=`${i+1} 0 obj\n${object}\nendobj\n` })
const xref=Buffer.byteLength(pdf)
pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gpu-preview-'))
try {
  const input=path.join(dir,'preview.pdf'),output=path.join(root,'public/tools/inside-the-gpu/preview.jpg')
  fs.writeFileSync(input,pdf); fs.mkdirSync(path.dirname(output),{recursive:true})
  execFileSync('sips',['-s','format','jpeg','-s','formatOptions','88',input,'--out',output],{stdio:'inherit'})
} finally { fs.rmSync(dir,{recursive:true,force:true}) }
