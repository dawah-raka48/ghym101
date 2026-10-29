/**
 * Ghaym Center Revenue System — Google Apps Script backend
 * Setup: run setup() once, create an admin via setupAdmin(), then deploy as Web App.
 * Store no secrets in the GitHub front end.
 */
const SHEETS = { USERS:'Users', REPORTS:'Reports', SESSIONS:'Sessions', SETTINGS:'Settings', AUDIT:'Audit' };
const SESSION_HOURS = 8;
function setup(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const headers={
    Users:['id','name','username','passwordHash','salt','role','active','createdAt'],
    Reports:['id','date','employeeId','employeeName','students','network','transfer','qara','cash','total','pdfUrl','createdAt','updatedAt'],
    Sessions:['tokenHash','userId','expiresAt','createdAt'],
    Settings:['key','value'],
    Audit:['timestamp','actorId','action','recordId','details']
  };
  Object.entries(headers).forEach(([name,cols])=>{let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);if(sh.getLastRow()===0)sh.appendRow(cols)});
  const settings=ss.getSheetByName(SHEETS.SETTINGS);
  if(!settings.createTextFinder('DISPLAY_KEY').matchEntireCell(true).findNext())settings.appendRow(['DISPLAY_KEY',Utilities.getUuid()+Utilities.getUuid()]);
  SpreadsheetApp.getUi().alert('تم تجهيز جداول النظام. الخطوة التالية: شغّل setupAdmin() من محرر Apps Script لإنشاء المدير.');
}
function setupAdmin(){
  const ui=SpreadsheetApp.getUi();
  const name=ui.prompt('إنشاء المدير','أدخل اسم المدير العام',ui.ButtonSet.OK_CANCEL);
  if(name.getSelectedButton()!==ui.Button.OK)return;
  const username=ui.prompt('اسم المستخدم','أدخل اسم مستخدم المدير',ui.ButtonSet.OK_CANCEL);
  if(username.getSelectedButton()!==ui.Button.OK)return;
  const password=ui.prompt('كلمة المرور','أدخل كلمة مرور قوية (12 حرفًا على الأقل)',ui.ButtonSet.OK_CANCEL);
  if(password.getSelectedButton()!==ui.Button.OK)return;
  if(password.getResponseText().length<12)throw new Error('كلمة المرور يجب ألا تقل عن 12 حرفًا.');
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.USERS);
  if(!sh)throw new Error('شغّل setup() أولًا.');
  if(findUserByUsername_(username.getResponseText().trim()))throw new Error('اسم المستخدم مستخدم بالفعل.');
  const salt=Utilities.getUuid()+Utilities.getUuid();
  sh.appendRow([Utilities.getUuid(),name.getResponseText().trim(),username.getResponseText().trim(),hashPassword_(password.getResponseText(),salt),salt,'admin',true,new Date().toISOString()]);
  ui.alert('تم إنشاء المدير. احفظ بيانات الدخول في مكان آمن.');
}
function doGet(e){
  // Only the dedicated display URL may read aggregate totals; it never returns individual reports.
  const key=e&&e.parameter?e.parameter.display:'';
  if(!key||key!==getSetting_('DISPLAY_KEY'))return json_({ok:false,error:'غير مصرح'});
  return json_({ok:true,data:aggregate_()});
}
function doPost(e){
  try{
    const body=JSON.parse(e&&e.postData&&e.postData.contents||'{}');
    const action=String(body.action||'');
    if(action==='login')return json_(login_(body));
    if(action==='publicDisplay')return json_({ok:true,data:aggregate_()});
    if(action==='logout'){const u=auth_(body.token);if(u)deleteSession_(body.token);return json_({ok:true,data:{}})}
    const user=auth_(body.token);if(!user)throw new Error('انتهت الجلسة أو بيانات الدخول غير صحيحة. سجّل الدخول مرة أخرى.');
    if(action==='me')return json_({ok:true,data:{user:{id:user.id,name:user.name,username:user.username,role:user.role}}});
    if(action==='listReports')return json_({ok:true,data:{reports:listReports_(user)}});
    if(action==='saveReport')return json_({ok:true,data:saveReport_(user,body)});
    if(action==='deleteReport'){requireAdmin_(user);return json_({ok:true,data:deleteReport_(user,body.id)})}
    if(action==='listEmployees'){requireAdmin_(user);return json_({ok:true,data:{employees:listEmployees_()}})}
    if(action==='addEmployee'){requireAdmin_(user);return json_({ok:true,data:addEmployee_(user,body)})}
    throw new Error('الطلب غير معروف.');
  }catch(err){return json_({ok:false,error:err.message||'حدث خطأ غير متوقع.'})}
}
function login_(b){
  const u=findUserByUsername_(String(b.username||'').trim());
  if(!u||!u.active||hashPassword_(String(b.password||''),u.salt)!==u.passwordHash)throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة.');
  const token=Utilities.getUuid()+Utilities.getUuid();
  const expires=new Date(Date.now()+SESSION_HOURS*3600000).toISOString();
  sheet_(SHEETS.SESSIONS).appendRow([hashToken_(token),u.id,expires,new Date().toISOString()]);
  audit_(u.id,'LOGIN','', 'تم تسجيل الدخول');
  return {ok:true,data:{token,user:{id:u.id,name:u.name,username:u.username,role:u.role}}};
}
function auth_(token){
  if(!token)return null;
  const sh=sheet_(SHEETS.SESSIONS),rows=sh.getDataRange().getValues(),h=rows[0];
  const ix=Object.fromEntries(h.map((v,i)=>[v,i])),hash=hashToken_(token);
  for(let i=1;i<rows.length;i++)if(rows[i][ix.tokenHash]===hash){
    if(new Date(rows[i][ix.expiresAt]).getTime()<Date.now()){sh.deleteRow(i+1);return null}
    return findUserById_(rows[i][ix.userId]);
  }
  return null;
}
function saveReport_(u,b){
  const date=String(b.date||''),students=Number(b.students),network=Number(b.network||0),transfer=Number(b.transfer||0),qara=Number(b.qara||0),cash=Number(b.cash||0);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('اختر تاريخًا صحيحًا.');
  if(!Number.isInteger(students)||students<1)throw new Error('عدد الطلاب يجب أن يكون عددًا صحيحًا أكبر من صفر.');
  if([network,transfer,qara,cash].some(n=>!Number.isFinite(n)||n<0))throw new Error('مبالغ الدفع يجب ألا تكون سالبة.');
  const total=network+transfer+qara+cash;
  if(total<=0)throw new Error('أدخل مبلغًا واحدًا على الأقل.');
  const sh=sheet_(SHEETS.REPORTS),rows=sh.getDataRange().getValues(),h=rows[0],ix=Object.fromEntries(h.map((v,i)=>[v,i]));
  // One daily report per employee; manager can remove a mistaken report before re-entry.
  for(let i=1;i<rows.length;i++)if(rows[i][ix.date]===date&&rows[i][ix.employeeId]===u.id)throw new Error('لديك تقرير محفوظ لهذا اليوم. تواصل مع المدير لتصحيح التقرير الموجود.');
  const id=Utilities.getUuid(),now=new Date().toISOString(),pdf=String(b.pdfUrl||'').trim();
  if(pdf&&!/^https:\/\/drive\.google\.com\//i.test(pdf))throw new Error('يُقبل رابط ملف Google Drive فقط.');
  sh.appendRow([id,date,u.id,u.name,students,network,transfer,qara,cash,total,pdf,now,now]);
  audit_(u.id,'SAVE_REPORT',id,JSON.stringify({date,students,total}));
  return {id,total};
}
function listReports_(u){
  const sh=sheet_(SHEETS.REPORTS),rows=sh.getDataRange().getValues();if(rows.length<2)return [];
  const h=rows[0],ix=Object.fromEntries(h.map((v,i)=>[v,i]));
  return rows.slice(1).filter(r=>u.role==='admin'||r[ix.employeeId]===u.id).map(r=>({id:String(r[ix.id]),date:dateISO_(r[ix.date]),employeeId:r[ix.employeeId],employeeName:r[ix.employeeName],students:Number(r[ix.students]),network:Number(r[ix.network]),transfer:Number(r[ix.transfer]),qara:Number(r[ix.qara]),cash:Number(r[ix.cash]),total:Number(r[ix.total]),pdfUrl:r[ix.pdfUrl]||''})).reverse();
}
function deleteReport_(u,id){
  const sh=sheet_(SHEETS.REPORTS),rows=sh.getDataRange().getValues(),h=rows[0],ix=Object.fromEntries(h.map((v,i)=>[v,i]));
  for(let i=1;i<rows.length;i++)if(String(rows[i][ix.id])===String(id)){sh.deleteRow(i+1);audit_(u.id,'DELETE_REPORT',id,'حذف تقرير');return {deleted:true}}
  throw new Error('لم يتم العثور على التقرير.');
}
function listEmployees_(){const sh=sheet_(SHEETS.USERS),r=sh.getDataRange().getValues(),h=r[0],ix=Object.fromEntries(h.map((v,i)=>[v,i]));return r.slice(1).map(x=>({id:x[ix.id],name:x[ix.name],username:x[ix.username],role:x[ix.role],active:x[ix.active]===true||x[ix.active]==='TRUE'}))}
function addEmployee_(u,b){
  const name=String(b.name||'').trim(),username=String(b.username||'').trim(),password=String(b.password||''),role=b.role==='admin'?'admin':'employee';
  if(!name||!/^[\w.-]{3,40}$/.test(username))throw new Error('أدخل اسمًا واسم مستخدم من 3 إلى 40 حرفًا إنجليزيًا أو رقمًا أو نقطة أو شرطة.');
  if(password.length<12)throw new Error('كلمة المرور يجب ألا تقل عن 12 حرفًا.');
  if(findUserByUsername_(username))throw new Error('اسم المستخدم مستخدم بالفعل.');
  const salt=Utilities.getUuid()+Utilities.getUuid();sheet_(SHEETS.USERS).appendRow([Utilities.getUuid(),name,username,hashPassword_(password,salt),salt,role,true,new Date().toISOString()]);
  audit_(u.id,'ADD_EMPLOYEE','',username);return {created:true};
}
function aggregate_(){
  const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.REPORTS);if(!sh||sh.getLastRow()<2)return {total:0,students:0,network:0,transfer:0,qara:0,cash:0};
  const r=sh.getDataRange().getValues(),h=r[0],ix=Object.fromEntries(h.map((v,i)=>[v,i]));
  const sum=k=>r.slice(1).reduce((s,row)=>s+(Number(row[ix[k]])||0),0);
  return {total:sum('total'),students:sum('students'),network:sum('network'),transfer:sum('transfer'),qara:sum('qara'),cash:sum('cash')};
}
function findUserByUsername_(username){const sh=SpreadsheetApp.getActive().getSheetByName(SHEETS.USERS);if(!sh||sh.getLastRow()<2)return null;const r=sh.getDataRange().getValues(),h=r[0],ix=Object.fromEntries(h.map((v,i)=>[v,i]));for(let i=1;i<r.length;i++)if(String(r[i][ix.username]).toLowerCase()===username.toLowerCase())return userObj_(r[i],ix);return null}
function findUserById_(id){const sh=sheet_(SHEETS.USERS),r=sh.getDataRange().getValues(),h=r[0],ix=Object.fromEntries(h.map((v,i)=>[v,i]));for(let i=1;i<r.length;i++)if(r[i][ix.id]===id)return userObj_(r[i],ix);return null}
function userObj_(r,ix){return {id:r[ix.id],name:r[ix.name],username:r[ix.username],passwordHash:r[ix.passwordHash],salt:r[ix.salt],role:r[ix.role],active:r[ix.active]===true||r[ix.active]==='TRUE'}}
function sheet_(n){const s=SpreadsheetApp.getActive().getSheetByName(n);if(!s)throw new Error('لم يتم تجهيز جداول قاعدة البيانات. شغّل setup() أولًا.');return s}
function getSetting_(key){const sh=sheet_(SHEETS.SETTINGS),r=sh.getDataRange().getValues();for(let i=1;i<r.length;i++)if(r[i][0]===key)return String(r[i][1]);return ''}
function deleteSession_(token){const sh=sheet_(SHEETS.SESSIONS),r=sh.getDataRange().getValues(),h=r[0],ix=Object.fromEntries(h.map((v,i)=>[v,i]));for(let i=1;i<r.length;i++)if(r[i][ix.tokenHash]===hashToken_(token)){sh.deleteRow(i+1);return}}
function hashPassword_(p,salt){const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,salt+'|'+p,Utilities.Charset.UTF_8);return Utilities.base64Encode(bytes)}
function hashToken_(t){return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(t),Utilities.Charset.UTF_8))}
function dateISO_(d){if(d instanceof Date)return Utilities.formatDate(d,Session.getScriptTimeZone(),'yyyy-MM-dd');return String(d||'')}
function audit_(actor,action,id,details){try{sheet_(SHEETS.AUDIT).appendRow([new Date().toISOString(),actor,action,id,details])}catch(e){}}
function requireAdmin_(u){if(!u||u.role!=='admin')throw new Error('هذه الصلاحية للمدير العام فقط.')}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)}
