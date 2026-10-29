/* Ghaym Center Revenue System
   Configure API_URL after deploying Code.gs as a Google Apps Script web app.
*/
const API_URL = "https://script.google.com/macros/s/AKfycbyQbd5XVHAffBcnXW3WbIUdLAzwTjm45evzRxMqsUDVjp5U3NMXEr6DsqWTbglPXdkzaA/exec";
const $ = (id) => document.getElementById(id);
const state = { user:null, token:null, reports:[], employees:[], view:null };
const money = n => (Number(n)||0).toLocaleString('ar-SA',{maximumFractionDigits:2})+' ر.س';

function amountInArabicWords(value){
  let n=Math.round((Number(value)||0)*100)/100;
  if(n<0)return 'سالب '+amountInArabicWords(-n);
  const ones=['','واحد','اثنان','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة'];
  const teens=['عشرة','أحد عشر','اثنا عشر','ثلاثة عشر','أربعة عشر','خمسة عشر','ستة عشر','سبعة عشر','ثمانية عشر','تسعة عشر'];
  const tens=['','','عشرون','ثلاثون','أربعون','خمسون','ستون','سبعون','ثمانون','تسعون'];
  const hundreds=['','مائة','مائتان','ثلاثمائة','أربعمائة','خمسمائة','ستمائة','سبعمائة','ثمانمائة','تسعمائة'];
  function under1000(x){
    const parts=[];const h=Math.floor(x/100),r=x%100;
    if(h)parts.push(hundreds[h]);
    if(r>=10&&r<20)parts.push(teens[r-10]);
    else {const u=r%10,t=Math.floor(r/10);if(u&&t)parts.push(ones[u]+' و'+tens[t]);else if(u)parts.push(ones[u]);else if(t)parts.push(tens[t]);}
    return parts.join(' و');
  }
  function group(x,one,two,plural){
    if(x===0)return '';
    if(x===1)return one;
    if(x===2)return two;
    if(x>=3&&x<=10)return under1000(x)+' '+plural;
    return under1000(x)+' '+one;
  }
  const whole=Math.floor(n), halalas=Math.round((n-whole)*100);
  if(whole===0 && halalas===0)return 'صفر ريال سعودي فقط لا غير';
  const scales=[{v:1e9,one:'مليار',two:'ملياران',plural:'مليارات'},{v:1e6,one:'مليون',two:'مليونان',plural:'ملايين'},{v:1e3,one:'ألف',two:'ألفان',plural:'آلاف'}];
  let rest=whole;const parts=[];
  for(const s of scales){const q=Math.floor(rest/s.v);rest%=s.v;if(q)parts.push(group(q,s.one,s.two,s.plural));}
  if(rest)parts.push(under1000(rest));
  let words=parts.join(' و');
  words += (whole===1?' ريال سعودي':whole===2?' ريالان سعوديان':' ريال سعودي');
  if(halalas)words+=' و'+under1000(halalas)+(halalas===1?' هللة':halalas===2?' هللتان':' هللة') ;
  return words+' فقط لا غير';
}

