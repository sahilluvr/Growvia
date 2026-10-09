import { siteOrigin } from "@/lib/data";

export const revalidate = 86400; // static file at the CDN — no function run per website visitor

/**
 * <script src="https://…/embed.js" data-growvia-form="FORM_ID"></script>
 *   → an auto-sizing iframe form (restyle it with Forms → Design → Custom CSS).
 * <script … data-growvia-form="FORM_ID" data-mode="inline"></script>
 *   → a real <form> written straight into the page, so the website's own CSS styles it (gv-* classes).
 *     Spam on the website itself is stopped by the hidden trap field + per-device rate limit (the human check only runs on Growvia pages).
 */
export function GET() {
  const origin = siteOrigin();
  const js = `(function(){
  var O=${JSON.stringify(origin)};
  function utm(){var q=new URLSearchParams(location.search),u={};q.forEach(function(v,k){if(k.indexOf('utm_')===0)u[k]=v;});return u;}
  function el(t,a,txt){var e=document.createElement(t);for(var k in a){if(a[k]===true)e.setAttribute(k,'');else if(a[k]!==false&&a[k]!=null)e.setAttribute(k,a[k]);}if(txt!=null)e.textContent=txt;return e;}
  // Layout-only defaults wrapped in :where() (zero specificity) so any CSS on the website wins.
  function baseCss(){if(document.getElementById('gv-base-css'))return;var st=el('style',{id:'gv-base-css'});
    st.textContent=':where(.gv-form){display:grid;gap:14px;max-width:100%}:where(.gv-field){display:grid;gap:6px}:where(.gv-field-checkbox){display:flex;align-items:flex-start;gap:8px}:where(.gv-input,.gv-select,.gv-textarea){width:100%;box-sizing:border-box;font:inherit}:where(.gv-textarea){min-height:96px}:where(.gv-hp){position:absolute!important;left:-9999px!important;width:1px;height:1px;opacity:0}:where(.gv-error){color:#b91c1c}:where(.gv-branding){font-size:11px;opacity:.6;text-align:center}';
    document.head.appendChild(st);}
  function iframe(s,id){
    var p=new URLSearchParams();p.set('parent',location.href);if(document.referrer)p.set('ref',document.referrer);
    var u=utm();for(var k in u)p.set(k,u[k]);
    var f=document.createElement('iframe');
    f.src=O+'/embed/'+id+'?'+p.toString();f.title='Contact form';f.loading='lazy';
    f.style.cssText='width:100%;border:0;min-height:420px;background:transparent;color-scheme:light';
    f.setAttribute('allow','clipboard-write');
    s.parentNode.insertBefore(f,s.nextSibling);
    window.addEventListener('message',function(e){
      if(e.origin!==O||!e.data||e.data.id!==id)return;
      if(e.data.type==='growvia:height')f.style.height=(e.data.h+8)+'px';
      if(e.data.type==='growvia:submitted'&&e.data.redirect)location.href=e.data.redirect;
    });
  }
  function inline(s,id){
    var box=el('div',{'class':'gv-embed gv-embed-inline','data-growvia-form':id});
    s.parentNode.insertBefore(box,s.nextSibling);
    fetch(O+'/api/forms/'+id).then(function(r){return r.json();}).then(function(d){
      if(!d||!d.ok){box.remove();iframe(s,id);return;}
      baseCss();
      if(d.intro)box.appendChild(el('p',{'class':'gv-intro'},d.intro));
      var form=el('form',{'class':'gv-form',novalidate:false});
      d.fields.forEach(function(f){
        var fid='gv-'+id.slice(0,8)+'-'+f.id;
        var wrap=el('div',{'class':'gv-field gv-field-'+f.type+' gv-field-'+f.id});
        if(f.type==='checkbox'){
          var cb=el('input',{type:'checkbox',name:f.id,id:fid,'class':'gv-checkbox',required:!!f.required});
          wrap.appendChild(cb);wrap.appendChild(el('label',{'for':fid,'class':'gv-label'},f.label));
        }else{
          var lab=el('label',{'for':fid,'class':'gv-label'},f.label);
          if(!f.required)lab.appendChild(el('span',{'class':'gv-optional'},' (optional)'));
          wrap.appendChild(lab);
          var inp;
          if(f.type==='textarea')inp=el('textarea',{name:f.id,id:fid,'class':'gv-textarea',rows:'4',maxlength:'2000',placeholder:f.placeholder||null,required:!!f.required});
          else if(f.type==='select'){
            inp=el('select',{name:f.id,id:fid,'class':'gv-select',required:!!f.required});
            var o0=el('option',{value:'',disabled:true,selected:true},'Choose…');inp.appendChild(o0);
            (f.options||[]).forEach(function(o){inp.appendChild(el('option',{value:o},o));});
          }else inp=el('input',{type:f.type,name:f.id,id:fid,'class':'gv-input',maxlength:f.type==='tel'?'40':'200',placeholder:f.placeholder||null,autocomplete:f.autocomplete||'off',required:!!f.required});
          wrap.appendChild(inp);
        }
        form.appendChild(wrap);
      });
      form.appendChild(el('input',{type:'text',name:'_gv_hp','class':'gv-hp',tabindex:'-1',autocomplete:'off','aria-hidden':'true'}));
      var err=el('p',{'class':'gv-error',role:'alert',hidden:true});form.appendChild(err);
      var btn=el('button',{type:'submit','class':'gv-button'},d.button);form.appendChild(btn);
      box.appendChild(form);
      if(d.branding){var b=el('p',{'class':'gv-branding'});var a=el('a',{href:O,target:'_blank',rel:'noopener'},'Powered by Growvia');b.appendChild(a);box.appendChild(b);}
      form.addEventListener('submit',function(e){
        e.preventDefault();err.hidden=true;btn.disabled=true;var label=btn.textContent;btn.textContent='Sending…';
        var v={};new FormData(form).forEach(function(val,k){if(typeof val==='string')v[k]=val;});
        fetch(O+'/api/forms/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields:v,page:location.href,referrer:document.referrer,utm:utm()})})
          .then(function(r){return r.json();}).catch(function(){return {ok:false,error:'Connection problem — please try again.'};})
          .then(function(r){
            if(r&&r.ok){
              if(r.redirect){location.href=r.redirect;return;}
              var ok=el('div',{'class':'gv-success',role:'status'});
              ok.appendChild(el('p',{'class':'gv-success-title'},(r.success&&r.success.title)||d.success.title));
              ok.appendChild(el('p',{'class':'gv-success-text'},(r.success&&r.success.text)||d.success.text));
              form.replaceWith(ok);
              box.dispatchEvent(new CustomEvent('growvia:submitted',{bubbles:true,detail:{id:id}}));
            }else{err.textContent=(r&&r.error)||'Something went wrong.';err.hidden=false;btn.disabled=false;btn.textContent=label;}
          });
      });
    }).catch(function(){box.remove();iframe(s,id);});
  }
  document.querySelectorAll('script[data-growvia-form]:not([data-gv-done])').forEach(function(s){
    s.setAttribute('data-gv-done','1');
    var id=s.getAttribute('data-growvia-form');if(!/^[0-9a-f-]{36}$/i.test(id))return;
    (s.getAttribute('data-mode')==='inline'?inline:iframe)(s,id);
  });
})();`;
  return new Response(js, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800", "Access-Control-Allow-Origin": "*" } });
}
