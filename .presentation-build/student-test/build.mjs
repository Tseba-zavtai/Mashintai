import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Presentation, PresentationFile } from '@oai/artifact-tool';
const root='D:/TSEBA/TSEBA/Tureestei/Cod/Tureestei';
const build=path.join(root,'.presentation-build/student-test');
const skill='C:/Users/project_manager/.codex/plugins/cache/openai-primary-runtime/presentations/26.1007.11041/skills/presentations';
const runtime='C:/Users/project_manager/.cache/codex-runtimes/codex-primary-runtime/dependencies';
process.env.RUNTIME_NODE_MODULES=path.join(runtime,'node/node_modules');
const out=path.join(root,'output/student-test/Tureesly-student-testing.pptx');
const p=Presentation.create({slideSize:{width:1280,height:720}});
const purple='#7409B7', ink='#251B35', cream='#FFF4F0';
function text(s,str,x,y,w,h,size=30,color=ink,bold=false){const a=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});a.text=str;a.text.style={typeface:'Arial',fontSize:size,color,bold};return a;}
function slide(title,bg=cream){const s=p.slides.add();s.background.fill=bg;text(s,title,68,58,1100,96,44,bg===purple?cream:purple,true);return s;}
async function poster(s,n){const b=await fs.readFile(`D:/TSEBA/TSEBA/Tureestei/Doc/StorePoster/iOS ${n}.png`);s.images.add({blob:b,contentType:'image/png',alt:'Tureesly аппын дэлгэц',fit:'contain',position:{left:920,top:166,width:258,height:510}});s.speakerNotes.text=`Аппын зураг: хэрэглэгчийн өгсөн StorePoster/iOS ${n}.png. Зураг нь өмнөх хувилбарын дэлгэц тул шинэ хувилбарт зарим харагдац өөр байж болно.`;}
function entry(s,n,title,body,y,w=750){text(s,n,68,y,58,52,34,purple,true);text(s,title,144,y,w,46,29,ink,true);text(s,body,144,y+52,w,86,25,ink);}
let s=slide('Tureesly',purple);text(s,'Оюутнуудад зориулсан\nаппын туршилт',68,210,760,156,56,cream,true);text(s,'Хэрэгтэй зүйлээ түрээслэх,\nөөрийн зүйлээ түрээслүүлэх зарын апп',68,414,745,112,31,cream);text(s,'Туршилтад нэгдэхээр имэйлээ илгээсэн танд баярлалаа.',68,598,780,62,24,cream);await poster(s,2);
s=slide('Суулгах заавар');entry(s,'01','Имэйл дэх холбоос','Өөрийн утсанд тохирох Android эсвэл iOS\nсуулгах холбоосыг нээнэ.',178,960);entry(s,'02','Туршилтад бүртгүүлсэн хаяг','Урилга хүлээн авсан имэйл хаягаа ашиглана.\niPhone дээр TestFlight-ийн зааврыг дагана.',344,960);entry(s,'03','Суулгалтад асуудал гарвал','Гарсан мэдэгдлийн зураг болон утасныхаа загварыг\nэнэ имэйлд хариу болгон явуулна.',510,960);
s=slide('Бүртгэл ба нэвтрэлт');entry(s,'01','DAN-аар бүртгүүлэх','Аппын зааврын дагуу мэдээллээ баталгаажуулна.',172);entry(s,'02','Бүртгэлээ дуусгах','Үйлчилгээний нөхцөлтэй танилцаж зөвшөөрөөд,\nутасны дугаар болон нууц үгээ хадгална.',324);entry(s,'03','Дахин нэвтрэх туршилт','Гараад, хадгалсан утасны дугаар болон\nнууц үгээрээ дахин нэвтэрч үзнэ.',482);await poster(s,7);
s=slide('Хэрэгтэй зүйлээ хайх');entry(s,'01','Хайлт ба ангилал','Камер, дугуй, майхан зэрэг өөрт хэрэгтэй\nзүйлээ хайж, ангиллаар шүүнэ.',176);entry(s,'02','Ойролцоох зар','Байршлын хэсгээр өөрт ойр байгаа\nтүрээсийн заруудыг үзнэ.',337);entry(s,'03','Зарын дэлгэрэнгүй','Үнэ, зураг, тайлбарыг шалгаад\nсонирхсон зараа хадгалж үзнэ.',498);await poster(s,3);
s=slide('Өөрийн зарын туршилт');entry(s,'01','Зар оруулах','Өөрийн бодит эд зүйлийн зураг, тайлбар,\nтүрээсийн үнэ болон мэдээллийг оруулна.',170);entry(s,'02','Миний зарууд','Зараа харах, түр идэвхгүй болгох,\nдахин идэвхжүүлэх үйлдлийг туршина.',329);text(s,'Төлбөртэй үйлдэл',144,501,730,44,29,purple,true);text(s,'Зарын эрх, Pump, Sponsored нь төлбөртэй.\nТуршилтад оролцохын тулд бодит төлбөр\nхийх шаардлагагүй.',144,550,730,114,25);await poster(s,5);
s=slide('Алдаа ба санал хүсэлт');text(s,'Энэ имэйлд хариу бичээд дараах мэдээллийг явуулаарай.',68,166,1136,60,28);entry(s,'01','Юу хийх үед гарсан бэ?','Дарсан товч, хийсэн алхам, хүлээсэн үр дүнгээ бичнэ.',261,960);entry(s,'02','Юу харагдсан бэ?','Алдааны screenshot эсвэл богино бичлэг хавсаргана.\nУтасны загвар, Android / iOS хувилбараа бичнэ.',407,960);text(s,'Нууц үг, DAN баталгаажуулалтын код, хувийн мэдээллээ бүү явуулаарай.',68,612,1136,62,23,purple,true);
for(let i=0;i<p.slides.items.length;i++){const png=await p.export({slide:p.slides.items[i],format:'png',scale:1});await fs.writeFile(path.join(build,`slide-${i+1}.png`),new Uint8Array(await png.arrayBuffer()));}
const candidate=path.join(build,'candidate.pptx');await(await PresentationFile.exportPptx(p)).save(candidate);
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')).href);
await finalizePresentation({workspaceDir:root,candidatePath:candidate,finalPath:out,pythonExecutable:path.join(runtime,'python/python.exe'),integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit'],fontPolicy:{basis:'design',families:['Arial']},verifyArtifactToolImport:true,receiptPath:path.join(build,'validation.json')});
console.log(out);