const dateText = d => d ? new Date(d).toLocaleDateString('ar-SA') : '—';
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const todayISO = () => {const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
$('today').textContent = new Date().toLocaleDateString('ar-SA',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
$('year').textContent = new Date().getFullYear();
if(!API_URL){$('setupNotice').classList.remove('hidden');}
async function api(action,data={}) {
  if(!API_URL) throw new Error('النظام غير مربوط بعد. أضف رابط Google Apps Script في app.js حسب ملف README.md.');
  const res = await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,token:state.token,...data})});
  const json=await res.json();
  if(!json.ok) throw new Error(json.error||'تعذر تنفيذ الطلب');
  return json.data;
}
function forceLogin(){state.user=null;state.token=null;state.reports=[];state.employees=[];sessionStorage.removeItem('ghymToken');sessionStorage.removeItem('ghymUser');$('loginView').classList.remove('hidden');$('dashboardView').classList.add('hidden');$('logoutBtn').classList.add('hidden');const cleanUrl=location.origin+location.pathname.replace(/[^/]*$/,'index.html');if(location.href!==cleanUrl)history.replaceState(null,'',cleanUrl);}
function showLogin(){ forceLogin(); }
function showDashboard(){ $('loginView').classList.add('hidden');$('dashboardView').classList.remove('hidden');$('logoutBtn').classList.remove('hidden');$('welcomeTitle').textContent='أهلًا، '+(state.user.name||state.user.username);$('roleBadge').textContent=state.user.role==='admin'?'المدير العام':'موظف';const admin=state.user.role==='admin';$('managerStats').classList.toggle('hidden',!admin);$('managerActions').classList.toggle('hidden',!admin);$('employeeActions').classList.toggle('hidden',admin);$('recentPanel').classList.toggle('hidden',!admin); }
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginError').textContent='';const btn=e.submitter;btn.disabled=true;try{const d=await api('login',{username:$('username').value.trim(),password:$('password').value});state.token=d.token;state.user=d.user;sessionStorage.setItem('ghymToken',state.token);sessionStorage.setItem('ghymUser',JSON.stringify(state.user));showDashboard();await loadReports();}catch(err){$('loginError').textContent=err.message;}finally{btn.disabled=false;}});
$('logoutBtn').addEventListener('click',async()=>{try{await api('logout')}catch{}forceLogin()});
$('refreshBtn').addEventListener('click',loadReports);
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>openView(b.dataset.view)));
$('backBtn').addEventListener('click',()=>{$('contentPanel').classList.add('hidden');$('recentPanel').classList.toggle('hidden',state.user.role!=='admin')});
async function loadReports(){try{const d=await api('listReports');state.reports=d.reports||[];renderRecent();if(state.user.role==='admin'){const all=state.reports;const revenueTotal=all.reduce((s,r)=>s+Number(r.total||0),0);$('statRevenue').textContent=money(revenueTotal);const wordsEl=$('statRevenueWords');if(wordsEl)wordsEl.textContent=amountInArabicWords(revenueTotal);$('statInvoices').textContent=all.reduce((s,r)=>s+Number(r.students||0),0).toLocaleString('ar-SA');$('statToday').textContent=all.filter(r=>r.date===todayISO()).length.toLocaleString('ar-SA');}}catch(e){if(state.user.role==='admin')$('recentReports').innerHTML='<p class="muted">'+esc(e.message)+'</p>';}}
function renderRecent(){const rows=state.reports.slice(0,8);$('recentReports').innerHTML=rows.length?tableHTML(rows,false):'<div class="empty">لا توجد تقارير مسجلة حتى الآن.</div>'}
function tableHTML(rows,manage){return '<table><thead><tr><th>التاريخ</th>'+(manage?'<th>الموظف</th>':'')+'<th>عدد الطلاب</th><th>الإجمالي</th><th>الشبكة</th><th>تحويل</th><th>قرة</th><th>نقدًا</th><th>ملف PDF</th>'+(manage?'<th>إجراء</th>':'')+'</tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(dateText(r.date))+'</td>'+(manage?'<td>'+esc(r.employeeName||'—')+'</td>':'')+'<td>'+esc(r.students)+'</td><td><b>'+esc(money(r.total))+'</b></td><td>'+esc(money(r.network))+'</td><td>'+esc(money(r.transfer))+'</td><td>'+esc(money(r.qara))+'</td><td>'+esc(money(r.cash))+'</td><td>'+(r.pdfUrl?'<a class="pill" href="'+esc(r.pdfUrl)+'" target="_blank" rel="noopener">فتح PDF</a>':'—')+'</td>'+(manage?'<td><button class="btn ghost" data-delete="'+esc(r.id)+'">حذف</button></td>':'')+'</tr>').join('')+'</tbody></table>'}
async function openView(view){state.view=view;$('contentPanel').classList.remove('hidden');$('recentPanel').classList.add('hidden');$('contentTitle').textContent=({entry:'إدخال إيراد',reports:'التقارير والإيرادات',myreports:'تقاريري',employees:'إدارة الموظفين'})[view]||view;const body=$('contentBody');body.innerHTML='<p class="muted">جارٍ التحميل…</p>';if(view==='entry')renderEntry();else if(view==='reports'||view==='myreports'){await loadReports();body.innerHTML='<div class="filter-row"><input id="reportSearch" placeholder="بحث بالتاريخ أو الموظف"><button id="printReports" class="btn ghost">طباعة التقرير</button></div><div id="reportsTable" class="table-wrap"></div>';renderReportTable(view==='reports');$('reportSearch').addEventListener('input',()=>renderReportTable(view==='reports'));$('printReports').onclick=()=>window.print();}else if(view==='employees')await renderEmployees();}
function renderEntry(){ $('contentBody').innerHTML='<form id="revenueForm"><div class="form-grid"><div><label>تاريخ التقرير</label><input name="date" type="date" required value="'+todayISO()+'"></div><div><label>عدد الطلاب / الفواتير</label><input name="students" type="number" min="1" step="1" required placeholder="أدخل العدد"></div><div class="wide"><label>مبالغ طرق الدفع (ريال سعودي)</label><div class="payment-grid">'+[['network','الشبكة'],['transfer','التحويل البنكي'],['qara','قرة'],['cash','نقدًا']].map(([n,l])=>'<div class="payment-box"><label>'+l+'</label><input name="'+n+'" type="number" min="0" step="0.01" value="0" required></div>').join('')+'</div></div><div class="wide total-box"><span>الإجمالي المحسوب</span><b id="formTotal">٠ ر.س</b></div><div class="wide"><label>إرفاق التقرير اليومي (PDF) — إلزامي</label><input name="pdfFile" type="file" accept="application/pdf,.pdf" required><small class="muted">اختر ملف PDF من جهازك. الحد الأقصى 8 ميجابايت، وسيُحفظ تلقائيًا في Google Drive.</small></div></div><div class="form-actions"><button class="btn primary" type="submit">حفظ الإيراد</button><button class="btn ghost" type="reset">مسح الحقول</button></div><p id="entryMessage" class="error"></p></form>';const form=$('revenueForm');const calc=()=>{const fd=new FormData(form);const total=['network','transfer','qara','cash'].reduce((s,k)=>s+Math.max(0,Number(fd.get(k))||0),0);$('formTotal').textContent=money(total)};form.addEventListener('input',calc);form.addEventListener('reset',()=>setTimeout(calc,0));form.addEventListener('submit',async e=>{e.preventDefault();const btn=form.querySelector('[type=submit]');const file=form.querySelector('[name=pdfFile]').files[0];if(!file){$('entryMessage').textContent='إرفاق ملف PDF إلزامي قبل الحفظ.';return}if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf')){$('entryMessage').textContent='يُرجى اختيار ملف PDF فقط.';return}if(file.size>8*1024*1024){$('entryMessage').textContent='حجم الملف يتجاوز 8 ميجابايت.';return}btn.disabled=true;$('entryMessage').className='muted';$('entryMessage').textContent='جارٍ رفع ملف PDF وحفظ الإيراد…';const fd=new FormData(form);const payload=Object.fromEntries([...fd.entries()].filter(([k])=>k!=='pdfFile'));payload.students=Number(payload.students);for(const k of ['network','transfer','qara','cash'])payload[k]=Number(payload[k]||0);payload.total=payload.network+payload.transfer+payload.qara+payload.cash;try{payload.pdfFileName=file.name;payload.pdfBase64=await fileToBase64(file);payload.pdfMimeType=file.type||'application/pdf';await api('saveReport',payload);$('entryMessage').className='';$('entryMessage').textContent='تم رفع ملف PDF وحفظ الإيراد بنجاح، وسيظهر مباشرة في الإجماليات وشاشة المركز.';form.reset();form.querySelector('[name=date]').value=todayISO();calc();await loadReports()}catch(err){$('entryMessage').className='error';$('entryMessage').textContent=err.message}finally{btn.disabled=false}});calc();}
function fileToBase64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.onerror=()=>reject(new Error('تعذرت قراءة ملف PDF من الجهاز.'));reader.readAsDataURL(file)})}
function renderReportTable(manage){const q=($('reportSearch')?.value||'').trim().toLowerCase();const rows=state.reports.filter(r=>!q||[r.date,r.employeeName,r.students,r.total].some(x=>String(x||'').toLowerCase().includes(q)));$('reportsTable').innerHTML=rows.length?tableHTML(rows,manage):'<div class="empty">لا توجد نتائج.</div>';if(manage)$('reportsTable').querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('هل تريد حذف هذا التقرير؟ سيؤثر الحذف على إجماليات الإيرادات.'))return;try{await api('deleteReport',{id:b.dataset.delete});await loadReports();renderReportTable(true)}catch(e){alert(e.message)}})}
async function renderEmployees(){const body=$('contentBody');body.innerHTML='<form id="employeeForm" class="form-grid"><div><label>الاسم</label><input name="name" required></div><div><label>اسم المستخدم</label><input name="username" required autocomplete="off"></div><div><label>كلمة مرور مؤقتة</label><input name="password" type="password" required minlength="8" autocomplete="new-password"></div><div><label>الصلاحية</label><select name="role"><option value="employee">موظف</option><option value="admin">مدير عام</option></select></div><div class="wide"><button class="btn primary" type="submit">إضافة الموظف</button><p id="employeeMessage" class="muted"></p></div></form><div id="employeesList"></div>';try{const d=await api('listEmployees');$('employeesList').innerHTML='<div class="table-wrap"><table><thead><tr><th>الاسم</th><th>اسم المستخدم</th><th>الصلاحية</th><th>الحالة</th></tr></thead><tbody>'+(d.employees||[]).map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+esc(x.username)+'</td><td>'+ (x.role==='admin'?'مدير عام':'موظف')+'</td><td>'+ (x.active?'نشط':'موقوف')+'</td></tr>').join('')+'</tbody></table></div>'}catch(e){$('employeesList').textContent=e.message} $('employeeForm').onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target).entries());try{await api('addEmployee',data);$('employeeMessage').textContent='تمت إضافة الموظف';await renderEmployees()}catch(err){$('employeeMessage').textContent=err.message}}}
try{const t=sessionStorage.getItem('ghymToken'),u=sessionStorage.getItem('ghymUser');if(t&&u){state.token=t;state.user=JSON.parse(u);api('me').then(d=>{if(!d||!d.user)throw new Error('جلسة غير صالحة');state.user=d.user;showDashboard();loadReports()}).catch(()=>{forceLogin()})}else showLogin()}catch{showLogin()}
