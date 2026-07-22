module.exports=[50227,(e,t,r)=>{t.exports=e.x("node:path",()=>require("node:path"))},57764,(e,t,r)=>{t.exports=e.x("node:url",()=>require("node:url"))},78911,(e,t,r)=>{t.exports=e.x("@prisma/client/runtime/client",()=>require("@prisma/client/runtime/client"))},30056,e=>e.a(async(t,r)=>{try{let t=await e.y("pg");e.n(t),r()}catch(e){r(e)}},!0),93695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},18622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},70406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},24361,(e,t,r)=>{t.exports=e.x("util",()=>require("util"))},14747,(e,t,r)=>{t.exports=e.x("path",()=>require("path"))},54799,(e,t,r)=>{t.exports=e.x("crypto",()=>require("crypto"))},27699,(e,t,r)=>{t.exports=e.x("events",()=>require("events"))},92509,(e,t,r)=>{t.exports=e.x("url",()=>require("url"))},22734,(e,t,r)=>{t.exports=e.x("fs",()=>require("fs"))},21517,(e,t,r)=>{t.exports=e.x("http",()=>require("http"))},24836,(e,t,r)=>{t.exports=e.x("https",()=>require("https"))},6461,(e,t,r)=>{t.exports=e.x("zlib",()=>require("zlib"))},88947,(e,t,r)=>{t.exports=e.x("stream",()=>require("stream"))},25451,e=>{"use strict";let t="Deero Institute";function r(){return process.env.EMAIL_BRAND_NAME?.trim()||process.env.INSTITUTE_NAME?.trim()||t}e.s(["DEFAULT_BRAND_NAME",0,t,"getBrandName",()=>r])},65103,e=>e.a(async(t,r)=>{try{var a=e.i(15270),i=e.i(133),s=t([a]);async function o(e){let t=e.to?String(e.to).trim():"";if(!t||!t.includes("@")){let t=await a.prisma.emailMessage.create({data:{to:e.to,subject:e.subject,text:e.text,meta:e.meta,status:"SKIPPED",error:"Missing/invalid email",sentAt:null}});return{ok:!0,status:"SKIPPED",id:t.id}}let r=await a.prisma.emailMessage.create({data:{to:t,subject:e.subject,text:e.text,meta:e.meta,status:"PENDING",error:null,sentAt:null}}),s=await (0,i.sendEmail)({to:t,subject:e.subject,text:e.text,html:e.html??null,attachments:e.attachments});return s.ok?(await a.prisma.emailMessage.update({where:{id:r.id},data:{status:"SENT",sentAt:new Date,providerMessageId:s.messageId??null}}),{ok:!0,status:"SENT",id:r.id}):(await a.prisma.emailMessage.update({where:{id:r.id},data:{status:"FAILED",error:s.error,sentAt:new Date}}),{ok:!1,status:"FAILED",id:r.id,error:s.error})}async function n(e){let t=new Date;return t.setDate(t.getDate()-e.withinDays),!!await a.prisma.emailMessage.findFirst({where:{createdAt:{gte:t},status:{in:["SENT","PENDING"]},AND:[{meta:{path:["kind"],equals:"ABSENCE_ALERT"}},{meta:{path:["studentId"],equals:e.studentId}},{meta:{path:["classId"],equals:e.classId}},{meta:{path:["absentCount"],equals:e.absentCount}}]}})}[a]=s.then?(await s)():s,e.s(["enqueueAndSendEmailMessage",()=>o,"hasRecentAbsenceEmailAlert",()=>n]),r()}catch(e){r(e)}},!1),72486,e=>{"use strict";var t=e.i(25451);function r(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function a(e){let a=e.brandName??t.DEFAULT_BRAND_NAME,i=Number.parseInt(process.env.EMAIL_FOOTER_YEAR??"",10),s=Number.isFinite(i)?i:Math.max(2026,new Date().getFullYear()),o=e.logoCid??null,n=e.logoUrl??null,l=e.contextTitle?r(e.contextTitle):r(e.subject),p=e.contextSubtitle?r(e.contextSubtitle):"";return{html:`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${r(e.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;background-color:#f6f7fb !important;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;-webkit-text-size-adjust:100%;color-scheme:light;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${r(e.subject)}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f6f7fb" style="background:#f6f7fb;background-color:#f6f7fb !important;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:640px;background:#ffffff !important;background-color:#ffffff !important;border:1px solid #e6e8ef;border-radius:14px;overflow:hidden;">
            <tr>
              <td bgcolor="#ffffff" style="padding:18px 20px;background:#ffffff !important;background-color:#ffffff !important;border-bottom:1px solid #e6e8ef;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      ${n?`<img src="${r(n)}" alt="${r(a)}" height="42" style="display:block;max-height:42px;width:auto;" />`:o?`<img src="cid:${o}" alt="${r(a)}" height="42" style="display:block;max-height:42px;width:auto;" />`:`<div style="font-weight:700;font-size:18px;line-height:1;color:#0f172a !important;">${r(a)}</div>`}
                    </td>
                    <td align="right" style="vertical-align:middle;font-size:12px;color:#64748b !important;">
                      ${r(new Date().toLocaleDateString())}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td bgcolor="#ffffff" style="padding:22px 20px 8px 20px;background:#ffffff !important;background-color:#ffffff !important;">
                <div style="font-size:20px;font-weight:750;color:#0f172a !important;line-height:1.25;margin-bottom:4px;">${l}</div>
                ${p?`<div style="margin-top:6px;font-size:13px;color:#475569 !important;line-height:1.5;">${p}</div>`:""}
              </td>
            </tr>

            <tr>
              <td bgcolor="#ffffff" style="padding:4px 20px 20px 20px;background:#ffffff !important;background-color:#ffffff !important;">
                <div style="margin-top:10px;padding:16px 16px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc !important;background-color:#f8fafc !important;color:#0f172a !important;font-size:14px;line-height:1.65;">
                  ${r(e.message).replace(/\n/g,"<br />")}
                </div>
              </td>
            </tr>

            <tr>
              <td bgcolor="#ffffff" style="padding:0 20px 20px 20px;background:#ffffff !important;background-color:#ffffff !important;">
                <div style="font-size:12px;color:#64748b !important;line-height:1.6;">
                  If you have any questions, please reply to this email to contact the ${r(a)} team.
                </div>
              </td>
            </tr>

            <tr>
              <td bgcolor="#fbfcff" style="padding:16px 20px;border-top:1px solid #e6e8ef;background:#fbfcff !important;background-color:#fbfcff !important;">
                <div style="font-size:12px;color:#64748b !important;line-height:1.6;">
                  &copy; ${s} ${r(a)}. All rights reserved.
                </div>
              </td>
            </tr>
          </table>

          <div style="max-width:640px;padding:10px 6px 0 6px;font-size:11px;color:#94a3b8;line-height:1.6;text-align:center;">
            This message was sent by ${r(a)}.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`,text:`${e.contextTitle?`${e.contextTitle}
`:""}${e.contextSubtitle?`${e.contextSubtitle}

`:""}${e.message}`}}e.s(["buildBroadcastEmailTemplate",()=>a])},16005,e=>{e.v(t=>Promise.all(["server/chunks/[externals]_node:buffer_00e2e67a._.js"].map(t=>e.l(t))).then(()=>t(51615)))},86314,e=>{e.v(t=>Promise.all(["server/chunks/[externals]_@prisma_client_runtime_query_compiler_bg_postgresql_mjs_49b2f844._.js"].map(t=>e.l(t))).then(()=>t(50492)))},45694,e=>{e.v(t=>Promise.all(["server/chunks/2e4a4_@prisma_client_runtime_query_compiler_bg_postgresql_wasm-base64_mjs_ead821ad._.js"].map(t=>e.l(t))).then(()=>t(4568)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__3436ff1f._.js.map