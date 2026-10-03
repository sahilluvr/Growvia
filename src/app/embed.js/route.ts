import { siteOrigin } from "@/lib/data";

export const dynamic = "force-dynamic";

/** <script src="https://…/embed.js" data-growvia-form="FORM_ID"></script> → an auto-sizing form on any website. */
export function GET() {
  const origin = siteOrigin();
  const js = `(function(){
  var O=${JSON.stringify(origin)};
  var S=document.querySelectorAll('script[data-growvia-form]:not([data-gv-done])');
  S.forEach(function(s){
    s.setAttribute('data-gv-done','1');
    var id=s.getAttribute('data-growvia-form'); if(!/^[0-9a-f-]{36}$/i.test(id))return;
    var q=new URLSearchParams(location.search), p=new URLSearchParams();
    p.set('parent',location.href); if(document.referrer)p.set('ref',document.referrer);
    q.forEach(function(v,k){ if(k.indexOf('utm_')===0)p.set(k,v); });
    var f=document.createElement('iframe');
    f.src=O+'/embed/'+id+'?'+p.toString(); f.title='Contact form'; f.loading='lazy';
    f.style.cssText='width:100%;border:0;min-height:420px;background:transparent;color-scheme:light';
    f.setAttribute('allow','clipboard-write');
    s.parentNode.insertBefore(f,s.nextSibling);
    window.addEventListener('message',function(e){
      if(e.origin!==O||!e.data||e.data.id!==id)return;
      if(e.data.type==='growvia:height')f.style.height=(e.data.h+8)+'px';
      if(e.data.type==='growvia:submitted'&&e.data.redirect)location.href=e.data.redirect;
    });
  });
})();`;
  return new Response(js, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" } });
}
