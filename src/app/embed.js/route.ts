import { siteOrigin } from "@/lib/data";

export const revalidate = 86400; // static file at the CDN — no function run per website visitor

/**
 * <script src="https://…/embed.js" data-growvia-form="FORM_ID"></script>                → auto-sizing iframe
 * <script … data-growvia-form="FORM_ID" data-mode="inline"></script>                    → real <form> in the page
 *   (the website's own CSS styles it via gv-* classes; forms with file uploads use the iframe).
 * Both pre-fill fields from the page URL (?service=…), pass UTM tags, and show errors next to each field.
 */
export function GET() {
  const origin = siteOrigin();
  const js = `(function(){
  var O=${JSON.stringify(origin)};
  function utm(){var q=new URLSearchParams(location.search),u={};q.forEach(function(v,k){if(k.indexOf('utm_')===0)u[k]=v;});return u;}
  function el(t,a,txt){var e=document.createElement(t);for(var k in a){if(a[k]===true)e.setAttribute(k,'');else if(a[k]!==false&&a[k]!=null)e.setAttribute(k,a[k]);}if(txt!=null)e.textContent=txt;return e;}
  // [text](https://url) → safe links; everything else stays text.
  function linked(parent,text){var re=/\\[([^\\]\\n]{1,120})\\]\\((https?:\\/\\/[^\\s)]{1,500})\\)/g,last=0,m;while((m=re.exec(text))){if(m.index>last)parent.appendChild(document.createTextNode(text.slice(last,m.index)));var a=el('a',{href:m[2],target:'_blank',rel:'noopener noreferrer'},m[1]);parent.appendChild(a);last=m.index+m[0].length;}if(last<text.length)parent.appendChild(document.createTextNode(text.slice(last)));return parent;}
  function baseCss(){if(document.getElementById('gv-base-css'))return;var st=el('style',{id:'gv-base-css'});
    st.textContent=':where(.gv-form){display:grid;gap:14px;max-width:100%}:where(.gv-field){display:grid;gap:6px}:where(.gv-field-checkbox label){display:flex;align-items:flex-start;gap:8px}:where(.gv-choices){display:flex;flex-wrap:wrap;gap:8px}:where(.gv-choice){display:flex;align-items:center;gap:6px}:where(.gv-input,.gv-select,.gv-textarea){width:100%;box-sizing:border-box;font:inherit}:where(.gv-textarea){min-height:96px}:where(.gv-hp){position:absolute!important;left:-9999px!important;width:1px;height:1px;opacity:0}:where(.gv-error,.gv-field-error){color:#b91c1c}:where(.gv-field-error){font-size:.85em}:where(.gv-help){font-size:.85em;opacity:.7}:where(.gv-range-row){display:flex;justify-content:space-between;font-size:.8em;opacity:.7}:where(.gv-branding){font-size:11px;opacity:.6;text-align:center}';
    document.head.appendChild(st);}
  function iframe(s,id){
    var p=new URLSearchParams();p.set('parent',location.href);if(document.referrer)p.set('ref',document.referrer);
    var f=document.createElement('iframe');
    f.src=O+'/embed/'+id+'?'+p.toString();f.title='Contact form';f.loading='lazy';
    f.style.cssText='width:100%;border:0;min-height:420px;background:transparent;color-scheme:light';
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
      if(!d||!d.ok||d.fields.some(function(f){return f.type==='file';})){box.remove();iframe(s,id);return;}
      baseCss();
      var q=new URLSearchParams(location.search),loaded=Date.now();
      if(d.intro)box.appendChild(el('p',{'class':'gv-intro'},d.intro));
      var form=el('form',{'class':'gv-form',novalidate:true}),errs={};
      d.fields.forEach(function(f){
        var fid='gv-'+id.slice(0,8)+'-'+f.key,pre=f.param?q.getAll(f.param):[];
        if(f.type==='hidden'){form.appendChild(el('input',{type:'hidden',name:f.key,value:(pre[0]||f.default||'')}));return;}
        var wrap=el('div',{'class':'gv-field gv-field-'+f.type+' gv-field-'+f.key});
        var lab=el('label',{'for':fid,'class':'gv-label'});linked(lab,f.label);if(!f.required&&f.type!=='checkbox')lab.appendChild(el('span',{'class':'gv-optional'},' (optional)'));
        if(f.type==='checkbox'){var l2=el('label',{'class':'gv-label'});var cb=el('input',{type:'checkbox',name:f.key,id:fid,value:f.checked_value||'yes','class':'gv-checkbox'});l2.appendChild(cb);linked(l2,' '+f.label);wrap.appendChild(l2);}
        else{wrap.appendChild(lab);if(f.help){var h=el('span',{'class':'gv-help'});linked(h,f.help);wrap.appendChild(h);}
          if(f.type==='multiselect'||f.type==='radio'){var c=el('div',{'class':'gv-choices'});var chosen=pre.length?pre.join(';').split(/\\s*[;,]\\s*/):(f.default?[f.default]:[]);(f.options||[]).forEach(function(o,i){var cl=el('label',{'class':'gv-choice'});cl.appendChild(el('input',{type:f.type==='radio'?'radio':'checkbox',name:f.key,value:o,id:i===0?fid:null,checked:chosen.indexOf(o)>=0}));cl.appendChild(document.createTextNode(o));c.appendChild(cl);});wrap.appendChild(c);}
          else if(f.type==='range'){var opts=f.options||[],start=Math.max(0,opts.indexOf(pre[0]||f.default||opts[0]));var shown=el('strong',{'class':'gv-range-value'},opts[start]||'');var hid=el('input',{type:'hidden',name:f.key,value:opts[start]||''});var rg=el('input',{type:'range',id:fid,min:'0',max:String(Math.max(0,opts.length-1)),step:'1',value:String(start),'class':'gv-range'});rg.addEventListener('input',function(){shown.textContent=opts[rg.value];hid.value=opts[rg.value];});lab.appendChild(document.createTextNode(' '));lab.appendChild(shown);wrap.appendChild(rg);wrap.appendChild(hid);var row=el('div',{'class':'gv-range-row'});opts.forEach(function(o){row.appendChild(el('span',{},o));});wrap.appendChild(row);}
          else if(f.type==='textarea')wrap.appendChild(el('textarea',{name:f.key,id:fid,'class':'gv-textarea',rows:'4',maxlength:String(f.max||5000),placeholder:f.placeholder||null}, pre[0]||f.default||''));
          else if(f.type==='select'){var sel=el('select',{name:f.key,id:fid,'class':'gv-select'});var o0=el('option',{value:'',disabled:true},'Choose…');sel.appendChild(o0);var want=pre[0]||f.default||'';(f.options||[]).forEach(function(o){sel.appendChild(el('option',{value:o,selected:o===want},o));});if(!want)o0.selected=true;wrap.appendChild(sel);}
          else wrap.appendChild(el('input',{type:f.type==='tel'?'tel':f.type==='email'?'email':f.type==='url'?'url':'text',name:f.key,id:fid,'class':'gv-input',maxlength:String(f.max||300),placeholder:f.placeholder||null,autocomplete:f.autocomplete||'off',value:pre[0]||f.default||null}));
        }
        var fe=el('span',{'class':'gv-field-error',role:'alert',hidden:true});wrap.appendChild(fe);errs[f.key]=fe;
        form.appendChild(wrap);
      });
      form.appendChild(el('input',{type:'text',name:'_gv_hp','class':'gv-hp',tabindex:'-1',autocomplete:'off','aria-hidden':'true'}));
      var err=el('p',{'class':'gv-error',role:'alert',hidden:true});form.appendChild(err);
      var btn=el('button',{type:'submit','class':'gv-button'},d.button);form.appendChild(btn);
      box.appendChild(form);
      if(d.branding){var b=el('p',{'class':'gv-branding'});b.appendChild(el('a',{href:O,target:'_blank',rel:'noopener'},'Powered by Growvia'));box.appendChild(b);}
      form.addEventListener('submit',function(e){
        e.preventDefault();err.hidden=true;for(var k in errs)errs[k].hidden=true;btn.disabled=true;var label=btn.textContent;btn.textContent='Sending…';
        var v={},fd=new FormData(form);
        d.fields.forEach(function(f){v[f.key]=f.type==='multiselect'?fd.getAll(f.key):(fd.get(f.key)||'');});
        v._gv_hp=fd.get('_gv_hp')||'';v._gv_t=String(loaded);
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
            }else{
              err.textContent=(r&&r.error)||d.error_text||'Something went wrong.';err.hidden=false;
              if(r&&r.fields)for(var k in r.fields){if(errs[k]){errs[k].textContent=r.fields[k];errs[k].hidden=false;}}
              btn.disabled=false;btn.textContent=label;
            }
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
